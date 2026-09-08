import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import express from "express";
import whatsappWebhookRoutes from "./whatsappWebhook.route.js";

const FAKE_TOKEN = "test-verify-token-12345";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/webhook/whatsapp", whatsappWebhookRoutes);
  return app;
}

describe("GET /api/webhook/whatsapp (Meta verification handshake)", () => {
  const originalToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = FAKE_TOKEN;
  });

  afterEach(() => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = originalToken;
  });

  test("correct mode + verify_token: responds 200 with hub.challenge echoed as plain text", async () => {
    const app = createTestApp();
    const server = app.listen(0);

    try {
      const { port } = server.address();
      const url =
        `http://127.0.0.1:${port}/api/webhook/whatsapp` +
        `?hub.mode=subscribe&hub.verify_token=${FAKE_TOKEN}&hub.challenge=1234567890`;

      const response = await fetch(url);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toBe("1234567890");
      expect(response.headers.get("content-type")).toMatch(/text\/plain/);
    } finally {
      server.close();
    }
  });

  test("wrong verify_token: responds 403, does not echo the challenge", async () => {
    const app = createTestApp();
    const server = app.listen(0);

    try {
      const { port } = server.address();
      const url =
        `http://127.0.0.1:${port}/api/webhook/whatsapp` +
        `?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=1234567890`;

      const response = await fetch(url);
      const body = await response.text();

      expect(response.status).toBe(403);
      expect(body).not.toBe("1234567890");
    } finally {
      server.close();
    }
  });

  test("correct token but wrong hub.mode: responds 403", async () => {
    const app = createTestApp();
    const server = app.listen(0);

    try {
      const { port } = server.address();
      const url =
        `http://127.0.0.1:${port}/api/webhook/whatsapp` +
        `?hub.mode=unsubscribe&hub.verify_token=${FAKE_TOKEN}&hub.challenge=1234567890`;

      const response = await fetch(url);

      expect(response.status).toBe(403);
    } finally {
      server.close();
    }
  });

  test("missing hub.verify_token entirely: responds 403", async () => {
    const app = createTestApp();
    const server = app.listen(0);

    try {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}/api/webhook/whatsapp?hub.mode=subscribe&hub.challenge=1234567890`;

      const response = await fetch(url);

      expect(response.status).toBe(403);
    } finally {
      server.close();
    }
  });

  test("server has no configured token at all: responds 403 even if the request also omits one (fail closed, never match on both-undefined)", async () => {
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    const app = createTestApp();
    const server = app.listen(0);

    try {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}/api/webhook/whatsapp?hub.mode=subscribe&hub.challenge=1234567890`;

      const response = await fetch(url);

      expect(response.status).toBe(403);
    } finally {
      server.close();
    }
  });
});

describe("POST /api/webhook/whatsapp (inbound message delivery)", () => {
  test("always responds 200, even for an empty/malformed body — Meta requires a fast 200 regardless of processing outcome", async () => {
    const app = createTestApp();
    const server = app.listen(0);

    try {
      const { port } = server.address();

      const response = await fetch(`http://127.0.0.1:${port}/api/webhook/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ not: "a real webhook payload" }),
      });

      expect(response.status).toBe(200);
    } finally {
      server.close();
    }
  });

  test("responds 200 for an empty body too", async () => {
    const app = createTestApp();
    const server = app.listen(0);

    try {
      const { port } = server.address();

      const response = await fetch(`http://127.0.0.1:${port}/api/webhook/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
    } finally {
      server.close();
    }
  });
});
