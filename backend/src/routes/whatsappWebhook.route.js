import express from "express";
import { verifyWebhook, receiveWebhook } from "../controllers/whatsappWebhook.controller.js";

const router = express.Router();

// GET /api/webhook/whatsapp — Meta's verification handshake.
router.get("/", verifyWebhook);

// POST /api/webhook/whatsapp — inbound message delivery.
router.post("/", receiveWebhook);

export default router;
