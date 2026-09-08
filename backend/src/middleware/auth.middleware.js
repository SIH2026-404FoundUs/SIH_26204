import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No Token Provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // QA finding (brutal-qa-report.md, P1): jwt.verify() THROWS on a
      // malformed/tampered/expired token -- it never returns a falsy value,
      // so the `if (!decoded)` check below this used to be dead code, and
      // every bad-token request fell through to the generic catch-all as a
      // 500. A bad token is caller error, not a server fault -- confirmed
      // live this affects every protectRoute-guarded endpoint in the app.
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Authentication service temporarily unavailable" });
    }

    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // A password reset or change bumps user.tokenVersion so every token
    // issued before that moment stops working (auth spec §12/§16) -- a
    // mismatch here means this cookie predates the user's most recent
    // credential change. Sessions from before this feature shipped (no
    // tokenVersion in the token at all) also fail this check by design: a
    // one-time forced re-login is the correct, safe outcome for a token this
    // check can't otherwise vouch for.
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: "Unauthorized - Session no longer valid, please sign in again" });
    }

    req.user = user;

    next();
  } catch (error) {
    console.log("Error in protectRoute middleware: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
