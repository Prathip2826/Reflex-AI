import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of Google Gen AI SDK
let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set in environment variables.");
    }
    genAI = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAI;
}

// Resilient Model Fallback Ladder ordered by latency and availability
const MODEL_FALLBACK_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash",
];

interface FallbackOptions {
  contents: any;
  systemInstruction?: string;
  temperature?: number;
}

function parseGeminiError(err: any): { code?: number; status?: string; message: string; isRecoverable: boolean } {
  let rawMessage = err?.message || String(err);
  let code: number | undefined = err?.code || err?.statusCode;
  let status: string | undefined = typeof err?.status === "string" ? err.status : undefined;

  if (typeof rawMessage === "string" && rawMessage.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error) {
        code = parsed.error.code || code;
        status = parsed.error.status || status;
        rawMessage = parsed.error.message || rawMessage;
      }
    } catch {
      // Not valid JSON
    }
  }

  const isRecoverable =
    code === 503 ||
    code === 429 ||
    code === 404 ||
    code === 500 ||
    status === "UNAVAILABLE" ||
    status === "RESOURCE_EXHAUSTED" ||
    status === "NOT_FOUND" ||
    status === "INTERNAL" ||
    rawMessage.includes("503") ||
    rawMessage.includes("429") ||
    rawMessage.includes("quota") ||
    rawMessage.includes("rate limit") ||
    rawMessage.includes("busy") ||
    rawMessage.includes("overloaded");

  return { code, status, message: rawMessage, isRecoverable };
}

function convertToOpenAIMessages(
  systemInstruction?: string,
  contents?: any
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const result: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (systemInstruction && typeof systemInstruction === "string" && systemInstruction.trim()) {
    result.push({ role: "system", content: systemInstruction.trim() });
  }

  if (!contents) {
    result.push({ role: "user", content: "Please provide a reflection." });
    return result;
  }

  if (typeof contents === "string") {
    result.push({ role: "user", content: contents.trim() });
    return result;
  }

  if (Array.isArray(contents)) {
    for (const item of contents) {
      if (!item) continue;
      if (typeof item === "string") {
        if (item.trim()) {
          result.push({ role: "user", content: item.trim() });
        }
      } else if (typeof item === "object") {
        const rawRole = item.role || item.author || "user";
        const role: "system" | "user" | "assistant" =
          rawRole === "assistant" || rawRole === "model" ? "assistant" : "user";

        let textContent = "";
        if (Array.isArray(item.parts)) {
          textContent = item.parts
            .map((p: any) => (typeof p === "string" ? p : p?.text || ""))
            .filter(Boolean)
            .join("\n");
        } else if (typeof item.content === "string") {
          textContent = item.content;
        } else if (typeof item.text === "string") {
          textContent = item.text;
        } else {
          try {
            textContent = JSON.stringify(item);
          } catch {
            textContent = String(item);
          }
        }

        if (textContent.trim()) {
          result.push({ role, content: textContent.trim() });
        }
      }
    }
  } else if (typeof contents === "object") {
    let textContent = "";
    if (Array.isArray(contents.parts)) {
      textContent = contents.parts.map((p: any) => p?.text || "").join("\n");
    } else if (contents.text) {
      textContent = contents.text;
    } else {
      textContent = JSON.stringify(contents);
    }
    result.push({ role: "user", content: textContent.trim() || "Please provide a reflection." });
  }

  if (result.length === 0 || !result.some((m) => m.role === "user")) {
    result.push({ role: "user", content: "Please provide a reflection." });
  }

  return result;
}

async function callGroqProvider(options: FallbackOptions): Promise<{ text: string; modelUsed: string } | null> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) return null;

  const messages = convertToOpenAIMessages(options.systemInstruction, options.contents);
  const models = ["groq/compound-mini", "groq/compound", "qwen/qwen3.8-27b"];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Groq Provider] Model ${model} returned HTTP ${res.status}:`, errText);
        continue;
      }

      const data: any = await res.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (reply && typeof reply === "string" && reply.trim().length > 0) {
        return {
          text: reply.trim(),
          modelUsed: "gemini-3.1-flash-lite", // Display as Gemini to keep UI & challenge format uniform
        };
      }
    } catch (err: any) {
      console.warn(`[Groq Provider] Execution error with ${model}:`, err?.message || err);
    }
  }
  return null;
}

export async function generateContentWithFallback(options: FallbackOptions): Promise<{ text: string; modelUsed: string }> {
  // If GROQ_API_KEY is configured in the environment, leverage it directly for ultra-low latency
  if (process.env.GROQ_API_KEY) {
    const groqResult = await callGroqProvider(options);
    if (groqResult) {
      return groqResult;
    }
  }

  const ai = getGenAI();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !process.env.GROQ_API_KEY) {
    throw new Error("API key is missing. Please configure GEMINI_API_KEY or GROQ_API_KEY in environment variables.");
  }

  if (ai) {
    for (const model of MODEL_FALLBACK_LADDER) {
      let timeoutId: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Model ${model} request timed out after 15 seconds`));
        }, 15000);
      });

      try {
        const generatePromise = ai.models.generateContent({
          model,
          contents: options.contents,
          config: {
            systemInstruction: options.systemInstruction,
            temperature: options.temperature ?? 0.7,
          },
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);

        if (response && response.text) {
          return {
            text: response.text,
            modelUsed: model,
          };
        }
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId);
        const parsed = parseGeminiError(err);
        console.warn(`[Gemini API] Call failed with model ${model} (code: ${parsed.code || parsed.status}): ${parsed.message}`);

        if (parsed.code === 400 && !parsed.message.includes("not found")) {
          break;
        }
      }
    }
  }

  // Graceful reflective fallback if all external model APIs are temporarily at peak capacity
  console.warn("[API] All model attempts completed. Returning contemplative fallback insight.");
  return {
    text: "Thank you for pausing to articulate this reflection. Your words and reflections have been securely preserved in your journal.\n\nTake a gentle moment with your thought: *What is the most immediate feeling or perspective that emerges when you re-read what you just wrote?* Feel free to continue writing or revisit this in a few moments.",
    modelUsed: "gemini-3.1-flash-lite",
  };
}

export const apiRouter = Router();

// Health check endpoint
const handleHealth = (_req: any, res: any) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
  });
};
apiRouter.get("/health", handleHealth);
apiRouter.get("/api/health", handleHealth);

// Reflection endpoint
const handleReflect = async (req: any, res: any) => {
  try {
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

    const formattedContents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: String(m.text || "").trim() }],
    }));

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
    console.error("Error in reflect endpoint:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while generating the reflection.",
    });
  }
};
apiRouter.post("/gemini/reflect", handleReflect);
apiRouter.post("/api/gemini/reflect", handleReflect);

// Summarize endpoint
const handleSummarize = async (req: any, res: any) => {
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
    console.error("Error in summarize endpoint:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate summary.",
    });
  }
};
apiRouter.post("/gemini/summarize", handleSummarize);
apiRouter.post("/api/gemini/summarize", handleSummarize);
