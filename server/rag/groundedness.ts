import { RetrievedChunk } from "./vectorstore";
import { REASONING_MODEL, callGeminiWithTimeout } from "../gemini";

export const GROUNDEDNESS_TIMEOUT_MS = 7500;

export interface GroundednessResult {
  isFullyGrounded: boolean;
  hasSufficientContext: boolean;
  confidence: "high" | "medium" | "low";
  confidenceScore: number; // 0 to 100
  supportedClaims: string[];
  unsupportedClaims: string[];
  groundingAudit: string;
  latencyMs: number;
  isFallback?: boolean;
}

/**
 * Step 6: Groundedness & Hallucination Audit
 * Evaluates whether the actual synthesized answer directly traces to the retrieved chunks,
 * flagging or scoring any unsupported claims. Runs exactly once on the final answer.
 */
export async function auditGroundedness(
  question: string,
  draftAnswer: string,
  chunks: RetrievedChunk[]
): Promise<GroundednessResult> {
  const startTime = Date.now();

  // If no chunks retrieved or empty text
  if (chunks.length === 0 || !chunks.some((c) => c.text && c.text.trim().length > 10)) {
    return {
      isFullyGrounded: false,
      hasSufficientContext: false,
      confidence: "low",
      confidenceScore: 10,
      supportedClaims: [],
      unsupportedClaims: ["All claims lack grounding in the knowledge base"],
      groundingAudit: "Zero relevant chunks retrieved from the vector knowledge base.",
      latencyMs: Date.now() - startTime,
      isFallback: false,
    };
  }

  try {
    const chunksContext = chunks
      .map((c, idx) => `[Citation ${idx + 1}] (From ${c.docName}, p.${c.page}):\n${c.text}`)
      .join("\n\n");

    const prompt = `You are a strict Groundedness & Anti-Hallucination Verifier in a production RAG system.
User Question: "${question}"
Candidate Answer: "${draftAnswer}"

Ground Truth Context:
${chunksContext}

Evaluate:
1. Does the ground truth context contain enough factual information to answer the question?
2. Does every sentence or factual assertion in the Candidate Answer trace directly to at least one Citation chunk?
3. Are there any unsupported extrapolations, external assumptions, or hallucinations?
4. Determine confidence rating ("high", "medium", "low") and numeric score (0 to 100):
   - "high" (80-100): Every claim is explicitly stated in the context chunks.
   - "medium" (50-79): Mostly supported, but minor extrapolation or slight ambiguity in source.
   - "low" (0-49): Question is unanswerable from the context or claims lack direct support.

Return strictly JSON format:
{
  "hasSufficientContext": true,
  "isFullyGrounded": true,
  "confidence": "high",
  "confidenceScore": 95,
  "supportedClaims": ["Claim 1 with reference", "Claim 2 with reference"],
  "unsupportedClaims": [],
  "groundingAudit": "Clear, direct textual support for all claims across citations [1] and [2]."
}`;

    const response = await callGeminiWithTimeout(async (ai) => {
      return ai.models.generateContent({
        model: REASONING_MODEL,
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      });
    }, GROUNDEDNESS_TIMEOUT_MS, REASONING_MODEL);

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim() || "{}");
      const confidence = (parsed.confidence as "high" | "medium" | "low") || "medium";
      const confidenceScore = typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 85;

      return {
        isFullyGrounded: parsed.isFullyGrounded ?? (confidence === "high"),
        hasSufficientContext: parsed.hasSufficientContext ?? true,
        confidence,
        confidenceScore,
        supportedClaims: parsed.supportedClaims || [],
        unsupportedClaims: parsed.unsupportedClaims || [],
        groundingAudit: parsed.groundingAudit || "Verified against retrieved source chunks.",
        latencyMs: Date.now() - startTime,
        isFallback: false,
      };
    }
  } catch (err: any) {
    console.warn(`[Groundedness] Step fallback triggered: ${err?.message || "timeout/error"}`);
  }

  // Algorithmic grounding check
  const allContext = chunks.map((c) => c.text.toLowerCase()).join(" ");
  const sentences = draftAnswer.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const supported: string[] = [];
  const unsupported: string[] = [];

  for (const s of sentences) {
    const keyWords = s.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const matchedCount = keyWords.filter((w) => allContext.includes(w)).length;
    const ratio = keyWords.length > 0 ? matchedCount / keyWords.length : 0;
    if (ratio >= 0.5) {
      supported.push(s.trim());
    } else {
      unsupported.push(s.trim());
    }
  }

  const score = sentences.length > 0 ? Math.round((supported.length / sentences.length) * 100) : 50;
  const confidence = score >= 80 ? "high" : score >= 50 ? "medium" : "low";

  return {
    isFullyGrounded: unsupported.length === 0,
    hasSufficientContext: supported.length > 0,
    confidence,
    confidenceScore: score,
    supportedClaims: supported,
    unsupportedClaims: unsupported,
    groundingAudit: `Algorithmic lexical verification: ${supported.length}/${sentences.length} sentences grounded in evidence.`,
    latencyMs: Date.now() - startTime,
    isFallback: true,
  };
}
