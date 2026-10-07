import React, { useState } from "react";
import {
  GitBranch,
  Database,
  SlidersHorizontal,
  FileCheck2,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { PipelineQueryResponse } from "../types";

interface ReasoningTraceProps {
  pipelineResult: PipelineQueryResponse;
  onCitationClick?: (id: number) => void;
}

export const ReasoningTrace: React.FC<ReasoningTraceProps> = ({
  pipelineResult,
  onCitationClick,
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: true,
    5: false,
    6: true,
  });

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const { decomposition, rerank, scratchpad, groundedness, telemetry, citations } =
    pipelineResult;

  const fallbacks = telemetry?.fallbacksUsed || {
    decomposition: !!decomposition.isFallback,
    reranker: !!rerank.isFallback,
    scratchpad: !!scratchpad.isFallback,
    synthesis: false,
    groundedness: !!groundedness.isFallback,
  };

  const isFullyDegraded =
    telemetry?.isFullyDegraded ||
    telemetry?.fallbacksUsed?.fullyDegraded ||
    (rerank.isFallback && scratchpad.isFallback);

  const anyFallbackActive = Object.values(fallbacks).some(Boolean);

  return (
    <div className="p-4 space-y-4 text-[#F8FAFC]">
      {/* Header */}
      <div className="pb-3 border-b border-[#363B5E] space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-amber-400 font-heading tracking-wide uppercase">
              AI Reasoning Trace
            </h4>
            <p className="text-[10px] text-[#94A3B8]">6-Stage Transparent Verification Pipeline</p>
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] text-cyan-300 font-mono bg-[#1E223D] px-2.5 py-1 rounded-md border border-[#363B5E]">
            <Clock className="w-3 h-3 text-[#94A3B8]" />
            <span>{telemetry?.totalLatencyMs || 0}ms</span>
          </div>
        </div>

        {/* Global Fallback vs Fully Degraded vs Verified Indicator */}
        <div className="text-[10px]">
          {isFullyDegraded ? (
            <div className="w-full flex items-start space-x-2.5 px-3 py-2.5 rounded-xl bg-amber-500/15 text-amber-200 border border-amber-500/40 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block text-[11px] text-amber-300 font-heading">
                  Operating in fully degraded mode
                </span>
                <span className="text-[10px] text-amber-200/90 leading-relaxed block">
                  No live model judgment was available for relevance verification this turn; answers are held to a stricter but less nuanced bar.
                </span>
              </div>
            </div>
          ) : anyFallbackActive ? (
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Pipeline running with heuristic fallback modes</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>All 6 stages LLM-verified</span>
            </span>
          )}
        </div>
      </div>

      {/* Vertical Stepper Timeline */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#363B5E]">
        {/* Stage 1: Query Decomposition */}
        <div className="relative">
          <div
            onClick={() => toggleStep(1)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-2">
              <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                1
              </span>
              <div className="flex items-center space-x-1.5">
                <GitBranch className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-[#F8FAFC] group-hover:text-cyan-400 transition-colors">
                  Query Decomposition
                </span>
                {decomposition.isFallback ? (
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-sm font-medium">
                    Fallback Heuristic
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 rounded-sm font-medium">
                    LLM
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {telemetry?.stepsTiming?.decompositionMs || 0}ms
              </span>
              {expandedSteps[1] ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </div>

          {expandedSteps[1] && (
            <div className="mt-2 text-xs bg-[#1E223D] border border-[#363B5E] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#94A3B8]">Decomposition Trigger:</span>
                <span className="font-semibold text-cyan-300">
                  {decomposition.isDecomposed ? "Multi-Entity / Comparative" : "Single-Hop Direct"}
                </span>
              </div>
              {decomposition.triggerReason && (
                <p className="text-[10px] text-[#A5B4FC] italic">{decomposition.triggerReason}</p>
              )}
              {decomposition.isDecomposed ? (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-medium text-[#C7D2FE]">Sub-queries resolved:</p>
                  <ul className="space-y-1 pl-2">
                    {decomposition.subQuestions.map((sq, i) => (
                      <li key={i} className="flex items-start space-x-1.5 text-[#E2E8F0] text-[11px]">
                        <span className="font-semibold text-cyan-400 font-mono">({String.fromCharCode(97 + i)})</span>
                        <span>{sq}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[11px] text-[#94A3B8]">
                  Direct query: Executed without multi-hop branching.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Stage 2: Concurrent Vector Retrieval */}
        <div className="relative">
          <div
            onClick={() => toggleStep(2)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-2">
              <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                2
              </span>
              <div className="flex items-center space-x-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-[#F8FAFC] group-hover:text-cyan-400 transition-colors">
                  Vector Retrieval (Concurrent top-k=8)
                </span>
                <span className="text-[9px] px-1.5 py-0.2 bg-[#17192F] text-indigo-300 border border-[#363B5E] rounded-sm font-medium">
                  Dense Cosine
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {telemetry?.stepsTiming?.retrievalMs || 0}ms
              </span>
              {expandedSteps[2] ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </div>

          {expandedSteps[2] && (
            <div className="mt-2 text-xs bg-[#1E223D] border border-[#363B5E] rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-[11px] text-[#C7D2FE]">
                <span>Retrieved Candidates Pool:</span>
                <span className="font-semibold font-mono text-cyan-300">{rerank.retrievedCount} candidate chunks</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Sub-queries searched concurrently via Promise.all across cached vector embeddings (minimum similarity threshold 0.35).
              </p>
            </div>
          )}
        </div>

        {/* Stage 3: Cross-Encoder Reranker */}
        <div className="relative">
          <div
            onClick={() => toggleStep(3)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-2">
              <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                3
              </span>
              <div className="flex items-center space-x-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-[#F8FAFC] group-hover:text-cyan-400 transition-colors">
                  Reranking Filter (Trim to Top-4)
                </span>
                {rerank.isFallback ? (
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-sm font-medium">
                    Lexical Fallback
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 rounded-sm font-medium">
                    LLM Cross-Attention
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {telemetry?.stepsTiming?.rerankMs || 0}ms
              </span>
              {expandedSteps[3] ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </div>

          {expandedSteps[3] && (
            <div className="mt-2 text-xs bg-[#1E223D] border border-[#363B5E] rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-[11px] text-[#C7D2FE]">
                <span>Retained Candidates:</span>
                <span className="font-semibold text-cyan-300">{rerank.topKCount} top chunks</span>
              </div>
              <div className="flex justify-between text-[11px] text-[#C7D2FE]">
                <span>Filtered / Dropped:</span>
                <span className="font-mono text-[#94A3B8]">{rerank.droppedCount} lower scoring</span>
              </div>
              <div className="flex justify-between text-[11px] text-[#C7D2FE]">
                <span>Actually Cited in Answer:</span>
                <span className="font-semibold text-emerald-400">{citations.length} cited sources</span>
              </div>
            </div>
          )}
        </div>

        {/* Stage 4: Evidence Scratchpad Reasoning (Amber Accent) */}
        <div className="relative">
          <div
            onClick={() => toggleStep(4)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-2">
              <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center text-[10px] font-bold shadow-xs">
                4
              </span>
              <div className="flex items-center space-x-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
                  Evidence Scratchpad Reasoning
                </span>
                {scratchpad.isFallback ? (
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-sm font-medium">
                    Heuristic
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.2 bg-violet-500/20 text-violet-300 border border-violet-500/40 rounded-sm font-medium">
                    LLM (T=0)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {telemetry?.stepsTiming?.reasoningMs || 0}ms
              </span>
              {expandedSteps[4] ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </div>

          {expandedSteps[4] && (
            <div className="mt-2 text-xs bg-[#1E223D] border border-amber-500/30 rounded-xl p-3 space-y-2.5">
              {scratchpad.questionAddressed === false && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-[11px] text-rose-200 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-rose-300 font-heading">Relevance Gate Override:</span>
                    <p className="mt-0.5 text-rose-200/90 leading-relaxed">
                      Retrieved passages were determined to be topically adjacent or surface-level matches, but do not contain factual evidence to answer this specific question. Synthesis withheld to prevent hallucination.
                    </p>
                  </div>
                </div>
              )}

              {typeof scratchpad.questionAddressed === "boolean" && (
                <div className="flex items-center justify-between text-[11px] text-[#C7D2FE] bg-[#17192F] p-2.5 rounded-lg border border-[#363B5E]">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-medium text-[#94A3B8]">Relevance Verdict:</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-sm font-medium ${
                        scratchpad.verdictSource === "heuristic"
                          ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                          : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40"
                      }`}
                    >
                      {scratchpad.verdictSource === "heuristic" ? "Heuristic Term Match" : "LLM Model Judgment"}
                    </span>
                  </div>
                  <span
                    className={`font-semibold ${
                      scratchpad.questionAddressed ? "text-cyan-400" : "text-rose-400"
                    }`}
                  >
                    {scratchpad.questionAddressed
                      ? `${scratchpad.relevantChunkIds?.length ?? 0} passage${
                          scratchpad.relevantChunkIds?.length === 1 ? "" : "s"
                        } verified`
                      : "0 passages verified"}
                  </span>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold text-amber-300 mb-1 font-heading">Reasoning Trace:</p>
                <div className="space-y-1">
                  {pipelineResult.reasoning_trace.map((trace, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[#17192F] rounded-lg border border-[#363B5E] text-[#E2E8F0] text-[11px] leading-relaxed flex items-start space-x-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                      <span>{trace}</span>
                    </div>
                  ))}
                </div>
              </div>

              {scratchpad.conflictsOrNuances && scratchpad.conflictsOrNuances.length > 0 && (
                <div className="pt-1">
                  <p className="text-[11px] font-semibold text-amber-300 flex items-center space-x-1 mb-1 font-heading">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Surfaced Nuances & Differences:</span>
                  </p>
                  <ul className="space-y-1.5 pl-2">
                    {scratchpad.conflictsOrNuances.map((c, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-amber-200 bg-amber-500/10 p-2 rounded-lg border border-amber-500/30 leading-relaxed"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stage 5: Grounded Answer Synthesis */}
        <div className="relative">
          <div
            onClick={() => toggleStep(5)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-2">
              <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                5
              </span>
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-[#F8FAFC] group-hover:text-cyan-400 transition-colors">
                  Answer Synthesis + Inline Citations
                </span>
                {fallbacks.synthesis ? (
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-sm font-medium">
                    Fallback Extract
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 rounded-sm font-medium">
                    LLM (T=0.3)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {telemetry?.stepsTiming?.synthesisMs || 0}ms
              </span>
              {expandedSteps[5] ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </div>

          {expandedSteps[5] && (
            <div className="mt-2 text-xs bg-[#1E223D] border border-[#363B5E] rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-[11px] text-[#C7D2FE]">
                <span>Model-Cited Sources:</span>
                <span className="font-semibold text-cyan-300 font-mono">{citations.length} chunks cited</span>
              </div>
              <div className="flex justify-between text-[11px] text-[#C7D2FE]">
                <span>Inference Temperature:</span>
                <span className="font-mono text-cyan-300">T=0.3 (deterministic synthesis)</span>
              </div>
            </div>
          )}
        </div>

        {/* Stage 6: Groundedness & Anti-Hallucination Audit */}
        <div className="relative">
          <div
            onClick={() => toggleStep(6)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-2">
              <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                6
              </span>
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-[#F8FAFC] group-hover:text-cyan-400 transition-colors">
                  Groundedness & Anti-Hallucination Audit
                </span>
                {groundedness.isFallback ? (
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-sm font-medium">
                    Lexical Fallback
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 rounded-sm font-medium">
                    LLM Audit
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {telemetry?.stepsTiming?.groundednessMs || 0}ms
              </span>
              {expandedSteps[6] ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </div>

          {expandedSteps[6] && (
            <div className="mt-2 text-xs bg-[#1E223D] border border-emerald-500/30 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#C7D2FE]">Audit on Final Answer:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    groundedness.confidence === "high"
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                      : groundedness.confidence === "medium"
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                      : "bg-rose-500/15 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  {groundedness.confidence} Confidence ({groundedness.confidenceScore}%)
                </span>
              </div>

              <p className="text-[11px] text-[#E2E8F0] bg-[#17192F] p-2.5 rounded-lg border border-[#363B5E] leading-relaxed">
                {groundedness.groundingAudit}
              </p>

              {groundedness.supportedClaims && groundedness.supportedClaims.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[#A5B4FC] uppercase tracking-wider">Supported Claims:</p>
                  <ul className="space-y-1 mt-1.5">
                    {groundedness.supportedClaims.map((claim, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5 text-[11px] text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{claim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
