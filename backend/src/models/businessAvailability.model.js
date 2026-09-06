import mongoose from "mongoose";

const businessAvailabilitySchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  businessId: {
    type: String,
    ref: "Business",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  resourceType: {
    type: String,
    enum: ["room", "table", "slot", "seat", "service"],
    required: true,
  },
  units: {
    total: { type: Number, required: true },
    available: { type: Number, required: true },
  },
  pricePerNight: {
    type: Number,
  },
  discountPct: {
    type: Number,
    max: 40,
  },
  isOpen: {
    type: Boolean,
  },
  source: {
    type: String,
    enum: ["business_declared"],
    default: "business_declared",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

businessAvailabilitySchema.index(
  { businessId: 1, date: 1, resourceType: 1 },
  { unique: true }
);

const BusinessAvailability = mongoose.model(
  "BusinessAvailability",
  businessAvailabilitySchema
);

export default BusinessAvailability;
