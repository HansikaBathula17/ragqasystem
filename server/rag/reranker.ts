import { RetrievedChunk } from "./vectorstore";
import { REASONING_MODEL, callGeminiWithTimeout } from "../gemini";
import { GENERIC_OR_STOPWORDS } from "./lexicalUtils";

export const RERANKER_TIMEOUT_MS = 6000;

export interface RerankResult {
  rerankedChunks: RetrievedChunk[];
  droppedChunks: RetrievedChunk[];
  latencyMs: number;
  isFallback?: boolean;
}

/**
 * Phase 4 Reranker: Takes top-8 retrieved chunks and reranks down to top-4 most relevant chunks.
 * Uses cross-attention style scoring with LLM or semantic density scoring.
 */
export async function rerankChunks(
  query: string,
  subQuestions: string[],
  chunks: RetrievedChunk[],
  targetTopK: number = 4
): Promise<RerankResult> {
  const startTime = Date.now();
  if (chunks.length === 0) {
    return {
      rerankedChunks: [],
      droppedChunks: [],
      latencyMs: Date.now() - startTime,
      isFallback: false,
    };
  }

  const queriesToScore = subQuestions.length > 0 ? [query, ...subQuestions] : [query];

  // Try LLM-based reranking when client available
  if (chunks.length > 0) {
    try {
      const candidatesList = chunks.map((c, idx) => `[Chunk ${idx + 1}] (from ${c.docName}, p.${c.page}):\n${c.text.slice(0, 300)}...`).join("\n\n");
      const prompt = `You are a cross-encoder Reranker in an advanced RAG pipeline.
User Question: "${query}"
Sub-questions: ${JSON.stringify(queriesToScore)}

Candidate chunks:
${candidatesList}

Score each chunk from 0.0 to 1.0 based on how directly and specifically it contains information to answer the question and sub-questions.
Output strictly a JSON array of objects with keys "chunkIndex" (1-based) and "score" (number between 0 and 1):
Example: [{"chunkIndex": 1, "score": 0.95}, {"chunkIndex": 2, "score": 0.40}]`;

      const response = await callGeminiWithTimeout(async (ai) => {
        return ai.models.generateContent({
          model: REASONING_MODEL,
          contents: prompt,
          config: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        });
      }, RERANKER_TIMEOUT_MS, REASONING_MODEL);

      if (response && response.text) {
        const parsedScores = JSON.parse(response.text.trim() || "[]") as Array<{ chunkIndex: number; score: number }>;
        const scoreMap = new Map<number, number>();
        for (const item of parsedScores) {
          scoreMap.set(item.chunkIndex - 1, Math.max(0, Math.min(1, item.score)));
        }

        const scoredChunks: RetrievedChunk[] = chunks.map((c, i) => {
          const llmScore = scoreMap.get(i);
          const rerankScore = llmScore !== undefined ? llmScore : c.similarity;
          return {
            ...c,
            rerankScore: parseFloat(rerankScore.toFixed(4)),
          };
        });

        scoredChunks.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));

        return {
          rerankedChunks: scoredChunks.slice(0, targetTopK),
          droppedChunks: scoredChunks.slice(targetTopK),
          latencyMs: Date.now() - startTime,
          isFallback: false,
        };
      }
    } catch (err: any) {
      console.warn(`[Reranker] Step fallback triggered for reranking: ${err?.message || "timeout/error"}`);
    }
  }

  // Algorithmic Cross-Relevance Scoring (weighted lexical specificity + rarity anchored to primary query)
  const candidateCount = chunks.length;
  const chunkTokenSets = chunks.map(
    (c) => new Set(c.text.toLowerCase().split(/\W+/).filter((w) => w.length > 2))
  );

  function computeQueryOverlap(qStr: string, chunkTokens: Set<string>): number {
    const qWords = qStr.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const informativeWords = qWords.filter((w) => !GENERIC_OR_STOPWORDS.has(w));

    if (informativeWords.length === 0) {
      return 0;
    }

    let matchWeight = 0;
    let totalWeight = 0;

    for (const w of informativeWords) {
      // Document frequency across candidate chunks
      let docFreq = 0;
      for (let j = 0; j < candidateCount; j++) {
        if (chunkTokenSets[j].has(w)) docFreq++;
      }

      // IDF weighting: rarer terms across the candidate set receive much higher weight
      const idf = Math.log(1 + (candidateCount / (1 + docFreq)));
      const lengthBonus = 1 + Math.log(1 + w.length);
      const weight = (1 + idf) * lengthBonus;

      totalWeight += weight;
      if (chunkTokens.has(w)) {
        matchWeight += weight;
      }
    }

    return totalWeight > 0 ? matchWeight / totalWeight : 0;
  }

  const scoredChunks: RetrievedChunk[] = chunks.map((chunk, chunkIdx) => {
    const chunkTokens = chunkTokenSets[chunkIdx];

    // Primary query overlap is the ground truth anchor for answerability
    const primaryScore = computeQueryOverlap(query, chunkTokens);

    // Sub-question overlap checks if chunk answers a specific decomposed sub-component
    let bestSubScore = 0;
    for (const sq of subQuestions) {
      const sqScore = computeQueryOverlap(sq, chunkTokens);
      if (sqScore > bestSubScore) bestSubScore = sqScore;
    }

    // Lexical score anchors heavily to the primary query (70%) to prevent sub-questions
    // that strip key discriminating terms (e.g. stripping 'offline' from 'online vs offline')
    // from falsely inflating the score of topically adjacent passages.
    const lexicalScore = subQuestions.length > 0
      ? primaryScore * 0.7 + bestSubScore * 0.3
      : primaryScore;

    // Combine vector similarity (30%) and lexical overlap (70%)
    const combinedScore = chunk.similarity * 0.3 + lexicalScore * 0.7;
    const rerankScore = parseFloat(Math.min(1.0, combinedScore).toFixed(4));

    return {
      ...chunk,
      rerankScore,
    };
  });

  scoredChunks.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));

  return {
    rerankedChunks: scoredChunks.slice(0, targetTopK),
    droppedChunks: scoredChunks.slice(targetTopK),
    latencyMs: Date.now() - startTime,
    isFallback: true,
  };
}
