import { RetrievedChunk } from "./vectorstore";
import { REASONING_MODEL, callGeminiWithTimeout } from "../gemini";
import { extractInformativeTerms, checkChunkTermMatches } from "./lexicalUtils";

export const DECOMPOSITION_TIMEOUT_MS = 7500;
export const SCRATCHPAD_TIMEOUT_MS = 8000;

export interface DecompositionResult {
  isDecomposed: boolean;
  triggerReason?: string;
  subQuestions: string[];
  latencyMs: number;
  isFallback?: boolean;
}

export interface ScratchpadReasoningResult {
  evidenceAnalysis: Array<{
    chunkId: string;
    docName: string;
    page: number;
    supports: string;
  }>;
  conflictsOrNuances: string[];
  evidenceGaps: string[];
  summaryTrace: string[];
  relevantChunkIds?: string[];
  questionAddressed?: boolean;
  verdictSource?: "llm" | "heuristic";
  latencyMs: number;
  isFallback?: boolean;
}

const COMPARISON_REGEX = /\b(compare|difference|differ|versus|vs\.?|both|and also|between|before and after|earlier vs later|update|changed|revision|either|as well as|what about)\b/i;

/**
 * Step 1: Query Decomposition
 * Evaluates whether question has multi-part/multi-hop requirements.
 * Generalized across arbitrary domains — no hardcoded demo document names.
 */
export async function decomposeQuery(question: string): Promise<DecompositionResult> {
  const startTime = Date.now();
  const trimmed = question.trim();
  const hasComparisonWord = COMPARISON_REGEX.test(trimmed);
  const hasMultipleClauses = trimmed.includes("?") && trimmed.indexOf("?") !== trimmed.lastIndexOf("?");
  const hasAndSplit = /\b(as well as|and also|what about)\b/i.test(trimmed);

  const shouldDecompose = hasComparisonWord || hasMultipleClauses || hasAndSplit;

  if (!shouldDecompose) {
    return {
      isDecomposed: false,
      subQuestions: [trimmed],
      latencyMs: Date.now() - startTime,
      isFallback: false,
    };
  }

  try {
    const prompt = `You are the Query Decomposition layer in an advanced RAG system.
User question: "${trimmed}"

Determine if this question is multi-hop, comparative, or multi-part.
If yes:
1. Identify the trigger reason (e.g., "Comparative analysis between entities", "Multi-hop conditions").
2. Split it into 2 to 4 focused, self-contained sub-questions that need to be retrieved independently to build the full evidence base.
If no, return isDecomposed: false.

Return strictly JSON format:
{
  "isDecomposed": true,
  "triggerReason": "Comparison between entities/policies detected",
  "subQuestions": ["sub-question 1", "sub-question 2"]
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
    }, DECOMPOSITION_TIMEOUT_MS, REASONING_MODEL);

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim() || "{}");
      return {
        isDecomposed: parsed.isDecomposed ?? true,
        triggerReason: parsed.triggerReason || "Multi-entity / comparative query detected",
        subQuestions: Array.isArray(parsed.subQuestions) && parsed.subQuestions.length > 0
          ? parsed.subQuestions
          : [trimmed],
        latencyMs: Date.now() - startTime,
        isFallback: false,
      };
    }
  } catch (err: any) {
    console.warn(`[Reasoning] Step fallback triggered for decomposition: ${err?.message || "timeout/error"}`);
  }

  // Heuristic rule-based decomposition fallback (generalized, no document-specific hardcoding)
  let subQuestions: string[] = [];
  if (hasComparisonWord || hasAndSplit) {
    const cleaned = trimmed.replace(/^(can you|please|how do|what is|what are|explain|tell me)\s+/i, "");
    const parts = cleaned.split(/\b(?:and also|as well as|\bversus\b|\bvs\.?\b|\bbetween\b|\bcompared to\b|\band\b)\b/i)
      .map((p) => p.replace(/[?.,]/g, "").trim())
      .filter((p) => p.length > 4);

    if (parts.length >= 2) {
      subQuestions = parts.map((p) => `What are the requirements and policies regarding ${p}?`);
    }
  } else if (hasMultipleClauses) {
    const clauses = trimmed.split("?").map((c) => c.trim()).filter((c) => c.length > 5);
    if (clauses.length >= 2) {
      subQuestions = clauses.map((c) => (c.endsWith("?") ? c : `${c}?`));
    }
  }

  if (subQuestions.length === 0) {
    subQuestions = [trimmed];
  }

  return {
    isDecomposed: subQuestions.length > 1,
    triggerReason: "Comparative or multi-hop syntactic pattern detected",
    subQuestions,
    latencyMs: Date.now() - startTime,
    isFallback: true,
  };
}

/**
 * Step 2: Reasoning Scratchpad over evidence
 * Explicitly analyzes what each retrieved chunk supports, surfaces contradictions or nuances, and notes gaps.
 */
export async function generateScratchpadReasoning(
  question: string,
  subQuestions: string[],
  chunks: RetrievedChunk[]
): Promise<ScratchpadReasoningResult> {
  const startTime = Date.now();

  if (chunks.length === 0) {
    return {
      evidenceAnalysis: [],
      conflictsOrNuances: ["No evidence retrieved from the knowledge base."],
      evidenceGaps: ["Entire context is missing for this query."],
      summaryTrace: [
        "Vector search returned 0 matching chunks meeting similarity threshold.",
        "Grounding verification halted: Knowledge base has no relevant documentation.",
      ],
      relevantChunkIds: [],
      questionAddressed: false,
      verdictSource: "heuristic",
      latencyMs: Date.now() - startTime,
      isFallback: false,
    };
  }

  try {
    const chunksContext = chunks
      .map(
        (c, i) =>
          `[Chunk ${i + 1}] (Document: ${c.docName}, Page: ${c.page}, Section: ${c.section}, ID: ${c.id}):\n"${c.text}"`
      )
      .join("\n\n");
    const prompt = `You are the AI Reasoning Layer of an enterprise RAG system.
User Question: "${question}"
Sub-questions: ${JSON.stringify(subQuestions)}

Retrieved chunks:
${chunksContext}

Perform a rigorous reasoning and relevance evaluation over the evidence:
1. For each chunk, state what factual claim or condition it directly supports.
2. Identify any contradictions, scoping nuances, or temporal differences between chunks (e.g. baseline vs revisions). If there is a conflict or nuance, surface it explicitly.
3. Identify any evidence gaps (what part of the user question is NOT covered by the chunks).
4. RELEVANCE VERDICT & CHUNK SELECTION:
   - Identify which chunk numbers (e.g. ["1", "2"] for [Chunk 1], [Chunk 2]) genuinely contain factual evidence to answer the question.
   - Set "questionAddressed": <boolean> — do the relevant chunks, taken together, actually answer what was asked, even partially?
   - CRITICAL ANTI-HALLUCINATION REQUIREMENT: If the retrieved chunks are topically adjacent or share surface vocabulary (e.g. general terms like "online", "policy", "purchase", "shopping") but DO NOT actually address the specific question asked (for example: comparing online vs offline shopping when chunks only discuss return windows for an online retailer; or asking about travel when chunks only cover software licenses), you MUST set "questionAddressed": false and set "relevantChunkIds": []. Do NOT force an answer when genuine facts addressing the question are absent.
5. Provide a high-level summary reasoning trace (3-5 concise bullet points) explaining your evaluation and whether the question is addressed.

Return strictly JSON:
{
  "evidenceAnalysis": [
    { "chunkId": "1", "docName": "doc.pdf", "page": 1, "supports": "Supports specific policy requirement" }
  ],
  "conflictsOrNuances": ["Nuance or distinction between retrieved chunks"],
  "evidenceGaps": ["Does not contain information on offline retail stores"],
  "summaryTrace": [
    "Evaluated query against retrieved evidence",
    "Retrieved chunks discuss return policies but lack information on offline retail shopping",
    "Evidence does not address the question asked"
  ],
  "relevantChunkIds": ["1", "2"],
  "questionAddressed": true
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
    }, SCRATCHPAD_TIMEOUT_MS, REASONING_MODEL);

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim() || "{}");
      const relevantChunkIds: string[] = Array.isArray(parsed.relevantChunkIds)
        ? parsed.relevantChunkIds.map(String)
        : [];
      const questionAddressed: boolean =
        typeof parsed.questionAddressed === "boolean"
          ? parsed.questionAddressed
          : relevantChunkIds.length > 0;

      return {
        evidenceAnalysis: parsed.evidenceAnalysis || [],
        conflictsOrNuances: parsed.conflictsOrNuances || [],
        evidenceGaps: parsed.evidenceGaps || [],
        summaryTrace: parsed.summaryTrace || [],
        relevantChunkIds,
        questionAddressed,
        verdictSource: "llm",
        latencyMs: Date.now() - startTime,
        isFallback: false,
      };
    }
  } catch (err: any) {
    console.warn(`[Reasoning] Step fallback triggered for scratchpad: ${err?.message || "timeout/error"}`);
  }

  // Deterministic scratchpad fallback with lightweight heuristic relevance check
  const informativeTerms = extractInformativeTerms(question);

  // Check each chunk for verbatim presence of primary query informative terms
  const chunkRelevanceInfo = chunks.map((c, i) => {
    const matchedTerms = checkChunkTermMatches(c.text, informativeTerms);
    const chunkId = String(i + 1);
    return {
      chunkId,
      chunk: c,
      matchedTerms,
      isRelevant: matchedTerms.length > 0,
    };
  });

  const relevantChunks = chunkRelevanceInfo.filter((info) => info.isRelevant);
  const relevantChunkIds = relevantChunks.map((info) => info.chunkId);

  // questionAddressed is false if zero chunks contain any informative term from the primary query
  const questionAddressed = informativeTerms.length > 0
    ? relevantChunkIds.length > 0
    : false;

  const evidenceAnalysis = relevantChunks.map((info) => ({
    chunkId: info.chunkId,
    docName: info.chunk.docName,
    page: info.chunk.page,
    supports: `Direct evidence matching term(s) [${info.matchedTerms.join(", ")}] in ${info.chunk.docName} (p.${info.chunk.page}, ${info.chunk.section})`,
  }));

  const conflictsOrNuances = !questionAddressed
    ? ["Heuristic evaluation detected no retrieved chunks containing informative terms from the query."]
    : [];

  const evidenceGaps = !questionAddressed
    ? [`Query terms [${informativeTerms.join(", ")}] not found in retrieved knowledge base passages.`]
    : [];

  const summaryTrace = [
    subQuestions.length > 1
      ? `Decomposed question into ${subQuestions.length} sub-queries: ${subQuestions.join("; ")}`
      : `Evaluated query against knowledge base`,
    questionAddressed
      ? `Heuristic relevance check: ${relevantChunkIds.length} of ${chunks.length} passage(s) match query terms [${informativeTerms.join(", ")}]`
      : `Heuristic relevance check: 0 of ${chunks.length} passage(s) match query terms [${informativeTerms.join(", ")}]`,
    ...relevantChunks.map(
      (info) => `Chunk [${info.chunkId}] matched terms [${info.matchedTerms.join(", ")}] in ${info.chunk.docName}`
    ),
    `Heuristic verdict: question is ${questionAddressed ? "addressed" : "unaddressed"} by candidate evidence`,
  ];

  return {
    evidenceAnalysis,
    conflictsOrNuances,
    evidenceGaps,
    summaryTrace,
    relevantChunkIds,
    questionAddressed,
    verdictSource: "heuristic",
    latencyMs: Date.now() - startTime,
    isFallback: true,
  };
}
