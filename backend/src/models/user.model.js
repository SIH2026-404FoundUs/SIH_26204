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
    preferredLanguage: {
      type: String,
    },
    // Email verification is a real gate, not cosmetic (auth spec §4): an
    // unverified account cannot log in (see login controller). Defaults to
    // false -- signup never sets this true itself, only a consumed
    // email_verify AuthToken does.
    emailVerified: {
      type: Boolean,
      default: false,
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
