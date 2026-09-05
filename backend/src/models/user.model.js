import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["traveller", "operator", "authority"],
      default: "traveller",
    },
    phone: {
      type: String,
    },
    preferences: {
      interests: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      budgetBand: {
        type: String,
      },
      languages: {
        type: [String],
        default: [],
      },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;