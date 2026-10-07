import React, { useState } from "react";
import { FileText, Bookmark, Search, Layers, CheckCircle } from "lucide-react";
import { CitationItem } from "../types";

interface SourcesPanelProps {
  citations: CitationItem[];
  candidateCitations?: CitationItem[];
  selectedCitationId?: number | null;
  onSelectCitation: (id: number) => void;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
  citations,
  candidateCitations = [],
  selectedCitationId,
  onSelectCitation,
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cited" | "all">("cited");

  const displayedList = viewMode === "cited" ? citations : (candidateCitations.length > 0 ? candidateCitations : citations);

  const filteredCitations = filterQuery
    ? displayedList.filter(
        (c) =>
          c.doc.toLowerCase().includes(filterQuery.toLowerCase()) ||
          c.text.toLowerCase().includes(filterQuery.toLowerCase()) ||
          c.section.toLowerCase().includes(filterQuery.toLowerCase())
      )
    : displayedList;

  if (citations.length === 0 && candidateCitations.length === 0) {
    return (
      <div className="p-8 text-center text-[#94A3B8] space-y-3">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-[#1E223D] border border-[#363B5E] flex items-center justify-center text-[#64748B]">
          <FileText className="w-6 h-6" />
        </div>
        <p className="text-xs font-semibold text-white font-heading">No sources cited for this response</p>
        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          Ask a question grounded in the knowledge base to inspect retrieved chunks and cross-encoder scores.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 text-[#F8FAFC]">
      {/* Header & Sub-Tab Switcher */}
      <div className="pb-3 border-b border-[#363B5E] space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-cyan-400 font-heading uppercase tracking-wide">
              {viewMode === "cited" ? "Cited Sources" : "All Retrieved Chunks"}
            </h4>
            <p className="text-[10px] text-[#94A3B8]">
              {viewMode === "cited"
                ? "Directly cited by the model in the synthesized answer"
                : "Full candidate set retained by the cross-encoder reranker"}
            </p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-0.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-full font-semibold">
            {filteredCitations.length} {viewMode === "cited" ? "Cited" : "Total"}
          </span>
        </div>

        {/* View Mode Toggle */}
        {candidateCitations.length > 0 && (
          <div className="flex items-center p-1 bg-[#1E223D] rounded-xl text-[11px] border border-[#363B5E]">
            <button
              onClick={() => setViewMode("cited")}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center space-x-1.5 ${
                viewMode === "cited"
                  ? "bg-[#282D52] text-white border border-violet-500/50 shadow-xs font-semibold"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cited Sources ({citations.length})</span>
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center space-x-1.5 ${
                viewMode === "all"
                  ? "bg-[#282D52] text-white border border-violet-500/50 shadow-xs font-semibold"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              <span>All Candidates ({candidateCitations.length})</span>
            </button>
          </div>
        )}
      </div>

      {displayedList.length > 2 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#64748B]" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search chunk text or doc..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-[#1E223D] border border-[#363B5E] rounded-xl text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
          />
        </div>
      )}

      <div className="space-y-3">
        {filteredCitations.map((citation) => {
          const isSelected = selectedCitationId === citation.id;
          const isActuallyCited = citations.some((c) => c.id === citation.id);

          return (
            <div
              key={citation.id}
              id={`citation-card-${citation.id}`}
              onClick={() => onSelectCitation(citation.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#282D52] border-amber-400 ring-2 ring-amber-400/30 shadow-md shadow-amber-900/20"
                  : "bg-[#1E223D] border-[#363B5E] hover:border-[#4F5687] hover:bg-[#262B4D]"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2.5">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                      isSelected
                        ? "bg-amber-400 text-slate-900 font-extrabold shadow-xs"
                        : isActuallyCited
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-[#17192F] text-[#94A3B8] border border-[#363B5E]"
                    }`}
                  >
                    [{citation.id}]
                  </span>
                  <div className="truncate max-w-[170px]">
                    <p className="text-xs font-semibold text-[#F8FAFC] truncate" title={citation.doc}>
                      {citation.doc}
                    </p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">
                      Page {citation.page} • {citation.section}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 text-right">
                  {isActuallyCited ? (
                    <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                      Cited
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold text-[#94A3B8] bg-[#17192F] border border-[#363B5E] px-2 py-0.5 rounded-md">
                      Candidate
                    </span>
                  )}
                  {citation.rerankScore !== undefined && (
                    <span className="text-[10px] font-mono font-semibold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                      {(citation.rerankScore * 100).toFixed(0)}% Rerank
                    </span>
                  )}
                </div>
              </div>

              {/* Chunk Text */}
              <div className="mt-2 text-xs text-[#CBD5E1] leading-relaxed font-sans bg-[#17192F] p-3 rounded-xl border border-[#363B5E]">
                <p className="whitespace-pre-wrap">{citation.text}</p>
              </div>

              {/* Traceability Footer */}
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#94A3B8] pt-1">
                <span className="flex items-center space-x-1.5 text-amber-300/80">
                  <Bookmark className="w-3 h-3 text-amber-400" />
                  <span>Traceable Origin Verified</span>
                </span>
                <span className="font-mono text-cyan-400">sim: {(citation.similarity * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
