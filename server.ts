import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { timing } from "hono/timing";
import { compress } from "hono/compress";
import { createBunWebSocket } from "hono/bun";
import type { ServerWebSocket } from "bun";

// Import routes
import userRoutes from "./routes/user.routes";
// Import middleware
import { errorHandler } from "./middlewares/error.middlewares";
// Import utils
import logger from "./utils/logger";
import { wsManager } from "./utils/websocket";

// Import config
import { DB } from "./config";
// Import compression config to load CompressionStream polyfill
import "./config/compress.config";

// Initialize database connection
DB();

const app = new Hono();
// Create WebSocket handlers
const { upgradeWebSocket, websocket } = createBunWebSocket();
// Middleware
app.use("*", honoLogger());
app.use("*", timing());
app.use("*", compress());
app.use("*", cors());

// WebSocket route
app.get(
  "/ws",
  upgradeWebSocket((c) => ({
    onOpen(c, ws) {
      const rawWs = ws.raw as ServerWebSocket;
      logger.info("WebSocket connection opened");
      wsManager.handleWebSocketUpgrade(rawWs);
    },
    async onMessage(evt, ws) {
      const rawWs = ws.raw as ServerWebSocket;
      let messageData: string;
      if (typeof evt.data === "string") {
        messageData = evt.data;
      } else if (evt.data instanceof Blob) {
        messageData = await evt.data.text();
      } else {
        messageData = evt.data.toString();
      }
      wsManager.handleWebSocketMessage(rawWs, messageData);
    },
    onClose(c, ws) {
      const rawWs = ws.raw as ServerWebSocket;
      logger.info("WebSocket connection closed");
      wsManager.handleWebSocketClose(rawWs, 1000, "Connection closed");
    },
  }))
);

// Routes
app.route("/api/v1/users", userRoutes);

// Error handler
app.onError(errorHandler);

// Health check
app.get("/", (c) => {
  return c.json({ message: "Donation Delight API V1", status: "running" });
});

// Initialize WebSocket manager
wsManager.initialize(null);

// Create server with WebSocket support
const server = Bun.serve({
  port: parseInt(process.env.PORT || "8000"),
  fetch: app.fetch,
  websocket,
});

logger.info(`Server running on port ${process.env.PORT || "8000"}`);

// Export for both Bun and Cloudflare Workers
export default {
  port: parseInt(process.env.PORT || "8000"),
  fetch: app.fetch,
};
