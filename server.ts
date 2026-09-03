import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { apiRouter } from "./src/server/apiRouter.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

// 1. Top-Level Request Deserialization (MUST be mounted before any routes)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 2. Mount API Routes (under both root and /api for compatibility)
app.use(apiRouter);

async function startServer() {
  // Vite Middleware Setup for Dev / Cloud Run
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Express v4 wildcard route
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] ReflectAI running on http://0.0.0.0:${PORT}`);
  });
}

// Only start standalone server when run directly (not during Vercel serverless bundling)
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}
