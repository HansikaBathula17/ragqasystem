import React, { useEffect, useState } from "react";
import { X, Activity, Cpu, ShieldCheck, CheckCircle, Clock, Zap } from "lucide-react";
import { ObservabilityStats } from "../types";

interface ObservabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ObservabilityModal: React.FC<ObservabilityModalProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<ObservabilityStats | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/observability")
        .then((res) => res.json())
        .then((data) => setStats(data))
        .catch((err) => console.error(err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      id="observability-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    >
      <div
        id="observability-modal-card"
        className="w-full max-w-2xl bg-[#1E223D] rounded-2xl shadow-2xl border border-[#363B5E] overflow-hidden text-[#F8FAFC]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#363B5E] bg-[#181A32]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-violet-600/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-heading">Pipeline Observability & Tracing</h3>
              <p className="text-xs text-[#94A3B8]">Live telemetry across decomposition, retrieval, reasoning, and audit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#282D52] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3.5 bg-[#17192F] border border-[#363B5E] rounded-xl">
              <div className="flex items-center justify-between text-[#94A3B8] text-xs mb-1">
                <span>Total Queries</span>
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className="text-xl font-bold text-white font-mono">{stats?.totalQueries ?? 0}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">Executed end-to-end</p>
            </div>

            <div className="p-3.5 bg-[#17192F] border border-[#363B5E] rounded-xl">
              <div className="flex items-center justify-between text-[#94A3B8] text-xs mb-1">
                <span>Avg Latency</span>
                <Clock className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <p className="text-xl font-bold text-cyan-300 font-mono">{stats?.avgLatencyMs ?? 0} ms</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">Across all 6 stages</p>
            </div>

            <div className="p-3.5 bg-[#17192F] border border-[#363B5E] rounded-xl">
              <div className="flex items-center justify-between text-[#94A3B8] text-xs mb-1">
                <span>Indexed Chunks</span>
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <p className="text-xl font-bold text-white font-mono">{stats?.totalChunks ?? 0}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">512 token / 50 overlap</p>
            </div>

            <div className="p-3.5 bg-[#17192F] border border-[#363B5E] rounded-xl">
              <div className="flex items-center justify-between text-[#94A3B8] text-xs mb-1">
                <span>High Grounding</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-xl font-bold text-emerald-400 font-mono">
                {stats?.confidenceDistribution?.high ?? 0}
              </p>
              <p className="text-[10px] text-[#64748B] mt-0.5">Strict anti-hallucination</p>
            </div>
          </div>

          {/* Confidence Breakdown */}
          <div className="p-4 rounded-xl border border-[#363B5E] bg-[#17192F] space-y-3">
            <h4 className="text-xs font-semibold text-white flex items-center justify-between font-heading">
              <span>Confidence Distribution</span>
              <span className="text-[11px] font-normal text-[#94A3B8]">
                Satisfaction: {stats?.feedbackStats?.satisfactionRate ?? 100}%
              </span>
            </h4>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs text-[#C7D2FE] mb-1">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>High Confidence (All claims cited & grounded)</span>
                  </span>
                  <span className="font-semibold text-emerald-300 font-mono">{stats?.confidenceDistribution?.high ?? 0}</span>
                </div>
                <div className="w-full h-2 bg-[#1E223D] rounded-full overflow-hidden border border-[#363B5E]">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                    style={{
                      width: `${
                        stats?.totalQueries
                          ? ((stats.confidenceDistribution.high / stats.totalQueries) * 100).toFixed(0)
                          : 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#C7D2FE] mb-1">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Medium Confidence (Partial match / slight ambiguity)</span>
                  </span>
                  <span className="font-semibold text-amber-300 font-mono">{stats?.confidenceDistribution?.medium ?? 0}</span>
                </div>
                <div className="w-full h-2 bg-[#1E223D] rounded-full overflow-hidden border border-[#363B5E]">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
                    style={{
                      width: `${
                        stats?.totalQueries
                          ? ((stats.confidenceDistribution.medium / stats.totalQueries) * 100).toFixed(0)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#C7D2FE] mb-1">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>Low Confidence (Requires manual verification / unanswerable)</span>
                  </span>
                  <span className="font-semibold text-rose-300 font-mono">{stats?.confidenceDistribution?.low ?? 0}</span>
                </div>
                <div className="w-full h-2 bg-[#1E223D] rounded-full overflow-hidden border border-[#363B5E]">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"
                    style={{
                      width: `${
                        stats?.totalQueries
                          ? ((stats.confidenceDistribution.low / stats.totalQueries) * 100).toFixed(0)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* System Rules & Guardrails Section */}
          <div className="p-4 rounded-xl border border-[#363B5E] bg-[#17192F] space-y-2.5">
            <h4 className="text-xs font-semibold text-cyan-300 font-heading uppercase tracking-wide">
              Active System Guardrails & Invariants:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#C7D2FE]">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>Recursive splitter: 512 tokens, 50-token overlap, sentence-aware</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>Strict grounding: Answers ONLY from retrieved chunks</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>Relevance gate: Scratchpad verifies evidence before synthesis</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>Deterministic Temperature = 0 for reasoning, 0.3 for synthesis</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-[#363B5E] bg-[#181A32] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] bg-[#1E223D] border border-[#363B5E] rounded-xl hover:bg-[#282D52] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
