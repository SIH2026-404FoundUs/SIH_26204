import mongoose from "mongoose";

// BOOKINGS — a traveller's request to book an Available Services business
// (spec: "travellers must be able to book the service"). Two honest modes,
// decided at creation time (bookingController.js), never faked:
//  - a matching BusinessAvailability document exists for this business/date/
//    resourceType -> the booking atomically decrements its units.available
//    (same findOneAndUpdate-with-guard pattern offerService.claimOfferAtomic
//    already uses) and is created "confirmed" -- a real inventory hold.
//  - no such document exists (true today for almost every business, since
//    nothing in this codebase writes BusinessAvailability yet -- see
//    OperatorConsole.jsx) -> the booking is created "pending", an honest
//    request with no capacity data to confirm it against, not a fabricated
//    instant confirmation.
const bookingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    businessId: { type: String, required: true },
    destId: { type: String, required: true },
    date: { type: Date, required: true },
    resourceType: {
      type: String,
      enum: ["room", "table", "slot", "seat", "service"],
      required: true,
    },
    travellers: { type: Number, default: 1 },
    notes: { type: String },
    status: {
      type: String,
      enum: ["pending", "confirmed", "declined", "cancelled"],
      default: "pending",
    },
    availabilityMatched: { type: Boolean, default: false }, // true only when a real BusinessAvailability row backed the confirmation
  },
  { timestamps: true }
);

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ businessId: 1, date: 1 });

const Booking = mongoose.model("Booking", bookingSchema, "bookings");
export default Booking;
