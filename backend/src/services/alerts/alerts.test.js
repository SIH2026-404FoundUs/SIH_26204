/**
 * Real-Time Tourism Alerts & Safety Advisory Unit Test Suite
 *
 * Verifies:
 * 1. Mandatory Provenance (Rejects alert if sourceUrl or sourceName is missing)
 * 2. Idempotent Upsert via SHA256 Hash (Deduplicates identical advisories)
 * 3. Active Advisory Time Filtering (Surfaces active validFrom <= now <= validTo, filters expired)
 * 4. District Emergency Contacts Registry lookup
 * 5. Shareable Trip Record token generation, read-only projection, and revocation
 * 6. Tourist Complaint intake logging
 * 7. Verification that ZERO crime-based safety scoring fields exist
 */

import assert from "assert";
import {
  ingestAlert,
  getVerifiedAlerts,
  calculateAlertHash,
  getEmergencyContacts,
  createShareableTripRecord,
  getShareableTripRecord,
  revokeShareableTripRecord,
  submitTouristComplaint,
} from "./index.js";

async function runTests() {
  console.log("🧪 Starting Real-Time Tourism Alerts Unit Tests...\n");

  const destId = "shimla";

  // Test 1: Mandatory Attribution Enforcement (Rejects missing sourceUrl or sourceName)
  console.log("Test 1: Mandatory Attribution Enforcement");

  // Missing sourceUrl test
  const missingUrlResult = await ingestAlert({
    destId,
    kind: "weather",
    body: "Heavy snowfall alert on Kalka-Shimla highway",
    sourceName: "IMD Shimla",
    // sourceUrl missing
    validTo: new Date(Date.now() + 24 * 3600000),
  });
  assert.strictEqual(missingUrlResult.success, false);
  assert.strictEqual(missingUrlResult.status, 400);
  assert.strictEqual(missingUrlResult.error, "ALERT_ATTRIBUTION_REQUIRED");

  // Missing sourceName test
  const missingNameResult = await ingestAlert({
    destId,
    kind: "weather",
    body: "Heavy snowfall alert on Kalka-Shimla highway",
    sourceUrl: "https://mausam.imd.gov.in",
    sourceName: "   ", // empty string
    validTo: new Date(Date.now() + 24 * 3600000),
  });
  assert.strictEqual(missingNameResult.success, false);
  assert.strictEqual(missingNameResult.status, 400);
  assert.strictEqual(missingNameResult.error, "ALERT_ATTRIBUTION_REQUIRED");

  console.log("  ✅ Correctly rejected alerts missing sourceUrl or sourceName attribution with 400 ALERT_ATTRIBUTION_REQUIRED");

  // Test 2: Idempotent Ingestion & SHA256 Hash Deduplication
  console.log("\nTest 2: Idempotent Ingestion & SHA256 Hash Deduplication");
  const alertBody = "Heavy snowfall expected between Kalka and Shimla corridor.";
  const expectedHash = calculateAlertHash(destId, "weather", alertBody);

  const inMemoryAlerts = new Map();
  const mockAlertModel = {
    findOneAndUpdate: async (query, update) => {
      const hashKey = query.hash;
      const existing = inMemoryAlerts.get(hashKey);
      if (existing) {
        // Upsert update
        const updatedDoc = { ...existing, ...update.$set };
        inMemoryAlerts.set(hashKey, updatedDoc);
        return updatedDoc;
      }
      const newDoc = { _id: "alert_" + hashKey.substring(0, 8), ...update.$set };
      inMemoryAlerts.set(hashKey, newDoc);
      return newDoc;
    },
  };

  const models = { AlertModel: mockAlertModel };

  // First ingestion
  const ingest1 = await ingestAlert(
    {
      destId,
      kind: "weather",
      severity: "warning",
      body: alertBody,
      sourceUrl: "https://mausam.imd.gov.in/shimla",
      sourceName: "IMD Shimla Center",
      validFrom: new Date(Date.now() - 3600000),
      validTo: new Date(Date.now() + 24 * 3600000),
    },
    models
  );

  assert.strictEqual(ingest1.success, true);
  assert.strictEqual(ingest1.alert.hash, expectedHash);
  assert.strictEqual(inMemoryAlerts.size, 1);

  // Duplicate ingestion (same destId, kind, body) -> Should update, NOT create duplicate
  const ingest2 = await ingestAlert(
    {
      destId,
      kind: "weather",
      severity: "warning",
      body: alertBody,
      sourceUrl: "https://mausam.imd.gov.in/shimla",
      sourceName: "IMD Shimla Center",
      validFrom: new Date(Date.now() - 3600000),
      validTo: new Date(Date.now() + 24 * 3600000),
    },
    models
  );

  assert.strictEqual(ingest2.success, true);
  assert.strictEqual(inMemoryAlerts.size, 1); // Size remains 1 due to sha256 hash deduplication
  console.log(`  ✅ SHA256 hash deduplication verified (${expectedHash.substring(0, 12)}...); 0 duplicate records created.`);

  // Test 3: Active Advisory Time Filtering (getVerifiedAlerts)
  console.log("\nTest 3: Active Advisory Time Filtering (getVerifiedAlerts)");

  const mockActiveAlerts = [
    {
      _id: "a1",
      destId: "shimla",
      kind: "weather",
      severity: "warning",
      body: "Active weather warning",
      sourceUrl: "https://mausam.imd.gov.in",
      sourceName: "IMD Shimla",
      validFrom: new Date(Date.now() - 3600000),
      validTo: new Date(Date.now() + 86400000), // Valid for 24h
    },
    {
      _id: "a2",
      destId: "shimla",
      kind: "road",
      severity: "info",
      body: "Expired road advisory",
      sourceUrl: "https://hppwd.hp.gov.in",
      sourceName: "HP PWD Status",
      validFrom: new Date(Date.now() - 86400000),
      validTo: new Date(Date.now() - 3600000), // Expired 1 hour ago
    },
  ];

  const mockAlertModelFilter = {
    find: async (query) => {
      const now = new Date();
      return mockActiveAlerts.filter((a) => {
        if (a.destId !== query.destId) return false;
        if (query.validTo && query.validTo.$gte && a.validTo < now) return false;
        if (query.validFrom && query.validFrom.$lte && a.validFrom > now) return false;
        if (query.kind && a.kind !== query.kind) return false;
        return true;
      });
    },
  };

  const activeAlerts = await getVerifiedAlerts(
    { destId: "shimla" },
    { AlertModel: mockAlertModelFilter }
  );

  assert.strictEqual(activeAlerts.length, 1);
  assert.strictEqual(activeAlerts[0]._id, "a1");
  assert.strictEqual(activeAlerts[0].sourceName, "IMD Shimla");
  assert.strictEqual(activeAlerts[0].crimeScore, undefined); // ZERO crime score check!
  console.log("  ✅ Filtered out expired alerts; active advisory returned with source provenance and zero crime scoring.");

  // Test 4: District Emergency Contacts Lookup
  console.log("\nTest 4: District Emergency Contacts Registry");
  const shimlaContacts = getEmergencyContacts("shimla");
  assert.strictEqual(shimlaContacts.district, "Shimla");
  assert.strictEqual(shimlaContacts.police, "0177-2656530");
  assert.strictEqual(shimlaContacts.defaults.nationalEmergency, "112");
  console.log(`  ✅ Shimla district emergency contacts retrieved (Police: ${shimlaContacts.police}, National: 112)`);

  // Test 5: Shareable Trip Record Token & Revocation
  console.log("\nTest 5: Shareable Trip Record Token & Revocation");
  const shareTokenStore = new Map();
  const mockShareableTripModel = {
    create: async (doc) => {
      shareTokenStore.set(doc.shareToken, { ...doc });
      return doc;
    },
    findOne: async (query) => shareTokenStore.get(query.shareToken) || null,
    findOneAndUpdate: async (query, update) => {
      const existing = shareTokenStore.get(query.shareToken);
      if (existing && existing.userId === query.userId) {
        const updated = { ...existing, ...update.$set };
        shareTokenStore.set(query.shareToken, updated);
        return updated;
      }
      return null;
    },
  };

  const shareModels = { ShareableTripModel: mockShareableTripModel };

  const shareCreated = await createShareableTripRecord(
    {
      tripId: "trip_777",
      userId: "usr_tourist_100",
      title: "Shimla Snow Trip",
      destId: "shimla",
      stops: [{ name: "Mall Road", dayIndex: 1 }],
    },
    shareModels
  );

  assert.strictEqual(shareCreated.success, true);
  assert.strictEqual(typeof shareCreated.shareToken, "string");
  assert.strictEqual(shareCreated.shareToken.length, 32);

  // Fetch projection via token
  const shareResolved = await getShareableTripRecord(shareCreated.shareToken, shareModels);
  assert.strictEqual(shareResolved.success, true);
  assert.strictEqual(shareResolved.tripProjection.title, "Shimla Snow Trip");

  // Revoke token
  await revokeShareableTripRecord(shareCreated.shareToken, "usr_tourist_100", shareModels);
  const shareRevokedResolved = await getShareableTripRecord(shareCreated.shareToken, shareModels);
  assert.strictEqual(shareRevokedResolved.success, false);
  assert.strictEqual(shareRevokedResolved.status, 410);
  assert.strictEqual(shareRevokedResolved.error, "SHARE_TOKEN_EXPIRED_OR_REVOKED");

  console.log("  ✅ Generated 32-char token, fetched read-only trip projection, and revoked successfully.");

  // Test 6: Tourist Complaint Intake
  console.log("\nTest 6: Tourist Complaint Intake Logging");
  const mockComplaintModel = {
    create: async (doc) => ({ _id: "comp_999", ...doc }),
  };

  const complaintResult = await submitTouristComplaint(
    {
      userId: "usr_tourist_100",
      destId: "shimla",
      category: "overcharging_pricing",
      text: "Local taxi charged double the standard rate.",
    },
    { ComplaintModel: mockComplaintModel }
  );

  assert.strictEqual(complaintResult.success, true);
  assert.strictEqual(complaintResult.status, 201);
  assert.strictEqual(complaintResult.complaint.category, "overcharging_pricing");
  assert.strictEqual(complaintResult.complaint.status, "logged");
  console.log("  ✅ Tourist complaint logged for platform moderation with disclaimer.");

  console.log("\n🎉 ALL 6 REAL-TIME TOURISM ALERTS UNIT TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
