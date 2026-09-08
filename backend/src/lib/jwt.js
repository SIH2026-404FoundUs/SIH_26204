import jwt from "jsonwebtoken";

// Frontend (Vercel) and backend (Render) live on different registrable
// domains in production -- sameSite:"strict" (or "lax") silently drops the
// cookie on every cross-site XHR/fetch, so the browser never sends it back
// and every request looks logged-out. "strict" only ever worked in local
// dev because localhost:5173 and localhost:5001 count as the same *site*
// (SameSite ignores port) despite being different origins. Cross-site
// cookies require sameSite:"none", which itself requires secure:true --
// both platforms serve over HTTPS by default, so this is safe to flip on
// NODE_ENV alone rather than needing a separate flag.
// Same condition the codebase already used for `secure` -- sameSite:"none"
// requires secure:true, so the two must always move together rather than
// being two independently-set flags that could drift apart.
const isSecureContext = process.env.NODE_ENV !== "development";
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true, // prevent XSS attacks cross-site scripting attacks
  sameSite: isSecureContext ? "none" : "strict", // CSRF attacks cross-site request forgery attacks
  secure: isSecureContext,
};

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // MS
  });

  return token;
};
