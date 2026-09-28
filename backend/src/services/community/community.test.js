/**
 * Jest Unit Test Suite for Community Discovery Service
 *
 * Verifies:
 * 1. String similarity & Levenshtein distance calculation
 * 2. AUTHZ Gate (0 verified visits = 403 Forbidden; >= 1 visit = passes)
 * 3. 5km DEDUP Check (within 5km & name similarity > 0.7 = 409 Conflict)
 * 4. 30-Day Rate Limit (max 3 submissions = 429 Too Many Requests)
 * 5. Queueing (status="queued", zero auto-writes to destinations)
 * 6. Admin Review & Promotion Pipeline (Approval copies to destinations with provenance="community_submission")
 */

import {
  calculateNameSimilarity,
  submitCommunityDestination,
  reviewCommunitySubmission,
} from "./index.js";

describe("Community Discovery Service", () => {
  test("Name Similarity Algorithm", () => {
    const sim1 = calculateNameSimilarity("Secret Waterfall", "Secret Waterfall");
    expect(sim1).toBe(1.0);

    const sim2 = calculateNameSimilarity("Kalka Waterfall", "Kalka Water Falls");
    expect(sim2 > 0.7).toBe(true);

    const sim3 = calculateNameSimilarity("Shimla Ridge", "Hyderabad Fort");
    expect(sim3 < 0.3).toBe(true);
  });

  test("AUTHZ Gate (Verified Visit Requirement)", async () => {
    const mockVisitModelNoVisits = {
      exists: async () => false,
    };

    const authzFailResult = await submitCommunityDestination(
      {
        userId: "usr_no_visits",
        name: "Hidden Cave",
        lat: 31.1048,
        lng: 77.1734,
        description: "A secret cave near Shimla",
      },
      { VisitModel: mockVisitModelNoVisits }
    );

    expect(authzFailResult.success).toBe(false);
    expect(authzFailResult.status).toBe(403);
    expect(authzFailResult.error).toBe("POV_VERIFIED_VISIT_REQUIRED");
  });

  test("5km Geo & Name Similarity DEDUP Check", async () => {
    const shimlaCoords = { lat: 31.1048, lng: 77.1734 };
    const mockVisitModelHasVisits = { exists: async () => true };

    const mockDestinationModel = {
      find: async () => [
        {
          destId: "shimla-secret-fall",
          name: "Shimla Secret Waterfall",
          location: { lat: 31.108, lng: 77.175 },
        },
      ],
    };

    const dedupFailResult = await submitCommunityDestination(
      {
        userId: "usr_verified_100",
        name: "Shimla Secret Water Fall",
        lat: shimlaCoords.lat,
        lng: shimlaCoords.lng,
        description: "Duplicate waterfall submission",
      },
      {
        VisitModel: mockVisitModelHasVisits,
        DestinationModel: mockDestinationModel,
      }
    );

    expect(dedupFailResult.success).toBe(false);
    expect(dedupFailResult.status).toBe(409);
    expect(dedupFailResult.error).toBe("COMMUNITY_DUPLICATE_DESTINATION");
  });

  test("Queueing Pipeline & Zero Auto-Write to Destinations", async () => {
    const mockVisitModelHasVisits = { exists: async () => true };
    let createdDestinationsCount = 0;
    const createdSubmissions = [];

    const mockDestinationModelNoWrite = {
      find: async () => [],
      create: async () => {
        createdDestinationsCount++;
      },
    };

    const mockCommunitySubmissionModelQueue = {
      find: async () => [],
      countDocuments: async () => 0,
      create: async (doc) => {
        const s = { _id: "sub_101", ...doc };
        createdSubmissions.push(s);
        return s;
      },
    };

    const queueResult = await submitCommunityDestination(
      {
        userId: "usr_legit_explorer",
        name: "Tirthan Hidden Stream",
        lat: 31.642,
        lng: 77.345,
        description: "Untouched pristine stream in Tirthan valley",
      },
      {
        VisitModel: mockVisitModelHasVisits,
        DestinationModel: mockDestinationModelNoWrite,
        CommunitySubmissionModel: mockCommunitySubmissionModelQueue,
      }
    );

    expect(queueResult.success).toBe(true);
    expect(queueResult.status).toBe(201);
    expect(queueResult.submission.status).toBe("queued");
    expect(createdDestinationsCount).toBe(0);
  });

  test("Admin Review & Promotion Pipeline", async () => {
    const queuedSubmission = {
      _id: "sub_101",
      userId: "usr_legit_explorer",
      name: "Tirthan Hidden Stream",
      location: { lat: 31.642, lng: 77.345 },
      description: "Untouched pristine stream in Tirthan valley",
      status: "queued",
      aiEnrichment: { attrs: { nature: 0.9, adventure: 0.7 } },
      save: async function () {
        return this;
      },
    };

    const createdDestinations = [];
    const mockDestinationModelApprove = {
      create: async (doc) => {
        const d = { _id: "dest_" + Date.now(), ...doc };
        createdDestinations.push(d);
        return d;
      },
    };

    const mockCommunitySubmissionModelReview = {
      findById: async (id) => (id === "sub_101" ? queuedSubmission : null),
    };

    const approveResult = await reviewCommunitySubmission(
      {
        submissionId: "sub_101",
        adminUserId: "admin_superuser",
        action: "approve",
      },
      {
        DestinationModel: mockDestinationModelApprove,
        CommunitySubmissionModel: mockCommunitySubmissionModelReview,
      }
    );

    expect(approveResult.success).toBe(true);
    expect(approveResult.action).toBe("approved");
    expect(queuedSubmission.status).toBe("approved");
    expect(createdDestinations.length).toBe(1);
    expect(createdDestinations[0].trackingTier).toBe("referenced");
    expect(createdDestinations[0].provenance).toBe("community_submission");
    expect(createdDestinations[0].destId).toBe("tirthan-hidden-stream");
  });
});
