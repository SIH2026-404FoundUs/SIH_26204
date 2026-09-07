/**
 * Jest Unit Test Suite for Proof-of-Visit (PoV) Service
 *
 * Verifies:
 * 1. 90-second rotating HMAC-SHA256 code generation & clock skew window (step - 1, step, step + 1)
 * 2. Complete 8-step verification pipeline (accept flow)
 * 3. Code mismatch rejection
 * 4. Anti-replay protection (second submission of same (userId, businessId, step) fails)
 * 5. Velocity check (>200 km in <1 hr fails)
 * 6. Self-verification & self-referral checks
 * 7. Business verification tier upgrade ('self-declared' -> 'visit-verified') & visitCount increment
 */

import {
  getCurrentStep,
  generatePovCode,
  getValidPovCodes,
  validatePovCode,
  calculateHaversineDistance,
  isVelocityViolated,
  isSelfReferral,
  verifyVisit,
  generateCurrentOperatorCode,
} from "./index.js";

describe("Proof-of-Visit (PoV) Service", () => {
  const secret = "test_pov_secret_12345";
  const businessId = "bus_shimla_001";
  const userId = "usr_tourist_001";
  const currentStep = getCurrentStep();

  test("90s Rotating HMAC-SHA256 Code Generation", () => {
    const code = generatePovCode(secret, businessId, currentStep);
    expect(typeof code).toBe("string");
    expect(code.length).toBe(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  test("Clock Skew Window Validation (step-1, step, step+1)", () => {
    const validCodes = getValidPovCodes(secret, businessId, currentStep);
    expect(validCodes.length).toBe(3);

    const code = generatePovCode(secret, businessId, currentStep);
    const prevCode = generatePovCode(secret, businessId, currentStep - 1);
    const nextCode = generatePovCode(secret, businessId, currentStep + 1);

    expect(validatePovCode(secret, businessId, code, currentStep).valid).toBe(true);
    expect(validatePovCode(secret, businessId, prevCode, currentStep).valid).toBe(true);
    expect(validatePovCode(secret, businessId, nextCode, currentStep).valid).toBe(true);
    expect(validatePovCode(secret, businessId, "999999", currentStep).valid).toBe(false);
  });

  test("Geographic Haversine Distance & Velocity Check", () => {
    const shimla = { lat: 31.1048, lng: 77.1734 };
    const manali = { lat: 32.2432, lng: 77.1892 };
    const distanceKm = calculateHaversineDistance(shimla.lat, shimla.lng, manali.lat, manali.lng);
    expect(distanceKm > 100 && distanceKm < 150).toBe(true);

    const hyderabad = { lat: 17.385, lng: 78.4867 };
    const prevVisitHyderabad = {
      verifiedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
      location: hyderabad,
    };
    const velCheck = isVelocityViolated(prevVisitHyderabad, shimla);
    expect(velCheck.violated).toBe(true);
  });

  test("Self-Verification & Self-Referral Checks", () => {
    const ownerCheck = isSelfReferral(userId, userId, null);
    expect(ownerCheck.isSelf).toBe(true);
    expect(ownerCheck.reason).toBe("POV_SELF_VERIFICATION_OWNER");

    const selfRefCheck = isSelfReferral(userId, "bus_owner_999", userId);
    expect(selfRefCheck.isSelf).toBe(true);
    expect(selfRefCheck.reason).toBe("POV_SELF_REFERRAL_SAME_USER");

    const validUserCheck = isSelfReferral(userId, "bus_owner_999", "referrer_888");
    expect(validUserCheck.isSelf).toBe(false);
  });

  test("Full 8-Step Verification Pipeline (Accept Flow)", async () => {
    const shimla = { lat: 31.1048, lng: 77.1734 };
    const mockBusiness = {
      _id: businessId,
      povSecret: secret,
      destId: "shimla",
      ownerUserId: "owner_123",
      visitCount: 0,
      verificationTier: "self-declared",
      save: async function () {
        return this;
      },
    };

    const createdVisits = [];
    const createdAudits = [];

    const mockBusinessModel = {
      // real Mongoose findById() returns a chainable Query — povSecret has
      // `select: false` on the schema, so povService.js re-selects it explicitly.
      findById: (id) => ({
        select: async () => (id === businessId ? mockBusiness : null),
      }),
    };

    const mockVisitModel = {
      findOne: async (query) => {
        return (
          createdVisits.find(
            (v) =>
              v.userId === query.userId &&
              v.businessId === query.businessId &&
              v.codeStep === query.codeStep
          ) || null
        );
      },
      create: async (doc) => {
        const v = { _id: "visit_" + (createdVisits.length + 1), ...doc };
        createdVisits.push(v);
        return v;
      },
    };

    const mockAuditLogModel = {
      create: async (doc) => {
        createdAudits.push(doc);
        return doc;
      },
    };

    const models = {
      BusinessModel: mockBusinessModel,
      VisitModel: mockVisitModel,
      AuditLogModel: mockAuditLogModel,
    };

    const code = generatePovCode(secret, businessId, currentStep);
    const result = await verifyVisit(
      {
        userId,
        businessId,
        code,
        currentLocation: shimla,
      },
      models
    );

    expect(result.status).toBe("verified");
    expect(result.tierAfter).toBe("visit-verified");
    expect(result.visitCount).toBe(1);
    expect(mockBusiness.visitCount).toBe(1);
    expect(mockBusiness.verificationTier).toBe("visit-verified");
  });

  test("Anti-Replay Guarantee (Replayed Code Rejection)", async () => {
    const shimla = { lat: 31.1048, lng: 77.1734 };
    const mockBusiness = {
      _id: businessId,
      povSecret: secret,
      destId: "shimla",
      ownerUserId: "owner_123",
      visitCount: 1,
      verificationTier: "visit-verified",
      save: async function () {
        return this;
      },
    };

    const createdVisits = [
      {
        _id: "visit_existing_1",
        userId,
        businessId,
        codeStep: currentStep,
        status: "verified",
      },
    ];

    const mockBusinessModel = {
      findById: (id) => ({
        select: async () => (id === businessId ? mockBusiness : null),
      }),
    };

    const mockVisitModel = {
      findOne: async (query) => {
        return (
          createdVisits.find(
            (v) =>
              v.userId === query.userId &&
              v.businessId === query.businessId &&
              v.codeStep === query.codeStep
          ) || null
        );
      },
    };

    const models = {
      BusinessModel: mockBusinessModel,
      VisitModel: mockVisitModel,
    };

    const code = generatePovCode(secret, businessId, currentStep);
    const replayResult = await verifyVisit(
      {
        userId,
        businessId,
        code,
        currentLocation: shimla,
      },
      models
    );

    expect(replayResult.status).toBe("rejected");
    expect(replayResult.reasonCode).toBe("POV_REPLAY_DETECTED");
    expect(replayResult.code).toBe(409);
  });

  test("Operator Code Display Generation", () => {
    const opCodeInfo = generateCurrentOperatorCode(secret, businessId);
    expect(typeof opCodeInfo.code).toBe("string");
    expect(opCodeInfo.code.length).toBe(6);
    expect(opCodeInfo.expiresInSeconds > 0 && opCodeInfo.expiresInSeconds <= 90).toBe(true);
  });
});
