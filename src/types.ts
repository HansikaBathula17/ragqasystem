export interface DocumentItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  uploadDate: string;
  fileType: string;
  chunkCount: number;
  totalTokens: number;
  isPreloaded?: boolean;
}

export interface DocumentChunkItem {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  page: number;
  section: string;
  text: string;
  tokenCount: number;
}

export interface CitationItem {
  id: number;
  doc: string;
  page: number;
  section: string;
  text: string;
  similarity: number;
  rerankScore?: number;
}

export interface DecompositionData {
  isDecomposed: boolean;
  triggerReason?: string;
  subQuestions: string[];
  latencyMs: number;
  isFallback?: boolean;
}

export interface GroundednessData {
  isFullyGrounded: boolean;
  hasSufficientContext: boolean;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  supportedClaims: string[];
  unsupportedClaims: string[];
  groundingAudit: string;
  latencyMs: number;
  isFallback?: boolean;
}

export interface ScratchpadData {
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

export interface PipelineQueryResponse {
  queryId: string;
  question: string;
  answer: string;
  citations: CitationItem[];
  candidateCitations?: CitationItem[];
  reasoning_trace: string[];
  confidence: "high" | "medium" | "low";
  confidence_score: number;
  decomposition: DecompositionData;
  groundedness: GroundednessData;
  scratchpad: ScratchpadData;
  rerank: {
    retrievedCount: number;
    topKCount: number;
    citedCount?: number;
    droppedCount: number;
    isFallback?: boolean;
  };
  telemetry: {
    totalLatencyMs: number;
    tokenCount: number;
    isTokenCountEstimated?: boolean;
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
    fallbacksUsed?: {
      decomposition: boolean;
      reranker: boolean;
      scratchpad: boolean;
      synthesis: boolean;
      groundedness: boolean;
      fullyDegraded?: boolean;
    };
  };
  sessionId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isError?: boolean;
  queryResult?: PipelineQueryResponse;
  feedback?: {
    isHelpful: boolean;
    comment?: string;
    createdAt: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ObservabilityStats {
  totalDocuments: number;
  totalChunks: number;
  totalQueries: number;
  avgLatencyMs: number;
  totalTokens: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  feedbackStats: {
    totalFeedback: number;
    satisfactionRate: number;
    helpfulCount: number;
    unhelpfulCount: number;
  };
}
