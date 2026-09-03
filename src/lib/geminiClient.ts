import type { ReflectionMode, MoodCategory } from '../types';

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

// Resilient fetch wrapper with per-request timeout and automated retry
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  timeoutMs = 25000
): Promise<Response> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // If server returns 502/503/504, retry if attempts remain
      if ((response.status === 503 || response.status === 502 || response.status === 504) && attempt < maxRetries) {
        console.warn(`[Client] Server returned status ${response.status}. Retrying attempt ${attempt + 1}/${maxRetries}...`);
        await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      console.warn(`[Client] Fetch error on attempt ${attempt + 1}/${maxRetries + 1}:`, err?.message || err);

      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
      }
    }
  }

  throw new Error(
    lastError?.name === 'AbortError'
      ? 'The reflection request took too long. Please try again.'
      : lastError?.message === 'Failed to fetch'
      ? 'Network connection issue while connecting to the reflection service. Please check your connection and retry.'
      : lastError?.message || 'Failed to connect to the Gemini service.'
  );
}

export async function requestGeminiReflection(params: ReflectRequestParams): Promise<ReflectResponse> {
  const response = await fetchWithRetry('/api/gemini/reflect', {
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
      if (typeof errJson.error === 'string') {
        // If the error message is a stringified JSON
        if (errJson.error.trim().startsWith('{')) {
          try {
            const nested = JSON.parse(errJson.error);
            errorMsg = nested?.error?.message || nested?.message || errJson.error;
          } catch {
            errorMsg = errJson.error;
          }
        } else {
          errorMsg = errJson.error;
        }
      } else if (errJson.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      // response not json
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function requestGeminiSummary(text: string, title?: string): Promise<SummarizeResponse> {
  const response = await fetchWithRetry('/api/gemini/summarize', {
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
      if (typeof errJson.error === 'string') {
        if (errJson.error.trim().startsWith('{')) {
          try {
            const nested = JSON.parse(errJson.error);
            errorMsg = nested?.error?.message || nested?.message || errJson.error;
          } catch {
            errorMsg = errJson.error;
          }
        } else {
          errorMsg = errJson.error;
        }
      } else if (errJson.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
