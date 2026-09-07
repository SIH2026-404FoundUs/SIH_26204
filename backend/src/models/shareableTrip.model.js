import mongoose from "mongoose";

// shareable_trips — read-only, revocable trip-sharing projections (spec §5.4).
// Deliberately holds only the fields shareableTripService.js's projection
// needs: no contact details, no payment info, no passwords.
const shareableTripSchema = new mongoose.Schema(
  {
    shareToken: { type: String, required: true, unique: true },
    tripId: { type: String, required: true },
    userId: { type: String, required: true },
    title: { type: String, default: "My Trip Itinerary" },
    destId: { type: String, required: true }, // Ananya's canonical slug
    startDate: Date,
    endDate: Date,
    stops: [
      {
        name: String,
        location: { lat: Number, lng: Number },
        dayIndex: Number,
      },
    ],
    isRevoked: { type: Boolean, default: false },
    revokedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

shareableTripSchema.index({ userId: 1 });

const ShareableTrip = mongoose.model("ShareableTrip", shareableTripSchema, "shareable_trips");
export default ShareableTrip;
