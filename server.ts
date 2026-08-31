import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialization of Google Gen AI SDK
let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set in environment variables.");
    }
    genAI = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return genAI;
}

// Resilient Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];

interface FallbackOptions {
  contents: any;
  systemInstruction?: string;
  temperature?: number;
}

async function generateContentWithFallback(options: FallbackOptions) {
  const ai = getGenAI();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Please configure your API key in the environment or Secrets.");
  }

  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.7,
        },
      });

      if (response && response.text) {
        return {
          text: response.text,
          modelUsed: model,
        };
      }
    } catch (err: any) {
      console.warn(`[Gemini API] Call failed with model ${model}:`, err?.message || err);
      lastError = err;

      // Check if error is recoverable (429, 503, 404, 500)
      const status = err?.status || err?.statusCode || (err?.message?.includes("404") ? 404 : null);
      if (status === 400 && !err?.message?.includes("not found")) {
        // Non-recoverable client request error
        break;
      }
      // Otherwise continue to next model in ladder
    }
  }

  throw new Error(
    lastError?.message || "Failed to generate reflection from Gemini after attempting all fallback models."
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Top-Level Request Deserialization (MUST be mounted before any routes)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // 2. Gemini Multi-turn Reflection Endpoint
  app.post("/api/gemini/reflect", async (req, res) => {
    try {
      // Defensive null-safe payload destructuring
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const {
        messages = [],
        mode = "reflect",
        title = "",
        mood = "Thoughtful",
      } = body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          error: "Invalid payload: 'messages' array cannot be empty.",
        });
      }

      // Format conversation turns for the Gemini API
      const formattedContents = messages.map((m: { role: string; text: string }) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: String(m.text || "").trim() }],
      }));

      // Role-specific system instructions
      const systemInstruction = `You are a supportive, insightful, and introspective Journaling & Reflection Companion powered by Gemini.
The user is writing personal reflections, thoughts, questions, or ideas.
Context:
- Entry Title (if provided): "${title || "Untitled Reflection"}"
- Current Focus / Mood: "${mood}"
- Interaction Mode: "${mode}"

Guidelines:
1. Always maintain a warm, non-judgmental, encouraging, and psychologically safe tone.
2. In 'reflect' mode: Provide deep, empathetic insights, highlight hidden patterns or strengths, and ask 1-2 thoughtful, probing questions to help the user explore further.
3. In 'summary' mode: Provide a clear synthesis with key themes, emotional highlights, and concise bullet takeaways.
4. In 'brainstorm' mode: Provide 3-4 creative, actionable, and gentle next steps or fresh perspectives.
5. In 'mindfulness' mode: Offer cognitive reframing, grounded gratitude, and calming perspectives.
6. Format your response cleanly using markdown (bolding, lists, and subtle paragraphs). Keep responses focused, articulate, and digestible (around 150-300 words unless more detail is requested).`;

      const result = await generateContentWithFallback({
        contents: formattedContents,
        systemInstruction,
        temperature: 0.7,
      });

      return res.json({
        reply: result.text,
        modelUsed: result.modelUsed,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error in /api/gemini/reflect:", error);
      return res.status(500).json({
        error: error.message || "An error occurred while generating the reflection.",
      });
    }
  });

  // 3. Quick Summarize & Insights Endpoint
  app.post("/api/gemini/summarize", async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const { text = "", title = "" } = body;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({
          error: "Invalid payload: 'text' string is required.",
        });
      }

      const prompt = `Please provide a concise summary and 3 key takeaways for this journal reflection:
Entry Title: "${title || "Reflection"}"
Content:
"""
${text.trim()}
"""

Format cleanly with:
### 📌 Core Essence
(1-2 sentences capturing the heart of the reflection)

### 💡 Key Insights
- Takeaway 1
- Takeaway 2
- Takeaway 3

### 🌱 Actionable Micro-Step
(One small step to move forward with clarity)`;

      const result = await generateContentWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: "You are an expert executive coach and mindfulness facilitator. Provide crystal-clear, uplifting, and actionable summaries.",
        temperature: 0.5,
      });

      return res.json({
        summary: result.text,
        modelUsed: result.modelUsed,
      });
    } catch (error: any) {
      console.error("Error in /api/gemini/summarize:", error);
      return res.status(500).json({
        error: error.message || "Failed to generate summary.",
      });
    }
  });

  // Vite Middleware Setup
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

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
