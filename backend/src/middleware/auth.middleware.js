import jwt from "jsonwebtoken";
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

    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;

    next();
  } catch (error) {
    console.log("Error in protectRoute middleware: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
