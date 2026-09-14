import Booking from "../models/booking.model.js";
import Business from "../models/business.model.js";
import BusinessAvailability from "../models/businessAvailability.model.js";
import { sendMail } from "../lib/mailer.js";
import { bookingConfirmationEmail } from "../lib/emailTemplates.js";

// Business.type -> BusinessAvailability.resourceType. Same mapping a real
// operator-declared-availability row would use (businessAvailability.model.js's
// own enum), not invented for this endpoint alone.
const RESOURCE_TYPE_BY_BUSINESS_TYPE = {
  homestay: "room",
  guesthouse: "room",
  hotel: "room",
  restaurant: "table",
  guide: "service",
  driver: "service",
  cook: "service",
};

// POST /api/v1/bookings — a traveller booking an Available Services business
// (spec: "travellers must be able to book the service"). Two honest outcomes:
// if a real BusinessAvailability row exists for this business/date, the
// booking atomically claims one unit from it (same findOneAndUpdate-with-
// guard pattern claimOfferAtomic already uses) and comes back "confirmed";
// if none exists -- true for almost every business today, since nothing yet
// writes BusinessAvailability -- it's created "pending", a real request with
// no capacity data to confirm it against rather than a fabricated instant yes.
export const createBookingController = async (req, res) => {
  try {
    const { businessId, date, travellers, notes } = req.body;
    if (!businessId || !date) {
      return res.status(400).json({ message: "businessId and date are required" });
    }

    const business = await Business.findById(businessId).select("destId type name");
    if (!business) return res.status(404).json({ message: "business not found" });

    const resourceType = RESOURCE_TYPE_BY_BUSINESS_TYPE[business.type] || "service";
    const bookingDate = new Date(date);
    if (Number.isNaN(bookingDate.getTime())) {
      return res.status(400).json({ message: "date is invalid" });
    }

    const availability = await BusinessAvailability.findOneAndUpdate(
      { businessId, date: bookingDate, resourceType, "units.available": { $gt: 0 } },
      { $inc: { "units.available": -1 } },
      { new: true }
    );

    const booking = await Booking.create({
      userId: String(req.user._id),
      businessId,
      destId: business.destId,
      date: bookingDate,
      resourceType,
      travellers: Number(travellers) > 0 ? Number(travellers) : 1,
      notes: typeof notes === "string" ? notes.trim().slice(0, 500) : undefined,
      status: availability ? "confirmed" : "pending",
      availabilityMatched: !!availability,
    });

    // Best-effort, never blocks the response -- honestly reflects
    // confirmed vs pending (see this controller's own header comment).
    sendMail({
      to: req.user.email,
      ...bookingConfirmationEmail({ fullName: req.user.fullName, businessName: business.name, destId: business.destId, date: bookingDate, status: booking.status }),
    }).catch(() => {});

    res.status(201).json(booking);
  } catch (error) {
    console.log("Error in createBooking controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/bookings/mine — the traveller's own bookings.
export const getMyBookingsController = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: String(req.user._id) }).sort({ createdAt: -1 }).lean();
    res.status(200).json(bookings);
  } catch (error) {
    console.log("Error in getMyBookings controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/bookings/business/:businessId — an operator's incoming
// bookings for a business they own. Same ownership check as the waitlist/
// contact-reveal endpoints (businesses.controller.js/waitlist.controller.js).
export const getBusinessBookingsController = async (req, res) => {
  try {
    if (req.user.role !== "operator") {
      return res.status(403).json({ message: "operator role required" });
    }
    const business = await Business.findById(req.params.businessId).select("ownerUserId");
    if (!business) return res.status(404).json({ message: "business not found" });
    if (String(business.ownerUserId || "") !== String(req.user._id)) {
      return res.status(403).json({ message: "business owner role required" });
    }
    const bookings = await Booking.find({ businessId: req.params.businessId }).sort({ date: 1 }).select("-userId").lean();
    res.status(200).json(bookings);
  } catch (error) {
    console.log("Error in getBusinessBookings controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
