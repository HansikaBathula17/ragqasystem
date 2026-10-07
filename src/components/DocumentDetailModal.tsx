import React, { useEffect, useState } from "react";
import { X, FileText, Layers, Hash, Calendar, Trash2 } from "lucide-react";
import { DocumentItem, DocumentChunkItem } from "../types";

interface DocumentDetailModalProps {
  document: DocumentItem | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  document,
  onClose,
  onDelete,
}) => {
  const [chunks, setChunks] = useState<DocumentChunkItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (document) {
      setLoading(true);
      fetch(`/api/documents/${document.id}/chunks`)
        .then((res) => res.json())
        .then((data) => setChunks(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [document]);

  if (!document) return null;

  return (
    <div
      id="doc-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    >
      <div
        id="doc-detail-card"
        className="w-full max-w-2xl bg-[#1E223D] rounded-2xl shadow-2xl border border-[#363B5E] overflow-hidden flex flex-col max-h-[85vh] text-[#F8FAFC]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#363B5E] bg-[#181A32]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-violet-600/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-heading">{document.name}</h3>
              <p className="text-xs text-[#94A3B8]">
                {document.category} • {document.chunkCount} Chunks (~{document.totalTokens} Tokens)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onDelete(document.id);
                onClose();
              }}
              title="Delete Document"
              className="p-1.5 text-[#94A3B8] hover:text-rose-400 rounded-lg hover:bg-[#282D52] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#282D52] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-[#C7D2FE] bg-[#17192F] p-3 rounded-xl border border-[#363B5E]">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>
                Recursive Splitter: <strong className="text-white">512 tokens</strong> / <strong className="text-white">50 overlap</strong>
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-[#94A3B8]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(document.uploadDate).toLocaleDateString()}</span>
            </div>
          </div>

          {document.description && (
            <p className="text-xs text-[#C7D2FE] bg-[#17192F] p-3 rounded-xl border border-violet-500/30">
              {document.description}
            </p>
          )}

          <div>
            <h4 className="text-xs font-semibold text-white mb-2.5 flex items-center space-x-1.5 font-heading">
              <Hash className="w-3.5 h-3.5 text-cyan-400" />
              <span>Indexed Vector Chunks ({chunks.length}):</span>
            </h4>

            {loading ? (
              <div className="py-8 text-center text-xs text-[#94A3B8]">Loading chunk vector details...</div>
            ) : (
              <div className="space-y-3">
                {chunks.map((chunk, idx) => (
                  <div
                    key={chunk.id}
                    className="p-3.5 bg-[#17192F] rounded-xl border border-[#363B5E] shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-medium text-[#C7D2FE] border-b border-[#363B5E] pb-1.5">
                      <span className="font-mono text-cyan-400 font-semibold">Chunk #{idx + 1}</span>
                      <span className="text-[#94A3B8]">
                        Page {chunk.page} • Section: {chunk.section}
                      </span>
                      <span className="text-[#64748B] font-mono text-[10px]">~{chunk.tokenCount} tokens</span>
                    </div>
                    <p className="text-xs text-[#CBD5E1] leading-relaxed font-sans whitespace-pre-wrap">
                      {chunk.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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
