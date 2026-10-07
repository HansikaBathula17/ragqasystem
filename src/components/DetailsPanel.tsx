import React from "react";
import {
  FileText,
  GitBranch,
  Activity,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { PipelineQueryResponse } from "../types";
import { ReasoningTrace } from "./ReasoningTrace";
import { SourcesPanel } from "./SourcesPanel";

interface DetailsPanelProps {
  activeQueryResult: PipelineQueryResponse | null;
  selectedCitationId: number | null;
  onSelectCitation: (id: number) => void;
  activeTab: "reasoning" | "sources" | "telemetry";
  onTabChange: (tab: "reasoning" | "sources" | "telemetry") => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  activeQueryResult,
  selectedCitationId,
  onSelectCitation,
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
}) => {
  if (isCollapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center py-4 px-2 bg-[#15172B] border-l border-[#363B5E] shrink-0">
        <button
          onClick={onToggleCollapse}
          title="Expand Details Panel"
          className="p-2 text-[#94A3B8] hover:text-white hover:bg-[#22263F] rounded-lg transition-colors border border-transparent hover:border-[#363B5E]"
        >
          <ChevronLeft className="w-4 h-4 text-cyan-400" />
        </button>
        <div className="writing-vertical-rl text-[11px] font-semibold text-[#64748B] mt-6 tracking-wider uppercase rotate-180 font-heading">
          Inspection Cockpit
        </div>
      </div>
    );
  }

  return (
    <aside
      id="rag-details-panel"
      className="w-full lg:w-96 bg-[#15172B] border-l border-[#363B5E] flex flex-col h-full shrink-0 shadow-lg select-none text-[#F8FAFC]"
    >
      {/* Header with Tab Navigation */}
      <div className="px-4 py-3 border-b border-[#363B5E] bg-[#181A32] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onTabChange("reasoning")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === "reasoning"
                ? "bg-[#282D52] text-white shadow-md shadow-violet-900/30 border border-violet-500/60"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E223D]"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-amber-400" />
            <span>Reasoning</span>
          </button>

          <button
            onClick={() => onTabChange("sources")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === "sources"
                ? "bg-[#282D52] text-white shadow-md shadow-violet-900/30 border border-violet-500/60"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E223D]"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sources</span>
            {activeQueryResult && activeQueryResult.citations.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-bold">
                {activeQueryResult.citations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange("telemetry")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === "telemetry"
                ? "bg-[#282D52] text-white shadow-md shadow-violet-900/30 border border-violet-500/60"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E223D]"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-violet-400" />
            <span>Telemetry</span>
          </button>
        </div>

        <button
          onClick={onToggleCollapse}
          title="Collapse Panel"
          className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#22263F] border border-transparent hover:border-[#363B5E] transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {!activeQueryResult ? (
          <div className="p-8 text-center text-[#94A3B8] space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#1E223D] border border-[#363B5E] flex items-center justify-center text-cyan-400 shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-white font-heading">No Query Active</p>
            <p className="text-[11px] text-[#94A3B8] max-w-xs mx-auto leading-relaxed">
              Ask a question in the chat to inspect real-time multi-stage query decomposition, vector retrieval, and verification
              traces.
            </p>
          </div>
        ) : (
          <>
            {activeTab === "reasoning" && (
              <ReasoningTrace
                pipelineResult={activeQueryResult}
                onCitationClick={onSelectCitation}
              />
            )}

            {activeTab === "sources" && (
              <SourcesPanel
                citations={activeQueryResult.citations}
                candidateCitations={activeQueryResult.candidateCitations || []}
                selectedCitationId={selectedCitationId}
                onSelectCitation={onSelectCitation}
              />
            )}

            {activeTab === "telemetry" && (
              <div className="p-4 space-y-4 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#363B5E]">
                  <h4 className="font-semibold text-white font-heading">Pipeline Latency & Telemetry</h4>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold bg-[#1E223D] px-2.5 py-1 rounded-md border border-[#363B5E]">
                    {activeQueryResult.telemetry?.totalLatencyMs} ms
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-[#A5B4FC] uppercase tracking-wider">
                    6-Stage Timing Breakdown:
                  </p>
                  <div className="space-y-1.5 bg-[#1E223D] p-3 rounded-xl border border-[#363B5E] font-mono text-[11px]">
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#94A3B8]">[1] Query Decomposition:</span>
                      <span className="font-semibold text-cyan-300">
                        {activeQueryResult.telemetry?.stepsTiming?.decompositionMs || 0} ms
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#94A3B8]">[2] Concurrent Retrieval:</span>
                      <span className="font-semibold text-cyan-300">
                        {activeQueryResult.telemetry?.stepsTiming?.retrievalMs || 0} ms
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#94A3B8]">[3] Cross-Encoder Rerank:</span>
                      <span className="font-semibold text-cyan-300">
                        {activeQueryResult.telemetry?.stepsTiming?.rerankMs || 0} ms
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#94A3B8]">[4] Reasoning Scratchpad:</span>
                      <span className="font-semibold text-amber-400">
                        {activeQueryResult.telemetry?.stepsTiming?.reasoningMs || 0} ms
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#94A3B8]">[5] Grounded Synthesis:</span>
                      <span className="font-semibold text-violet-300">
                        {activeQueryResult.telemetry?.stepsTiming?.synthesisMs || 0} ms
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#94A3B8]">[6] Groundedness Audit:</span>
                      <span className="font-semibold text-emerald-400">
                        {activeQueryResult.telemetry?.stepsTiming?.groundednessMs || 0} ms
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-[#A5B4FC] uppercase tracking-wider">
                    Verification & Diagnostics:
                  </p>
                  <div className="p-3 bg-[#1E223D] border border-[#363B5E] rounded-xl space-y-1.5 text-[#C7D2FE]">
                    <p className="flex justify-between">
                      <span className="text-[#94A3B8]">Model:</span>
                      <span className="font-mono text-white">{activeQueryResult.telemetry?.modelUsed}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-[#94A3B8]">Generated Tokens:</span>
                      <span className="font-mono text-cyan-300">
                        ~{activeQueryResult.telemetry?.tokenCount}
                        {activeQueryResult.telemetry?.isTokenCountEstimated && (
                          <span className="text-[#64748B] text-[10px] ml-1">(est.)</span>
                        )}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-[#94A3B8]">Confidence Score:</span>
                      <span className="font-semibold text-amber-300">
                        {activeQueryResult.confidence_score}% ({activeQueryResult.confidence})
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-[#94A3B8]">Sources Provenance:</span>
                      <span>
                        {activeQueryResult.citations.length} cited / {activeQueryResult.rerank.topKCount} candidates
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-[#94A3B8]">Hallucination Audit:</span>
                      {activeQueryResult.groundedness.isFullyGrounded ? (
                        <span className="text-emerald-400 font-semibold">Passed (100% Grounded)</span>
                      ) : (
                        <span className="text-amber-400 font-semibold">Flagged / Scoped</span>
                      )}
                    </p>
                    <div className="pt-2 mt-2 border-t border-[#363B5E] text-[11px]">
                      <span className="font-semibold text-white block mb-1.5">Execution Mode:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(activeQueryResult.telemetry?.isFullyDegraded ||
                          (activeQueryResult.rerank?.isFallback && activeQueryResult.scratchpad?.isFallback)) && (
                          <span className="px-2 py-0.5 bg-rose-500/15 text-rose-300 border border-rose-500/40 rounded-md text-[10px] font-semibold">
                            Degraded Heuristic Relevance Gate
                          </span>
                        )}
                        {activeQueryResult.decomposition?.isFallback && (
                          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-md text-[10px]">
                            Decomp: Fallback
                          </span>
                        )}
                        {activeQueryResult.rerank?.isFallback && (
                          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-md text-[10px]">
                            Rerank: Fallback
                          </span>
                        )}
                        {activeQueryResult.scratchpad?.isFallback && (
                          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-md text-[10px]">
                            Scratchpad: Fallback
                          </span>
                        )}
                        {activeQueryResult.groundedness?.isFallback && (
                          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-md text-[10px]">
                            Audit: Fallback
                          </span>
                        )}
                        {!activeQueryResult.decomposition?.isFallback &&
                          !activeQueryResult.rerank?.isFallback &&
                          !activeQueryResult.scratchpad?.isFallback &&
                          !activeQueryResult.groundedness?.isFallback && (
                            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 rounded-md text-[10px]">
                              100% LLM-Verified Pipeline
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
