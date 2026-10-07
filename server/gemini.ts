import { GoogleGenAI } from "@google/genai";

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "gemini-embedding-2-preview";
export const REASONING_MODEL = process.env.REASONING_MODEL || "gemini-3.8-flash";

let aiClient: GoogleGenAI | null = null;
let hasAuthFailure = false;

export function getGeminiClient(): GoogleGenAI | null {
  if (hasAuthFailure) return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
    });
  }
  return aiClient;
}

/**
 * Identify if an error specifically indicates model deprecation,
 * non-existence, or 404 not found, as distinct from transient rate limits.
 */
export function isModelNotFoundError(err: any): boolean {
  if (!err) return false;
  const status = err?.status || err?.statusCode || err?.code;
  const message = String(err?.message || err?.error?.message || "").toLowerCase();
  return (
    status === 404 ||
    message.includes("not found") ||
    message.includes("not supported") ||
    message.includes("deprecated") ||
    message.includes("is not found for api version") ||
    message.includes("invalid model") ||
    message.includes("unrecognized model")
  );
}

/**
 * Execute Gemini model call with a strict timeout so the RAG pipeline
 * never hangs or stalls the UI under latency spikes.
 */
export async function callGeminiWithTimeout(
  fn: (ai: GoogleGenAI) => Promise<any>,
  timeoutMs: number = 7000,
  modelName: string = REASONING_MODEL
): Promise<any | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  try {
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );
    const result = await Promise.race([fn(ai), timeoutPromise]);
    return result;
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.includes("UNAUTHENTICATED")) {
      console.warn("Gemini API key returned 401 unauthenticated, disabling AI client for deterministic local fallbacks.");
      hasAuthFailure = true;
    } else if (isModelNotFoundError(err)) {
      console.warn(
        `[Gemini Model Error] Model "${modelName}" appears unavailable — check if it has been renamed/deprecated or if credentials lack access:`,
        err?.message || err
      );
    } else {
      console.warn("Gemini call warning:", err?.message || err);
    }
    return null;
  }
}
