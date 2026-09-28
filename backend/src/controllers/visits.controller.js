import { verifyVisit, generateCurrentOperatorCode } from "../services/pov/povService.js";
import Business from "../models/business.model.js";
import Visit from "../models/visit.model.js";
import AuditLog from "../models/auditLog.model.js";
import { logger } from "../lib/logger.js";

const models = { BusinessModel: Business, VisitModel: Visit, AuditLogModel: AuditLog };

// POST /api/v1/visits/verify (spec §1.2). userId comes from the session, never
// the request body — client-supplied identity is exactly what mutual attestation
// is designed to not trust.
export const verifyVisitController = async (req, res) => {
  try {
    const { businessId, code, currentLocation, referrerId, originalDestId } = req.body;
    const result = await verifyVisit(
      { userId: String(req.user._id), businessId, code, currentLocation, referrerId, originalDestId },
      models
    );
    res.status(result.code ?? (result.status === "verified" ? 200 : 400)).json(result);
  } catch (error) {
    logger.error("Error in verifyVisit controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/visits/operator-code/:businessId — the operator's own display
// device (spec §1.1). Deliberately unauthenticated: this code is meant to be
// shown on a screen the traveller reads, not a secret in itself.
export const getOperatorCodeController = async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId).select("+povSecret");
    if (!business || !business.povSecret) {
      return res.status(404).json({ message: "business not found or has no PoV secret configured" });
    }
    res.status(200).json(generateCurrentOperatorCode(business.povSecret, business._id));
  } catch (error) {
    logger.error("Error in getOperatorCode controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
