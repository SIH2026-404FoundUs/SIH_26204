// Small role gate for routes that need more than "logged in" -- authority
// dashboard endpoints being the first consumer. Always mount AFTER
// protectRoute: this reads req.user, which only protectRoute sets, and
// assumes authentication was already checked (a missing/invalid token is a
// 401 from protectRoute, never a 403 from here).
//
// Frontend role-hiding (RequireRole in components/shell/Guards.jsx) is UX
// only. This is the actual authorization boundary -- a traveller or operator
// account, or anyone unauthenticated, gets rejected here regardless of what
// the client sent or what the UI would have shown them.
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized - No Token Provided" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: `${roles.join(" or ")} role required` });
  }
  next();
};
