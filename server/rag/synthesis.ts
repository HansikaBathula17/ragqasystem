import { RetrievedChunk } from "./vectorstore";
import { REASONING_MODEL, callGeminiWithTimeout } from "../gemini";
import { ScratchpadReasoningResult } from "./reasoning";

export const SYNTHESIS_TIMEOUT_MS = 9000;

export interface CitationItem {
  id: number;
  doc: string;
  page: number;
  section: string;
  text: string;
  similarity: number;
  rerankScore?: number;
}

export interface SynthesisResult {
  answer: string;
  citations: CitationItem[];
  allCandidateCitations: CitationItem[];
  latencyMs: number;
  tokenCount: number;
  isTokenCountEstimated: boolean;
  isFallback?: boolean;
}

/**
 * Parses [n] citation markers appearing in the answer text.
 */
export function extractUsedCitationIds(answerText: string): Set<number> {
  const matches = answerText.matchAll(/\[(\d+)\]/g);
  const ids = new Set<number>();
  for (const m of matches) {
    const num = parseInt(m[1], 10);
    if (!isNaN(num)) ids.add(num);
  }
  return ids;
}

/**
 * Step 5 / Synthesis: Grounded Answer Synthesis
 * Uses temperature = 0.3 to synthesize a clear, factual answer with inline citation markers [1], [2].
 * If evidence is insufficient, strictly outputs: "I don't have enough information in the knowledge base to answer this."
 */
export async function synthesizeAnswer(
  question: string,
  chunks: RetrievedChunk[],
  scratchpad: ScratchpadReasoningResult,
  hasSufficientContext: boolean
): Promise<SynthesisResult> {
  const startTime = Date.now();

  const allCandidateCitations: CitationItem[] = chunks.map((c, i) => ({
    id: i + 1,
    doc: c.docName,
    page: c.page,
    section: c.section,
    text: c.text,
    similarity: c.similarity,
    rerankScore: c.rerankScore,
  }));

  if (!hasSufficientContext || chunks.length === 0) {
    return {
      answer: "I don't have enough information in the knowledge base to answer this.",
      citations: [],
      allCandidateCitations,
      latencyMs: Date.now() - startTime,
      tokenCount: 15,
      isTokenCountEstimated: true,
      isFallback: false,
    };
  }

  try {
    const chunksBlock = chunks
      .map((c, i) => `[Citation ${i + 1}] (Document: ${c.docName}, Page: ${c.page}, Section: ${c.section}):\n${c.text}`)
      .join("\n\n");

    const reasoningNotes = scratchpad.summaryTrace.join("\n- ");

    const systemPrompt = `You are an accurate, grounded enterprise Question-Answering system.
CRITICAL SYSTEM RULES (NON-NEGOTIABLE):
1. You may ONLY answer using the provided retrieved chunks. Do NOT use prior knowledge.
2. If the retrieved context does not contain enough information to answer the question, you MUST respond EXACTLY with:
   "I don't have enough information in the knowledge base to answer this."
3. Every factual claim or sentence MUST include inline citation markers like [1], [2] referencing the specific chunk id that directly proves it.
4. Keep the answer direct, comprehensive, and objective. If retrieved documents contain differing or evolving policies (e.g. baseline vs update), clearly explain both with citations.`;

    const userContent = `User Question: "${question}"

Reasoning Scratchpad Notes:
- ${reasoningNotes}

Retrieved Knowledge Base Chunks:
${chunksBlock}

Generate the final grounded answer with inline citations [1], [2]:`;

    const response = await callGeminiWithTimeout(async (ai) => {
      return ai.models.generateContent({
        model: REASONING_MODEL,
        contents: userContent,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
        },
      });
    }, SYNTHESIS_TIMEOUT_MS, REASONING_MODEL);

    if (response && response.text) {
      const rawAnswer = response.text.trim();
      const cleanedAnswer = rawAnswer || "I don't have enough information in the knowledge base to answer this.";

      const usedIds = extractUsedCitationIds(cleanedAnswer);
      const usedCitations = usedIds.size > 0
        ? allCandidateCitations.filter((c) => usedIds.has(c.id))
        : allCandidateCitations;

      return {
        answer: cleanedAnswer,
        citations: usedCitations,
        allCandidateCitations,
        latencyMs: Date.now() - startTime,
        tokenCount: Math.round(cleanedAnswer.length / 3.5),
        isTokenCountEstimated: true,
        isFallback: false,
      };
    }
  } catch (err: any) {
    console.warn(`[Synthesis] Step fallback triggered: ${err?.message || "timeout/error"}`);
  }

  // Deterministic synthesis fallback
  if (chunks.length === 0) {
    return {
      answer: "I don't have enough information in the knowledge base to answer this.",
      citations: [],
      allCandidateCitations: [],
      latencyMs: Date.now() - startTime,
      tokenCount: 15,
      isTokenCountEstimated: true,
      isFallback: true,
    };
  }

  // Extract cleanest meaningful sentences from top relevant chunks
  const answerParagraphs: string[] = [];
  const usedFallbackIds = new Set<number>();

  chunks.slice(0, 3).forEach((chunk, i) => {
    const citationId = i + 1;
    const citationTag = `[${citationId}]`;
    const cleanText = chunk.text
      .replace(/\[Page \d+\]\s*Section:[^\n]+/g, "")
      .replace(/[A-Z][a-zA-Z\s]+Version\s*\d+\.\d+/g, "")
      .trim();

    const meaningfulSentences = cleanText
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && !s.startsWith("Section:") && !s.startsWith("Apex"));

    if (meaningfulSentences.length > 0) {
      const topSentence = meaningfulSentences.slice(0, 2).join(" ");
      answerParagraphs.push(`${topSentence} ${citationTag}`);
      usedFallbackIds.add(citationId);
    }
  });

  const answer = answerParagraphs.length > 0
    ? answerParagraphs.join("\n\n")
    : `Based on ${chunks[0].docName} (p. ${chunks[0].page}), ${chunks[0].text.slice(0, 200)}... [1].`;

  if (answerParagraphs.length === 0) {
    usedFallbackIds.add(1);
  }

  const citations = allCandidateCitations.filter((c) => usedFallbackIds.has(c.id));

  return {
    answer,
    citations,
    allCandidateCitations,
    latencyMs: Date.now() - startTime,
    tokenCount: Math.round(answer.length / 3.5),
    isTokenCountEstimated: true,
    isFallback: true,
  };
}
