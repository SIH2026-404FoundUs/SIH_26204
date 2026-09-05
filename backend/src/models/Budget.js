import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
  {
    // Request inputs
    travellers: {
      type: Number,
      required: true,
    },
    days: {
      type: Number,
      required: true,
    },
    budget: {
      type: Number,
      required: true,
    },
    transport: {
      mode: { type: String },
      totalCost: { type: Number, default: 0 },
    },
    hotel: {
      pricePerNight: { type: Number, default: 0 },
      nights: { type: Number, default: 0 },
    },
    food: {
      pricePerPersonPerDay: { type: Number, default: 0 },
    },
    activities: [
      {
        name: { type: String },
        pricePerPerson: { type: Number, default: 0 },
      },
    ],
    localTransport: {
      estimatedCost: { type: Number, default: 0 },
    },

    // Calculated outputs
    breakdown: {
      transport: { type: Number, default: 0 },
      hotel: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      activities: { type: Number, default: 0 },
      localTransport: { type: Number, default: 0 },
    },
    totalCost: {
      type: Number,
      required: true,
    },
    remaining: {
      type: Number,
      required: true,
    },
    utilizationPercent: {
      type: Number,
      required: true,
    },
    isOverBudget: {
      type: Boolean,
      required: true,
    },
    largestCategory: {
      type: String,
      default: null,
    },
  },
  { timestamps: true, bufferCommands: false }
);

const Budget = mongoose.model("Budget", budgetSchema);

export default Budget;
