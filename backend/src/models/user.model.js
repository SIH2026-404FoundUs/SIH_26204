import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
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
    // Cloudinary secure URL -- same upload mechanism as community-submission
    // photos (backend/src/lib/cloudinary.js), different folder. null means
    // "no photo set", not "loading" -- the frontend falls back to a generic
    // avatar icon in that case.
    profilePhoto: {
      type: String,
      default: null,
    },
    preferredLanguage: {
      type: String,
    },
    // Bumped on password reset and password change so any JWT issued before
    // that moment stops working -- a plain JWT has no server-side revocation
    // otherwise. protectRoute checks this against the token's own embedded
    // value (auth spec §12/§16: "invalidate existing sessions... where the
    // architecture supports it").
    tokenVersion: {
      type: Number,
      default: 0,
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
