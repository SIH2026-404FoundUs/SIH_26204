import crypto from "crypto";
import Business from "../models/business.model.js";
import BusinessAvailability from "../models/businessAvailability.model.js";
import { getPressure } from "../services/pressure/service.js";
import { rankBusinessesForGrowth, calculateBusinessGrowthRank } from "../services/feedback/growthRanking.js";
import { slugify } from "../services/community/similarityUtils.js";

const today = () => new Date().toISOString().slice(0, 10);

// Same "low pressure" cutoff Bharani's eligibleForDiscount() uses (spec: pressure < 0.30),
// reused here rather than inventing a second threshold for the same concept.
const LOW_PRESSURE_THRESHOLD = 0.3;

const BUSINESS_TYPES = ["homestay", "guesthouse", "hotel", "restaurant", "guide", "driver", "cook"];
const RESOURCE_TYPE_BY_BUSINESS_TYPE = { homestay: "room", guesthouse: "room", hotel: "room", restaurant: "table", guide: "service", driver: "service", cook: "service" };
const asDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};
const ownedBusiness = (req, id) => Business.findOne({ _id: id, ownerUserId: String(req.user._id) });

export const getBusinessAvailabilityController = async (req, res) => {
  try {
    if (req.user.role !== "operator") return res.status(403).json({ message: "operator role required" });
    const business = await ownedBusiness(req, req.params.id);
    if (!business) return res.status(404).json({ message: "business not found" });
    const from = asDate(req.query.from) || new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const rows = await BusinessAvailability.find({ businessId: business._id, date: { $gte: from } }).sort({ date: 1 }).lean();
    res.status(200).json(rows);
  } catch (error) { console.log("Error in getBusinessAvailability controller", error.message); res.status(500).json({ message: "Internal Server Error" }); }
};

export const upsertBusinessAvailabilityController = async (req, res) => {
  try {
    if (req.user.role !== "operator") return res.status(403).json({ message: "operator role required" });
    const business = await ownedBusiness(req, req.params.id);
    if (!business) return res.status(404).json({ message: "business not found" });
    const { date: rawDate, units, available, pricePerNight, discountPct, isOpen = true } = req.body;
    const date = asDate(rawDate); const total = Number(units);
    if (!date) return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    if (!Number.isInteger(total) || total < 0) return res.status(400).json({ message: "units must be a non-negative whole number" });
    const resourceType = RESOURCE_TYPE_BY_BUSINESS_TYPE[business.type] || "service";
    const nextAvailable = isOpen === false ? 0 : (available === undefined ? total : Number(available));
    if (!Number.isInteger(nextAvailable) || nextAvailable < 0 || nextAvailable > total) return res.status(400).json({ message: "available must be between 0 and units" });
    const price = pricePerNight === undefined || pricePerNight === "" ? undefined : Number(pricePerNight);
    const discount = discountPct === undefined || discountPct === "" ? 0 : Number(discountPct);
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return res.status(400).json({ message: "price must be zero or greater" });
    if (!Number.isFinite(discount) || discount < 0 || discount > 40) return res.status(400).json({ message: "discount must be between 0 and 40" });
    const row = await BusinessAvailability.findOneAndUpdate(
      { businessId: business._id, date, resourceType },
      { $set: { units: { total, available: nextAvailable }, pricePerNight: price, discountPct: discount, isOpen: Boolean(isOpen), source: "business_declared", updatedAt: new Date() }, $setOnInsert: { _id: `avail_${business._id}_${rawDate}` } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    res.status(200).json(row);
  } catch (error) { console.log("Error in upsertBusinessAvailability controller", error.message); res.status(500).json({ message: "Internal Server Error" }); }
};

// GET /api/v1/businesses/:id/growth -- operator-only, own business only.
// Surfaces the SAME formula searchBusinessesController already sorts by
// (calculateBusinessGrowthRank, spec §3.4) so an operator can actually see
// their own multiplier breakdown instead of the ranking working invisibly
// in the background of traveller search results.
export const getBusinessGrowthController = async (req, res) => {
  try {
    if (req.user.role !== "operator") return res.status(403).json({ message: "operator role required" });
    const business = await ownedBusiness(req, req.params.id);
    if (!business) return res.status(404).json({ message: "business not found" });

    const pressureRow = business.destId ? await getPressure(business.destId, today()) : null;
    const isInLowPressureDest = typeof pressureRow?.score === "number" && pressureRow.score < LOW_PRESSURE_THRESHOLD;

    const { rank, multipliers } = calculateBusinessGrowthRank(business, { isInLowPressureDest });

    // Plain-language nudges -- only for factors an operator can actually
    // still act on. onboardedVia is fixed at onboarding time (nothing to
    // suggest there); verificationTier and the pressure-driven bonus are
    // both real, current, actionable state.
    const nudges = [];
    if (business.verificationTier !== "registered") {
      nudges.push(
        business.verificationTier === "visit-verified"
          ? "Complete full registration to reach the top verification tier and its full ranking boost."
          : "Get at least one traveller to verify a visit, or complete full registration, for a ranking boost."
      );
    }
    if (!isInLowPressureDest) {
      nudges.push("This destination isn't low-pressure right now -- the redistribution bonus isn't active today, but check back as pressure changes.");
    }

    res.status(200).json({
      businessId: business._id,
      rank,
      multipliers,
      factors: {
        isLocallyOnboarded: business.onboardedVia === "whatsapp",
        verificationTier: business.verificationTier || "self-declared",
        isInLowPressureDest,
      },
      nudges,
    });
  } catch (error) {
    console.log("Error in getBusinessGrowth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/businesses/search?destId=&type=
// Wraps Business.find() + the existing growthRanking formula (spec §3.4) — no
// second ranking implementation. This is the only current consumer of
// rankBusinessesForGrowth(); it was previously correct but wired to nothing.
export const searchBusinessesController = async (req, res) => {
  try {
    const { destId, type } = req.query;
    if (!destId) return res.status(400).json({ message: "destId query param required" });

    // Listings change (an operator edits pricing/availability, a new
    // business registers) but not from one request to the next -- a short
    // client-cacheable window still turns most repeat views into a 304
    // (Express's default ETag) instead of a full payload, without risking
    // showing genuinely stale pricing for more than a minute.
    res.set("Cache-Control", "public, max-age=60");

    const filter = { destId };
    if (type) filter.type = type;
    // Every card that renders this list (Businesses.jsx, AvailableServices.jsx,
    // HirePeople.jsx, VisitVerify's picker) only ever reads these fields --
    // never photos, aiThemes/aiActions, feedbackSummary, rawTranscript, or
    // any of the registration-assist fields, all of which can be large and
    // none of which any card shows. ownerPhone stays behind its own
    // `select: false` (schema default) -- HirePeople's "reveal contact"
    // flow fetches it separately, on demand, per worker.
    const businesses = await Business.find(filter)
      .select("name type destId capacity priceRangeINR languages amenities meals nearestLandmark websiteUrl verificationTier onboardedVia visitCount")
      .lean();

    const pressureRow = await getPressure(destId, today());
    const isInLowPressureDest =
      typeof pressureRow?.score === "number" && pressureRow.score < LOW_PRESSURE_THRESHOLD;

    const ranked = rankBusinessesForGrowth(businesses, { isInLowPressureDest });
    res.status(200).json(ranked);
  } catch (error) {
    console.log("Error in searchBusinesses controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/businesses — an operator registering their business directly
// through the web console, alongside (not replacing) the WhatsApp-onboarding
// pipeline that already writes to this same collection. verificationTier
// "registered" marks exactly this path, distinct from "self-declared"
// (WhatsApp, no verification) and "visit-verified" (earned via real visits).
// Generates its own _id and povSecret -- neither is ever produced anywhere
// else in this codebase today (the WhatsApp pipeline doesn't set povSecret
// either), so a business registered here is actually the first kind of
// business that can ever show a working Verify-a-Visit code.
export const registerBusinessController = async (req, res) => {
  try {
    if (req.user.role !== "operator") {
      return res.status(403).json({ message: "operator role required" });
    }

    const {
      name, type, destId, capacity, ownerPhone,
      languages, priceRangeINR, amenities, meals, nearestLandmark, websiteUrl,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "name is required" });
    }
    if (!type || !BUSINESS_TYPES.includes(type)) {
      return res.status(400).json({ message: `type must be one of: ${BUSINESS_TYPES.join(", ")}` });
    }
    if (!destId || typeof destId !== "string") {
      return res.status(400).json({ message: "destId is required" });
    }
    if (capacity === undefined || capacity === null || Number.isNaN(Number(capacity)) || Number(capacity) <= 0) {
      return res.status(400).json({ message: "capacity (a positive number) is required" });
    }
    if (!ownerPhone || typeof ownerPhone !== "string" || !ownerPhone.trim()) {
      return res.status(400).json({ message: "ownerPhone is required" });
    }
    let cleanWebsiteUrl;
    if (websiteUrl && typeof websiteUrl === "string" && websiteUrl.trim()) {
      // Accept a bare domain (no scheme) the way a non-technical operator
      // would type one -- "myhotel.com" is just as valid an input as
      // "https://myhotel.com", not caller error.
      const candidate = /^https?:\/\//i.test(websiteUrl.trim()) ? websiteUrl.trim() : `https://${websiteUrl.trim()}`;
      try {
        cleanWebsiteUrl = new URL(candidate).toString();
      } catch {
        return res.status(400).json({ message: "websiteUrl is not a valid URL" });
      }
    }

    const update = {
      _id: `biz_${slugify(name).slice(0, 40)}_${crypto.randomBytes(3).toString("hex")}`,
      name: name.trim(),
      type,
      destId: destId.trim(),
      capacity: Number(capacity),
      ownerPhone: ownerPhone.trim(),
      ownerUserId: String(req.user._id),
      verificationTier: "registered",
      onboardedVia: "operator-web",
      povSecret: crypto.randomBytes(32).toString("hex"),
    };
    if (Array.isArray(languages)) update.languages = languages.filter((l) => typeof l === "string");
    if (priceRangeINR && typeof priceRangeINR === "object") {
      const min = Number(priceRangeINR.min);
      const max = Number(priceRangeINR.max);
      update.priceRangeINR = { min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined };
    }
    if (Array.isArray(amenities)) update.amenities = amenities.filter((a) => typeof a === "string");
    if (Array.isArray(meals)) update.meals = meals.filter((m) => typeof m === "string");
    if (nearestLandmark && typeof nearestLandmark === "string") update.nearestLandmark = nearestLandmark.trim();
    if (cleanWebsiteUrl) update.websiteUrl = cleanWebsiteUrl;

    const business = await Business.create(update);

    // povSecret never leaves the server in this response -- the operator's
    // own display page reads the current CODE via GET /visits/operator-code/:id,
    // never the secret itself.
    const { povSecret: _omit, ...safe } = business.toObject();
    res.status(201).json(safe);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A business with this owner phone number already exists" });
    }
    console.log("Error in registerBusiness controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/businesses/:id/contact — "click to hire" on the Hire People
// page: an operator browsing already-onboarded workers (cook/driver/guide
// listings, most of them arriving via the WhatsApp/audio pipeline with no
// login account attached at all) needs their phone number to actually
// contact and hire them. There's no in-app messaging or employment-record
// system anywhere in this codebase to route this through, so revealing the
// real contact number IS the honest version of "hire" here -- ownerPhone is
// `select: false` on the schema specifically so it's never included in the
// ordinary public search response; this is the one deliberate, operator-only,
// authenticated exception to that.
//
// Gated on having registered a business first: an operator with nothing of
// their own listed yet has nothing to hire *for*, and this is the actual
// enforcement point (not just a hidden nav item) for "register before you
// can hire".
export const getBusinessContactController = async (req, res) => {
  try {
    if (req.user.role !== "operator") {
      return res.status(403).json({ message: "operator role required" });
    }
    const ownsABusiness = await Business.exists({ ownerUserId: String(req.user._id) });
    if (!ownsABusiness) {
      return res.status(403).json({ message: "Register a business before hiring" });
    }
    const business = await Business.findById(req.params.id).select("+ownerPhone name type destId");
    if (!business) return res.status(404).json({ message: "business not found" });
    res.status(200).json({
      _id: business._id,
      name: business.name,
      type: business.type,
      destId: business.destId,
      ownerPhone: business.ownerPhone,
    });
  } catch (error) {
    console.log("Error in getBusinessContact controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/businesses/mine — the operator's own registered businesses.
// Only ever returns businesses that went through registerBusinessController
// above (ownerUserId set) -- a WhatsApp-onboarded business has no ownerUserId
// to match against (it's tied to a phone number, not a login account), so it
// intentionally does not appear here. That's a real, current limitation, not
// a bug: linking a login account to a WhatsApp-onboarded listing needs a
// phone-verification step that doesn't exist yet anywhere in this codebase.
export const getMyBusinessesController = async (req, res) => {
  try {
    if (req.user.role !== "operator") {
      return res.status(403).json({ message: "operator role required" });
    }
    const businesses = await Business.find({ ownerUserId: String(req.user._id) }).lean();
    res.status(200).json(businesses);
  } catch (error) {
    console.log("Error in getMyBusinesses controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
