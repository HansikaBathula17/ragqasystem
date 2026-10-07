import {
  VectorStore,
  RetrievedChunk,
  ANSWERABILITY_THRESHOLD,
  ANSWERABILITY_THRESHOLD_FALLBACK,
  ANSWERABILITY_THRESHOLD_FULLY_DEGRADED,
} from "./vectorstore";
import { decomposeQuery, DecompositionResult, generateScratchpadReasoning, ScratchpadReasoningResult } from "./reasoning";
import { rerankChunks, RerankResult } from "./reranker";
import { auditGroundedness, GroundednessResult } from "./groundedness";
import { synthesizeAnswer, CitationItem, SynthesisResult } from "./synthesis";
import { extractInformativeTerms, computeInformativeTermCoverage } from "./lexicalUtils";

export interface PipelineQueryResponse {
  queryId: string;
  question: string;
  answer: string;
  citations: CitationItem[];
  candidateCitations: CitationItem[];
  reasoning_trace: string[];
  confidence: "high" | "medium" | "low";
  confidence_score: number;
  decomposition: DecompositionResult;
  groundedness: GroundednessResult;
  scratchpad: ScratchpadReasoningResult;
  rerank: {
    retrievedCount: number;
    topKCount: number;
    citedCount: number;
    droppedCount: number;
    isFallback?: boolean;
  };
  telemetry: {
    totalLatencyMs: number;
    tokenCount: number;
    isTokenCountEstimated: boolean;
    modelUsed: string;
    isFullyDegraded?: boolean;
    stepsTiming: {
      decompositionMs: number;
      retrievalMs: number;
      rerankMs: number;
      reasoningMs: number;
      synthesisMs: number;
      groundednessMs: number;
    };
    fallbacksUsed: {
      decomposition: boolean;
      reranker: boolean;
      scratchpad: boolean;
      synthesis: boolean;
      groundedness: boolean;
      fullyDegraded?: boolean;
    };
  };
}

export async function runRagReasoningPipeline(
  question: string,
  vectorStore: VectorStore
): Promise<PipelineQueryResponse> {
  const pipelineStart = Date.now();
  const queryId = `query-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Stage 1: Query Decomposition (Reasoning Step 1)
  const decomposition = await decomposeQuery(question);

  // Stage 2: Concurrent Vector Retrieval (top-k=8 candidate chunks)
  const retrievalStart = Date.now();
  const queriesToSearch = Array.from(
    new Set(decomposition.isDecomposed ? [question, ...decomposition.subQuestions] : [question])
  );

  const searchResults = await Promise.all(
    queriesToSearch.map((q) => vectorStore.search(q, 8))
  );

  let top8Candidates: RetrievedChunk[] = [];

  if (decomposition.isDecomposed) {
    // Per-sub-question slot reservation matters: when answering a comparison or multi-hop query,
    // one entity or sub-facet might have naturally lower embedding cosine similarity scores
    // than another. A purely global similarity sort would let the higher-scoring query crowd out
    // the weaker one entirely. Reserving slots per sub-question guarantees balanced evidence
    // representation for all sides of the query before applying cross-encoder reranking.
    const minSlotsPerQuery = Math.max(2, Math.floor(8 / queriesToSearch.length));
    const reservedCandidates: RetrievedChunk[] = [];
    const seenIds = new Set<string>();

    // Step 2a: Take the guaranteed minimum number of slots per query, in that query's own similarity order
    for (const hits of searchResults) {
      let queryReserved = 0;
      for (const h of hits) {
        if (queryReserved >= minSlotsPerQuery) break;
        if (!seenIds.has(h.id)) {
          seenIds.add(h.id);
          reservedCandidates.push(h);
          queryReserved++;
        }
      }
    }

    // Step 2b: Only after each sub-question's minimum is satisfied, fill remaining slots up to 8
    // with highest-similarity leftovers across all queries (which already meet MIN_COSINE_SIMILARITY)
    if (reservedCandidates.length < 8) {
      const leftovers: RetrievedChunk[] = [];
      for (const hits of searchResults) {
        for (const h of hits) {
          if (!seenIds.has(h.id) && !leftovers.some((l) => l.id === h.id)) {
            leftovers.push(h);
          }
        }
      }
      leftovers.sort((a, b) => b.similarity - a.similarity);

      for (const item of leftovers) {
        if (reservedCandidates.length >= 8) break;
        reservedCandidates.push(item);
        seenIds.add(item.id);
      }
    }

    top8Candidates = reservedCandidates;
  } else {
    // For single (non-decomposed) queries, behavior is unchanged:
    // pool hits and take the top 8 by vector similarity
    const candidatePool: RetrievedChunk[] = [];
    for (const hits of searchResults) {
      for (const h of hits) {
        if (!candidatePool.some((existing) => existing.id === h.id)) {
          candidatePool.push(h);
        }
      }
    }
    candidatePool.sort((a, b) => b.similarity - a.similarity);
    top8Candidates = candidatePool.slice(0, 8);
  }

  const retrievalMs = Date.now() - retrievalStart;

  // Stage 3: Cross-Encoder Reranker (top-8 down to top-4)
  const rerankResult: RerankResult = await rerankChunks(
    question,
    decomposition.subQuestions,
    top8Candidates,
    4
  );
  let activeChunks = rerankResult.rerankedChunks;

  // Stage 4: Evidence Scratchpad Reasoning (Reasoning Step 2)
  const scratchpad: ScratchpadReasoningResult = await generateScratchpadReasoning(
    question,
    decomposition.subQuestions,
    activeChunks
  );

  // Track compounded degradation: when BOTH reranker AND scratchpad ran in heuristic fallback mode
  const isFullyDegraded = !!(rerankResult.isFallback && scratchpad.isFallback);

  const primaryInformativeTerms = extractInformativeTerms(question);
  const { coverage: termCoverage, matchedTerms, missingTerms } = computeInformativeTermCoverage(
    primaryInformativeTerms,
    activeChunks.map((c) => c.text)
  );

  let hasSufficientContext = false;
  let relevanceGateOverridden = false;
  let fullyDegradedGateTriggered = false;

  const maxCandidateScore = activeChunks.length > 0
    ? Math.max(...activeChunks.map((c) => c.rerankScore ?? c.similarity))
    : 0;

  if (isFullyDegraded) {
    // Fix 2: Stricter combined threshold and heuristic relevance requirement
    // when BOTH reranker and scratchpad run without live model judgment
    const hasStrongTermMajority = primaryInformativeTerms.length <= 1
      ? matchedTerms.length === primaryInformativeTerms.length
      : termCoverage >= 0.5;

    const clearedScoreBar = maxCandidateScore >= ANSWERABILITY_THRESHOLD_FULLY_DEGRADED ||
      (maxCandidateScore >= 0.55 && hasStrongTermMajority);

    const heuristicCheckPassed = scratchpad.questionAddressed !== false &&
      Array.isArray(scratchpad.relevantChunkIds) &&
      scratchpad.relevantChunkIds.length > 0;

    if (activeChunks.length > 0 && clearedScoreBar && hasStrongTermMajority && heuristicCheckPassed) {
      hasSufficientContext = true;
    } else {
      hasSufficientContext = false;
      fullyDegradedGateTriggered = true;
    }
  } else {
    // Standard threshold: 0.65 if reranker was fallback, 0.45 if cross-encoder ran
    const threshold = rerankResult.isFallback
      ? ANSWERABILITY_THRESHOLD_FALLBACK
      : ANSWERABILITY_THRESHOLD;

    hasSufficientContext =
      activeChunks.length > 0 &&
      activeChunks.some((c) => (c.rerankScore ?? c.similarity) >= threshold);

    // If scratchpad ran with live LLM judgment, use LLM structured verdict to override
    if (!scratchpad.isFallback && typeof scratchpad.questionAddressed === "boolean") {
      if (scratchpad.questionAddressed === false) {
        // Override hasSufficientContext to false regardless of what the earlier rerank score said
        if (hasSufficientContext) {
          relevanceGateOverridden = true;
        }
        hasSufficientContext = false;
      }
    }
  }

  // Narrow activeChunks down to just relevantChunkIds if non-empty
  if (
    hasSufficientContext &&
    Array.isArray(scratchpad.relevantChunkIds) &&
    scratchpad.relevantChunkIds.length > 0
  ) {
    const relevantIdSet = new Set(scratchpad.relevantChunkIds.map(String));
    const narrowedChunks = activeChunks.filter((chunk, idx) => {
      const indexStr = String(idx + 1);
      return relevantIdSet.has(indexStr) || relevantIdSet.has(chunk.id);
    });

    if (narrowedChunks.length > 0 && narrowedChunks.length < activeChunks.length) {
      activeChunks = narrowedChunks;
    }
  }

  // Trace messaging
  if (fullyDegradedGateTriggered) {
    const gateNotice = `Compounded Degradation Gate: Both reranker and scratchpad operated in heuristic fallback mode. Primary query informative terms [${primaryInformativeTerms.join(", ")}] had insufficient coverage in candidate text (${matchedTerms.length}/${primaryInformativeTerms.length} matched: [${matchedTerms.join(", ")}], missing: [${missingTerms.join(", ")}]). Answer withheld under strict degraded-mode bar to prevent ungrounded synthesis.`;
    if (!scratchpad.summaryTrace.some((t) => t.includes("Compounded Degradation Gate"))) {
      scratchpad.summaryTrace = [...scratchpad.summaryTrace, gateNotice];
    }
  } else if (relevanceGateOverridden) {
    const docNames = Array.from(new Set(rerankResult.rerankedChunks.map((c) => c.docName))).join(", ");
    const gateNotice = `Relevance Gate Override: Retrieved passages (${docNames}) share surface vocabulary or are topically adjacent, but the reasoning scratchpad confirmed they do not contain facts addressing the user's specific question. Answer withheld to prevent hallucination.`;
    if (!scratchpad.summaryTrace.some((t) => t.includes("Relevance Gate Override"))) {
      scratchpad.summaryTrace = [...scratchpad.summaryTrace, gateNotice];
    }
  }

  // Stage 5: Grounded Answer Synthesis with Citation Tagging
  // If hasSufficientContext is false, this immediately returns the fallback answer without invoking the synthesis LLM
  const synthesis: SynthesisResult = await synthesizeAnswer(
    question,
    activeChunks,
    scratchpad,
    hasSufficientContext
  );

  // Stage 6: Groundedness & Anti-Hallucination Audit
  // When context is insufficient or relevance gate triggered, output transparent low confidence with clear audit trace
  let groundedness: GroundednessResult;
  if (!hasSufficientContext) {
    const auditMsg = fullyDegradedGateTriggered
      ? `Compounded degradation safeguard: Both reranker and scratchpad operated in heuristic fallback mode. Query terms [${primaryInformativeTerms.join(", ")}] were not sufficiently verified in retrieved context (${matchedTerms.length}/${primaryInformativeTerms.length} matched). Answer withheld to prevent ungrounded synthesis.`
      : relevanceGateOverridden
      ? `Anti-hallucination safeguard: Retrieved passages (${rerankResult.rerankedChunks.map((c) => c.docName).join(", ")}) share surface vocabulary or are topically adjacent, but the reasoning scratchpad confirmed they do not contain facts addressing the user's specific question. Answer withheld to prevent hallucination.`
      : "Insufficient context in knowledge base: No retrieved chunks met the answerability threshold.";
    groundedness = {
      isFullyGrounded: true,
      hasSufficientContext: false,
      confidence: "low",
      confidenceScore: 0,
      supportedClaims: [],
      unsupportedClaims: ["Query cannot be answered from the retrieved knowledge base documents."],
      groundingAudit: auditMsg,
      latencyMs: 0,
      isFallback: false,
    };
  } else {
    groundedness = await auditGroundedness(
      question,
      synthesis.answer,
      activeChunks
    );
  }

  const totalLatencyMs = Date.now() - pipelineStart;

  return {
    queryId,
    question,
    answer: synthesis.answer,
    citations: synthesis.citations,
    candidateCitations: synthesis.allCandidateCitations,
    reasoning_trace: scratchpad.summaryTrace,
    confidence: groundedness.confidence,
    confidence_score: groundedness.confidenceScore,
    decomposition,
    groundedness,
    scratchpad,
    rerank: {
      retrievedCount: top8Candidates.length,
      topKCount: activeChunks.length,
      citedCount: synthesis.citations.length,
      droppedCount: rerankResult.droppedChunks.length,
      isFallback: rerankResult.isFallback,
    },
    telemetry: {
      totalLatencyMs,
      tokenCount: synthesis.tokenCount,
      isTokenCountEstimated: synthesis.isTokenCountEstimated,
      modelUsed: "gemini-3.8-flash (T=0 reasoning, T=0.3 synthesis)",
      isFullyDegraded,
      stepsTiming: {
        decompositionMs: decomposition.latencyMs,
        retrievalMs,
        rerankMs: rerankResult.latencyMs,
        reasoningMs: scratchpad.latencyMs,
        synthesisMs: synthesis.latencyMs,
        groundednessMs: groundedness.latencyMs,
      },
      fallbacksUsed: {
        decomposition: !!decomposition.isFallback,
        reranker: !!rerankResult.isFallback,
        scratchpad: !!scratchpad.isFallback,
        synthesis: !!synthesis.isFallback,
        groundedness: !!groundedness.isFallback,
        fullyDegraded: isFullyDegraded,
      },
    },
  };
}
