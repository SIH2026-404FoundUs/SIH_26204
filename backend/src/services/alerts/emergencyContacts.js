/**
 * Seeded District-Keyed Emergency Contacts Registry
 *
 * Provides verified emergency helpline numbers (Police, Ambulance, Disaster Management)
 * keyed by destination/district slug, with national/statewide fallbacks.
 */

export const DEFAULT_STATEWIDE_EMERGENCY_CONTACTS = {
  nationalEmergency: "112",
  police: "100",
  ambulance: "108",
  disasterHelpline: "1077",
  womenHelpline: "1091",
  touristHelpline: "1363",
};

export const DISTRICT_EMERGENCY_REGISTRY = {
  shimla: {
    district: "Shimla",
    state: "Himachal Pradesh",
    police: "0177-2656530",
    controlRoom: "0177-2800100",
    ambulance: "108",
    disasterHelpline: "0177-2800880",
    touristPolice: "0177-2652123",
  },
  manali: {
    district: "Kullu",
    state: "Himachal Pradesh",
    police: "01902-252726",
    controlRoom: "01902-250000",
    ambulance: "108",
    disasterHelpline: "01902-250250",
    touristPolice: "01902-252320",
  },
  "tirthan-valley": {
    district: "Kullu",
    state: "Himachal Pradesh",
    police: "01902-265201",
    controlRoom: "01902-250000",
    ambulance: "108",
    disasterHelpline: "01902-250250",
  },
  jibhi: {
    district: "Kullu",
    state: "Himachal Pradesh",
    police: "01902-265201",
    ambulance: "108",
    disasterHelpline: "01902-250250",
  },
  hyderabad: {
    district: "Hyderabad",
    state: "Telangana",
    police: "040-27852435",
    controlRoom: "100",
    ambulance: "108",
    disasterHelpline: "040-21111111",
    touristPolice: "040-23260880",
  },
  warangal: {
    district: "Warangal",
    state: "Telangana",
    police: "0870-2428200",
    ambulance: "108",
    disasterHelpline: "0870-2500100",
  },
};

/**
 * Fetch verified emergency contacts for a given district slug.
 *
 * @param {string} destId - Canonical destination slug (e.g. "shimla", "manali").
 * @returns {Object} Emergency contacts object.
 */
export function getEmergencyContacts(destId) {
  const slug = String(destId || "").toLowerCase().trim();
  const districtData = DISTRICT_EMERGENCY_REGISTRY[slug];

  return {
    destId: slug || "general",
    ...(districtData || { district: "General", state: "India" }),
    defaults: DEFAULT_STATEWIDE_EMERGENCY_CONTACTS,
  };
}
