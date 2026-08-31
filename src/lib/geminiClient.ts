import type { ChatTurn, ReflectionMode, MoodCategory } from '../types';

interface ReflectRequestParams {
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  mode?: ReflectionMode;
  title?: string;
  mood?: MoodCategory;
}

interface ReflectResponse {
  reply: string;
  modelUsed: string;
  timestamp: string;
}

interface SummarizeResponse {
  summary: string;
  modelUsed: string;
}

export async function requestGeminiReflection(params: ReflectRequestParams): Promise<ReflectResponse> {
  const response = await fetch('/api/gemini/reflect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate reflection from Gemini.';
    try {
      const errJson = await response.json();
      if (errJson.error) {
        errorMsg = errJson.error;
      }
    } catch {
      // response not json
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function requestGeminiSummary(text: string, title?: string): Promise<SummarizeResponse> {
  const response = await fetch('/api/gemini/summarize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, title }),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate summary from Gemini.';
    try {
      const errJson = await response.json();
      if (errJson.error) {
        errorMsg = errJson.error;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
