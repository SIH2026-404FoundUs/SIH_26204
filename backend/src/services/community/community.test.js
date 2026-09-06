/**
 * Community Discovery Service Unit Test Suite
 *
 * Verifies:
 * 1. String similarity & Levenshtein distance calculation
 * 2. AUTHZ Gate (0 verified visits = 403 Forbidden; >= 1 visit = passes)
 * 3. 5km DEDUP Check (within 5km & name similarity > 0.7 = 409 Conflict)
 * 4. 30-Day Rate Limit (max 3 submissions = 429 Too Many Requests)
 * 5. Queueing (status="queued", zero auto-writes to destinations)
 * 6. Admin Review & Promotion Pipeline (Approval copies to destinations with provenance="community_submission")
 */

import assert from "assert";
import {
  calculateNameSimilarity,
  submitCommunityDestination,
  reviewCommunitySubmission,
  getQueuedSubmissions,
} from "./index.js";

async function runTests() {
  console.log("🧪 Starting Community Discovery Unit Tests...\n");

  // Test 1: Name Similarity Calculation
  console.log("Test 1: Name Similarity Algorithm");
  const sim1 = calculateNameSimilarity("Secret Waterfall", "Secret Waterfall");
  assert.strictEqual(sim1, 1.0);

  const sim2 = calculateNameSimilarity("Kalka Waterfall", "Kalka Water Falls");
  assert.strictEqual(sim2 > 0.7, true);

  const sim3 = calculateNameSimilarity("Shimla Ridge", "Hyderabad Fort");
  assert.strictEqual(sim3 < 0.3, true);
  console.log("  ✅ Name similarity algorithm verified (Exact: 1.0, Similar: >0.7, Distinct: <0.3)");

  // Test 2: AUTHZ Gate (User with 0 visits blocked, user with >= 1 visit passes)
  console.log("\nTest 2: AUTHZ Gate (Verified Visit Requirement)");

  const mockVisitModelNoVisits = {
    exists: async () => false,
  };

  const mockVisitModelHasVisits = {
    exists: async () => true,
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

  assert.strictEqual(authzFailResult.success, false);
  assert.strictEqual(authzFailResult.status, 403);
  assert.strictEqual(authzFailResult.error, "POV_VERIFIED_VISIT_REQUIRED");
  console.log("  ✅ User with 0 verified visits correctly blocked with 403 POV_VERIFIED_VISIT_REQUIRED");

  // Test 3: 5km Geo & Name Similarity DEDUP Check
  console.log("\nTest 3: 5km Geo & Name Similarity DEDUP Check");
  const shimlaCoords = { lat: 31.1048, lng: 77.1734 };

  const mockDestinationModel = {
    find: async () => [
      {
        destId: "shimla-secret-fall",
        name: "Shimla Secret Waterfall",
        location: { lat: 31.108, lng: 77.175 }, // ~0.5 km away
      },
    ],
  };

  const dedupFailResult = await submitCommunityDestination(
    {
      userId: "usr_verified_100",
      name: "Shimla Secret Water Fall", // Similar name within 0.5 km
      lat: shimlaCoords.lat,
      lng: shimlaCoords.lng,
      description: "Duplicate waterfall submission",
    },
    {
      VisitModel: mockVisitModelHasVisits,
      DestinationModel: mockDestinationModel,
    }
  );

  assert.strictEqual(dedupFailResult.success, false);
  assert.strictEqual(dedupFailResult.status, 409);
  assert.strictEqual(dedupFailResult.error, "COMMUNITY_DUPLICATE_DESTINATION");
  console.log("  ✅ Duplicate submission within 0.5km correctly rejected with 409 COMMUNITY_DUPLICATE_DESTINATION");

  // Test 4: 30-Day Rate Limit (Max 3 Submissions)
  console.log("\nTest 4: 30-Day Rate Limit (Max 3 Submissions)");
  const mockCommunitySubmissionModelRateLimit = {
    find: async () => [],
    countDocuments: async () => 3, // User already has 3 submissions in 30 days
  };

  const rateLimitResult = await submitCommunityDestination(
    {
      userId: "usr_spammer",
      name: "Fourth Waterfall",
      lat: 32.2432,
      lng: 77.1892,
    },
    {
      VisitModel: mockVisitModelHasVisits,
      DestinationModel: { find: async () => [] },
      CommunitySubmissionModel: mockCommunitySubmissionModelRateLimit,
    }
  );

  assert.strictEqual(rateLimitResult.success, false);
  assert.strictEqual(rateLimitResult.status, 429);
  assert.strictEqual(rateLimitResult.error, "COMMUNITY_RATE_LIMIT_EXCEEDED");
  console.log("  ✅ 4th submission within 30 days correctly rejected with 429 COMMUNITY_RATE_LIMIT_EXCEEDED");

  // Test 5: Queueing & Zero Auto-Promotion
  console.log("\nTest 5: Queueing Pipeline & Zero Auto-Write to Destinations");
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

  assert.strictEqual(queueResult.success, true);
  assert.strictEqual(queueResult.status, 201);
  assert.strictEqual(queueResult.submission.status, "queued");
  assert.strictEqual(createdDestinationsCount, 0); // MUST BE 0! Step 5 never auto-writes to destinations
  console.log("  ✅ Submission saved to queue with status 'queued'; zero auto-writes to destinations collection.");

  // Test 6: Admin Review & Promotion Pipeline
  console.log("\nTest 6: Admin Review & Promotion Pipeline");
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

  assert.strictEqual(approveResult.success, true);
  assert.strictEqual(approveResult.action, "approved");
  assert.strictEqual(queuedSubmission.status, "approved");
  assert.strictEqual(createdDestinations.length, 1);
  assert.strictEqual(createdDestinations[0].trackingTier, "referenced");
  assert.strictEqual(createdDestinations[0].provenance, "community_submission");
  assert.strictEqual(createdDestinations[0].destId, "tirthan-hidden-stream");

  console.log("  ✅ Admin approval successfully promoted queued submission into destinations with trackingTier='referenced' and provenance='community_submission'");

  console.log("\n🎉 ALL 6 COMMUNITY DISCOVERY UNIT TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
