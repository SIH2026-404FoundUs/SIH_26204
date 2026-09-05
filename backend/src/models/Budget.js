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
      rooms: { type: Number, default: 1 },
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

    tripId: {
      type: String,
      default: null,
    },
    destId: {
      type: String,
      default: null,
    },

    // Calculated outputs
    costBreakdown: {
      transport: {
        amount: { type: Number, default: 0 },
        source: { type: String, default: "estimated" },
      },
      hotel: {
        amount: { type: Number, default: 0 },
        source: { type: String, default: "estimated" },
      },
      food: {
        amount: { type: Number, default: 0 },
        source: { type: String, default: "estimated" },
      },
      activities: {
        amount: { type: Number, default: 0 },
        source: { type: String, default: "estimated" },
      },
      localTransport: {
        amount: { type: Number, default: 0 },
        source: { type: String, default: "estimated" },
      },
    },
    totalCost: {
      type: Number,
      required: true,
    },
    contingency: {
      type: Number,
      required: true,
    },
    grandTotal: {
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
    reductionOptions: [
      {
        type: { type: String },
        description: { type: String },
      },
    ],
    largestCategory: {
      type: String,
      default: null,
    },
    hasUnlabelledEstimates: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, bufferCommands: false }
);

const Budget = mongoose.model("Budget", budgetSchema);

export default Budget;
