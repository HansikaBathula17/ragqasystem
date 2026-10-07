import React, { useState } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Plus,
  MessageSquare,
  Activity,
  RotateCcw,
  Database,
  Layers,
  Sparkles,
} from "lucide-react";
import { DocumentItem, ChatSession } from "../types";

interface SidebarProps {
  documents: DocumentItem[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onOpenUpload: () => void;
  onResetSamples: () => void;
  onDeleteDocument: (id: string) => void;
  onOpenObservability: () => void;
  onSelectDocument: (doc: DocumentItem) => void;
  activeDocId?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenUpload,
  onResetSamples,
  onDeleteDocument,
  onOpenObservability,
  onSelectDocument,
  activeDocId,
}) => {
  const [docFilter, setDocFilter] = useState<string>("all");

  const filteredDocs =
    docFilter === "all" ? documents : documents.filter((d) => d.category.toLowerCase().includes(docFilter));

  const totalChunks = documents.reduce((acc, d) => acc + d.chunkCount, 0);

  return (
    <aside
      id="rag-sidebar"
      className="w-72 bg-[#15172B] text-[#F8FAFC] border-r border-[#363B5E] flex flex-col h-full select-none shrink-0"
    >
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-[#363B5E] flex items-center justify-between bg-[#181A32]/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center font-bold shadow-md shadow-violet-600/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-tight text-white uppercase font-heading">
              RAG Reasoning Q&A
            </h1>
            <p className="text-[10px] bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent font-medium">
              Transparent 6-Stage Engine
            </p>
          </div>
        </div>
        <button
          id="observability-nav-btn"
          onClick={onOpenObservability}
          title="Observability & Telemetry"
          className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#22263F] border border-transparent hover:border-[#363B5E] transition-all"
        >
          <Activity className="w-4 h-4 text-cyan-400" />
        </button>
      </div>

      {/* Top Action: New Chat & Upload Document */}
      <div className="p-3 grid grid-cols-2 gap-2 border-b border-[#363B5E] bg-[#17192F]/50">
        <button
          id="new-chat-btn"
          onClick={onNewSession}
          className="flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-md shadow-violet-500/25 transition-all transform active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>

        <button
          id="upload-doc-sidebar-btn"
          onClick={onOpenUpload}
          className="flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg bg-[#22263F] hover:bg-[#2B3050] text-[#F8FAFC] border border-[#363B5E] hover:border-[#4F5687] text-xs font-medium transition-all shadow-xs"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>+ Upload</span>
        </button>
      </div>

      {/* Scrollable Middle: Documents & Sessions */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Knowledge Base Documents Section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center space-x-1.5 text-[11px] font-semibold tracking-wider text-[#A5B4FC] uppercase">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Knowledge Base ({documents.length})</span>
            </div>
            <button
              onClick={onResetSamples}
              title="Reset to benchmark sample policies (Q1, Q3, etc.)"
              className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center space-x-1 hover:underline transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {filteredDocs.length === 0 ? (
              <div className="p-3 text-center border border-dashed border-[#363B5E] rounded-xl text-[#94A3B8] text-xs bg-[#1E223D]/40">
                No documents loaded. Click "+ Upload" or "Reset" to load benchmark policies.
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = activeDocId === doc.id;
                return (
                  <div
                    key={doc.id}
                    id={`doc-item-${doc.id}`}
                    onClick={() => onSelectDocument(doc)}
                    className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-[#282D52] border-violet-500/80 text-white shadow-md shadow-violet-900/30"
                        : "bg-[#1E223D]/80 hover:bg-[#262B4D] border-[#363B5E] hover:border-[#4F5687] text-[#C7D2FE]"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <div className="w-6 h-6 rounded-lg bg-[#15172B] border border-[#363B5E] flex items-center justify-center shrink-0 text-cyan-400">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate flex-1">
                        <p className="text-xs font-medium truncate text-[#F8FAFC]">{doc.name}</p>
                        <p className="text-[10px] text-[#94A3B8] flex items-center space-x-1.5 mt-0.5">
                          <span>{doc.chunkCount} chunks</span>
                          <span className="text-[#363B5E]">•</span>
                          <span className="truncate">{doc.category}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDocument(doc.id);
                      }}
                      title="Delete document"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#94A3B8] hover:text-rose-400 hover:bg-[#15172B] rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat History Section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1 text-[11px] font-semibold tracking-wider text-[#A5B4FC] uppercase">
            <div className="flex items-center space-x-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
              <span>Chat Sessions ({sessions.length})</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  id={`session-item-${sess.id}`}
                  onClick={() => onSelectSession(sess.id)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border ${
                    isActive
                      ? "bg-[#282D52] text-white border-violet-500/80 shadow-md shadow-violet-900/30"
                      : "bg-[#1E223D]/60 hover:bg-[#262B4D] border-[#363B5E] text-[#94A3B8] hover:text-[#F8FAFC]"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate flex-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? "text-cyan-400" : "text-[#64748B]"
                      }`}
                    />
                    <span className="text-xs font-medium truncate">{sess.title}</span>
                  </div>

                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(sess.id);
                      }}
                      title="Delete session"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#94A3B8] hover:text-rose-400 hover:bg-[#15172B] rounded-lg transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Knowledge Base Stats Badge */}
      <div className="p-3 border-t border-[#363B5E] bg-[#15172B]/90">
        <div className="p-2.5 rounded-xl bg-[#1E223D] border border-[#363B5E] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#C7D2FE]">
            <div className="flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              <span className="font-medium">Dense Vector Index</span>
            </div>
            <span className="font-mono text-cyan-400 font-semibold">{totalChunks} chunks</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
            <span>Retrieval Top-K: 8 → Rerank: 4</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-xs shadow-emerald-400" />
          </div>
        </div>
      </div>
    </aside>
  );
};
