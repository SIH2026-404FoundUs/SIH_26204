/**
 * Unit Verification Test for Proof-of-Visit (PoV) Service
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

import assert from "assert";
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

async function runTests() {
  console.log("🧪 Starting PoV Service Verification Tests...\n");

  const secret = "test_pov_secret_12345";
  const businessId = "bus_shimla_001";
  const userId = "usr_tourist_001";
  const currentStep = getCurrentStep();

  // Test 1: 90s Rotating HMAC Code Generation
  console.log("Test 1: 90s Rotating HMAC-SHA256 Code Generation");
  const code = generatePovCode(secret, businessId, currentStep);
  assert.strictEqual(typeof code, "string");
  assert.strictEqual(code.length, 6);
  assert.strictEqual(/^\d{6}$/.test(code), true);
  console.log(`  ✅ Generated 6-digit code for step ${currentStep}: ${code}`);

  // Test 2: Clock Skew Window (step-1, step, step+1)
  console.log("Test 2: Clock Skew Window Validation");
  const validCodes = getValidPovCodes(secret, businessId, currentStep);
  assert.strictEqual(validCodes.length, 3);

  const prevCode = generatePovCode(secret, businessId, currentStep - 1);
  const nextCode = generatePovCode(secret, businessId, currentStep + 1);

  assert.strictEqual(validatePovCode(secret, businessId, code, currentStep).valid, true);
  assert.strictEqual(validatePovCode(secret, businessId, prevCode, currentStep).valid, true);
  assert.strictEqual(validatePovCode(secret, businessId, nextCode, currentStep).valid, true);
  assert.strictEqual(validatePovCode(secret, businessId, "999999", currentStep).valid, false);
  console.log("  ✅ Accepted step-1, step, step+1 codes; rejected invalid code");

  // Test 3: Haversine Distance & Velocity Check
  console.log("Test 3: Geographic Haversine Distance & Velocity Check");
  // Shimla to Manali (~125 km line of sight)
  const shimla = { lat: 31.1048, lng: 77.1734 };
  const manali = { lat: 32.2432, lng: 77.1892 };
  const distanceKm = calculateHaversineDistance(shimla.lat, shimla.lng, manali.lat, manali.lng);
  assert.strictEqual(distanceKm > 100 && distanceKm < 150, true);
  console.log(`  ✅ Haversine distance Shimla -> Manali calculated correctly: ${Math.round(distanceKm)} km`);

  // Shimla to Hyderabad (~1300 km) within 15 minutes -> Violates velocity (>200 km in <1 hr)
  const hyderabad = { lat: 17.385, lng: 78.4867 };
  const prevVisitHyderabad = {
    verifiedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
    location: hyderabad,
  };
  const velCheck = isVelocityViolated(prevVisitHyderabad, shimla);
  assert.strictEqual(velCheck.violated, true);
  console.log(`  ✅ Velocity violation detected: ${velCheck.distanceKm} km in ${velCheck.timeDeltaMinutes} min`);

  // Test 4: Self-Verification & Self-Referral Check
  console.log("Test 4: Self-Verification & Self-Referral Checks");
  const ownerCheck = isSelfReferral(userId, userId, null);
  assert.strictEqual(ownerCheck.isSelf, true);
  assert.strictEqual(ownerCheck.reason, "POV_SELF_VERIFICATION_OWNER");

  const selfRefCheck = isSelfReferral(userId, "bus_owner_999", userId);
  assert.strictEqual(selfRefCheck.isSelf, true);
  assert.strictEqual(selfRefCheck.reason, "POV_SELF_REFERRAL_SAME_USER");

  const validUserCheck = isSelfReferral(userId, "bus_owner_999", "referrer_888");
  assert.strictEqual(validUserCheck.isSelf, false);
  console.log("  ✅ Correctly flagged owner self-verification and self-referral attempts");

  // Test 5: Full 8-Step Verification Pipeline (Mock Models)
  console.log("Test 5: Full 8-Step Verification Pipeline (Accept Flow)");
  let mockBusiness = {
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
    findById: async (id) => (id === businessId ? mockBusiness : null),
  };

  const mockVisitModel = {
    findOne: async (query) => {
      return createdVisits.find(
        (v) =>
          v.userId === query.userId &&
          v.businessId === query.businessId &&
          v.codeStep === query.codeStep
      ) || null;
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

  // Run initial successful verification
  const result = await verifyVisit(
    {
      userId,
      businessId,
      code,
      currentLocation: shimla,
    },
    models
  );

  assert.strictEqual(result.status, "verified");
  assert.strictEqual(result.tierAfter, "visit-verified");
  assert.strictEqual(result.visitCount, 1);
  assert.strictEqual(mockBusiness.visitCount, 1);
  assert.strictEqual(mockBusiness.verificationTier, "visit-verified");
  console.log("  ✅ Successful visit verification! Tier upgraded to 'visit-verified', visitCount = 1");

  // Test 6: Anti-Replay Guarantee (Replaying same code in same step)
  console.log("Test 6: Anti-Replay Guarantee (Replayed Code Rejection)");
  const replayResult = await verifyVisit(
    {
      userId,
      businessId,
      code,
      currentLocation: shimla,
    },
    models
  );

  assert.strictEqual(replayResult.status, "rejected");
  assert.strictEqual(replayResult.reasonCode, "POV_REPLAY_DETECTED");
  assert.strictEqual(replayResult.code, 409);
  console.log("  ✅ Replayed code submission rejected with 409 POV_REPLAY_DETECTED!");

  // Test 7: Operator Code Generation Helper
  console.log("Test 7: Operator Code Display Generation");
  const opCodeInfo = generateCurrentOperatorCode(secret, businessId);
  assert.strictEqual(opCodeInfo.code, code);
  assert.strictEqual(opCodeInfo.expiresInSeconds > 0 && opCodeInfo.expiresInSeconds <= 90, true);
  console.log(`  ✅ Operator console code generated: ${opCodeInfo.code} (Expires in ${opCodeInfo.expiresInSeconds}s)`);

  console.log("\n🎉 ALL 7 POV SERVICE UNIT TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
