/**
 * Jest Unit Test Suite for Real-Time Tourism Alerts & Safety Advisory
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

describe("Real-Time Tourism Alerts & Safety Advisory", () => {
  const destId = "shimla";

  test("Mandatory Attribution Enforcement", async () => {
    const missingUrlResult = await ingestAlert({
      destId,
      kind: "weather",
      body: "Heavy snowfall alert on Kalka-Shimla highway",
      sourceName: "IMD Shimla",
      validTo: new Date(Date.now() + 24 * 3600000),
    });
    expect(missingUrlResult.success).toBe(false);
    expect(missingUrlResult.status).toBe(400);
    expect(missingUrlResult.error).toBe("ALERT_ATTRIBUTION_REQUIRED");

    const missingNameResult = await ingestAlert({
      destId,
      kind: "weather",
      body: "Heavy snowfall alert on Kalka-Shimla highway",
      sourceUrl: "https://mausam.imd.gov.in",
      sourceName: "   ",
      validTo: new Date(Date.now() + 24 * 3600000),
    });
    expect(missingNameResult.success).toBe(false);
    expect(missingNameResult.status).toBe(400);
    expect(missingNameResult.error).toBe("ALERT_ATTRIBUTION_REQUIRED");
  });

  test("Idempotent Ingestion & SHA256 Hash Deduplication", async () => {
    const alertBody = "Heavy snowfall expected between Kalka and Shimla corridor.";
    const expectedHash = calculateAlertHash(destId, "weather", alertBody);

    const inMemoryAlerts = new Map();
    const mockAlertModel = {
      findOneAndUpdate: async (query, update) => {
        const hashKey = query.hash;
        const existing = inMemoryAlerts.get(hashKey);
        if (existing) {
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

    expect(ingest1.success).toBe(true);
    expect(ingest1.alert.hash).toBe(expectedHash);
    expect(inMemoryAlerts.size).toBe(1);

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

    expect(ingest2.success).toBe(true);
    expect(inMemoryAlerts.size).toBe(1);
  });

  test("Active Advisory Time Filtering (getVerifiedAlerts)", async () => {
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
        validTo: new Date(Date.now() + 86400000),
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
        validTo: new Date(Date.now() - 3600000),
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

    expect(activeAlerts.length).toBe(1);
    expect(activeAlerts[0]._id).toBe("a1");
    expect(activeAlerts[0].sourceName).toBe("IMD Shimla");
    expect(activeAlerts[0].crimeScore).toBeUndefined();
  });

  test("District Emergency Contacts Registry", () => {
    const shimlaContacts = getEmergencyContacts("shimla");
    expect(shimlaContacts.district).toBe("Shimla");
    expect(shimlaContacts.police).toBe("0177-2656530");
    expect(shimlaContacts.defaults.nationalEmergency).toBe("112");
  });

  test("Shareable Trip Record Token & Revocation", async () => {
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

    expect(shareCreated.success).toBe(true);
    expect(typeof shareCreated.shareToken).toBe("string");
    expect(shareCreated.shareToken.length).toBe(32);

    const shareResolved = await getShareableTripRecord(shareCreated.shareToken, shareModels);
    expect(shareResolved.success).toBe(true);
    expect(shareResolved.tripProjection.title).toBe("Shimla Snow Trip");

    await revokeShareableTripRecord(shareCreated.shareToken, "usr_tourist_100", shareModels);
    const shareRevokedResolved = await getShareableTripRecord(shareCreated.shareToken, shareModels);
    expect(shareRevokedResolved.success).toBe(false);
    expect(shareRevokedResolved.status).toBe(410);
    expect(shareRevokedResolved.error).toBe("SHARE_TOKEN_EXPIRED_OR_REVOKED");
  });

  test("Tourist Complaint Intake Logging", async () => {
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

    expect(complaintResult.success).toBe(true);
    expect(complaintResult.status).toBe(201);
    expect(complaintResult.complaint.category).toBe("overcharging_pricing");
    expect(complaintResult.complaint.status).toBe("logged");
  });
});
