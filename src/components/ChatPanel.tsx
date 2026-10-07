import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { ChatMessage, PipelineQueryResponse } from "../types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (query: string) => void;
  onCitationClick: (citationId: number, queryResult?: PipelineQueryResponse) => void;
  onShowReasoningClick: (queryResult: PipelineQueryResponse) => void;
  onShowSourcesClick: (queryResult: PipelineQueryResponse) => void;
  onOpenFeedback: (queryId: string, question: string, answer: string, isHelpful: boolean) => void;
  activeSessionTitle?: string;
  hasDocuments: boolean;
  onOpenUpload: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onCitationClick,
  onShowReasoningClick,
  onShowSourcesClick,
  onOpenFeedback,
  activeSessionTitle,
  hasDocuments,
  onOpenUpload,
}) => {
  const [inputQuery, setInputQuery] = useState("");
  const [inlineReasoningOpen, setInlineReasoningOpen] = useState<Record<string, boolean>>({});
  const [inlineSourcesOpen, setInlineSourcesOpen] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!inputQuery.trim() || isLoading) return;
    onSendMessage(inputQuery.trim());
    setInputQuery("");
  };

  const toggleInlineReasoning = (msgId: string) => {
    setInlineReasoningOpen((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleInlineSources = (msgId: string) => {
    setInlineSourcesOpen((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Render text replacing [1], [2] with clickable superscript buttons styled with secondary amber accent
  const renderFormattedAnswer = (
    text: string,
    queryResult?: PipelineQueryResponse
  ) => {
    const parts = text.split(/(\[\d+\])/g);

    return parts.map((part, idx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const citationId = parseInt(match[1], 10);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onCitationClick(citationId, queryResult)}
            title={`Inspect Citation [${citationId}] in Details Panel`}
            className="inline-flex items-center justify-center text-[10px] font-bold font-mono text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-400 rounded px-1.5 py-0.5 mx-0.5 align-super cursor-pointer transition-all shadow-xs"
          >
            [{citationId}]
          </button>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const samplePrompts = [
    "How do the Q1 and Q3 refund policies differ?",
    "What are the idle session timeout and MFA requirements?",
    "Can digital goods be refunded after 20 days?",
    "What is the annual remote work equipment stipend?",
  ];

  return (
    <main
      id="rag-chat-panel"
      className="flex-1 flex flex-col h-full bg-[#17192F] overflow-hidden relative"
    >
      {/* Top Header */}
      <header className="px-6 py-3.5 bg-[#15172B] border-b border-[#363B5E] flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#1E223D] border border-[#363B5E] flex items-center justify-center text-cyan-400">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-semibold text-[#F8FAFC] truncate font-heading">
            {activeSessionTitle || "Grounded Q&A Workspace"}
          </h2>
          <span className="hidden sm:inline-block text-[10px] font-mono px-2.5 py-0.5 bg-[#1E223D] text-[#C7D2FE] border border-[#363B5E] rounded-md">
            Grounded Mode (Anti-Hallucination)
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="inline-flex items-center space-x-1.5 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Reasoning Layer Active</span>
          </span>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty / First-run state */
          <div className="max-w-2xl mx-auto my-auto py-10 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-600/30 to-cyan-500/20 border border-violet-500/40 text-cyan-300 flex items-center justify-center shadow-lg shadow-violet-600/20">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white font-heading">
                End-to-End RAG Q&A with AI Reasoning
              </h3>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                Answers natural-language questions strictly from indexed policy and knowledge documents.
                Features query decomposition, vector retrieval, cross-encoder reranking, and transparent verification.
              </p>
            </div>

            {/* Quick-starter benchmark prompts */}
            <div className="space-y-2.5 max-w-lg mx-auto text-left">
              <p className="text-[11px] font-semibold text-[#A5B4FC] uppercase tracking-wider text-center">
                Benchmark Verification Questions:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {samplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSendMessage(prompt)}
                    className="text-left p-3 rounded-xl bg-[#1E223D] hover:bg-[#262B4D] border border-[#363B5E] hover:border-cyan-400/60 text-xs text-[#C7D2FE] hover:text-white transition-all shadow-xs group flex items-center justify-between"
                  >
                    <span className="line-clamp-2">{prompt}</span>
                    <Send className="w-3.5 h-3.5 text-[#64748B] group-hover:text-cyan-400 shrink-0 ml-1.5 transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {!hasDocuments && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 max-w-md mx-auto flex items-center justify-between">
                <span>No documents in knowledge base.</span>
                <button
                  onClick={onOpenUpload}
                  className="font-semibold text-cyan-400 hover:underline"
                >
                  Upload documents
                </button>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            const qResult = msg.queryResult;
            const isErrorMsg =
              msg.isError ||
              (msg.role === "assistant" &&
                (msg.content.includes("Too many requests") ||
                  msg.content.includes("exceeds maximum length") ||
                  msg.content.startsWith("Failed to process")));

            return (
              <div
                key={msg.id}
                id={`message-bubble-${msg.id}`}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                {/* Bubble Container */}
                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3.5 shadow-md text-xs leading-relaxed ${
                    isUser
                      ? "bg-gradient-to-r from-violet-700 to-indigo-800 text-white rounded-br-xs border border-violet-500/40 shadow-violet-900/30"
                      : isErrorMsg
                      ? "bg-rose-950/40 text-rose-200 border border-rose-500/50 rounded-bl-xs"
                      : "bg-[#1E223D] text-[#F8FAFC] border border-[#363B5E] rounded-bl-xs"
                  }`}
                >
                  {isUser ? (
                    <p className="font-sans whitespace-pre-wrap">{msg.content}</p>
                  ) : isErrorMsg ? (
                    <div className="flex items-start space-x-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-rose-300">{msg.content}</p>
                        <p className="text-[10px] text-rose-400/80 mt-1">
                          Rate limit / API constraint triggered. Please adjust your request or retry shortly.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Main Answer text with interactive inline citations */}
                      <div className="font-sans text-[13px] leading-relaxed text-[#F8FAFC]">
                        {renderFormattedAnswer(msg.content, qResult)}
                      </div>

                      {qResult && (
                        <>
                          {/* Confidence Badge & Telemetry */}
                          <div className="pt-2 border-t border-[#363B5E] flex flex-wrap items-center gap-2">
                            {/* Confidence pill */}
                            <span
                              className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                qResult.confidence === "high"
                                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                                  : qResult.confidence === "medium"
                                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                                  : "bg-rose-500/15 text-rose-300 border border-rose-500/40"
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>
                                Confidence:{" "}
                                {qResult.confidence === "low"
                                  ? "Low — verify manually"
                                  : qResult.confidence.charAt(0).toUpperCase() + qResult.confidence.slice(1)}
                              </span>
                            </span>

                            {/* Collapsible Action: Show Reasoning (Amber Secondary Accent) */}
                            <button
                              type="button"
                              onClick={() => {
                                toggleInlineReasoning(msg.id);
                                onShowReasoningClick(qResult);
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium text-amber-400 hover:text-amber-300 bg-[#17192F] hover:bg-[#262B4D] border border-[#363B5E] hover:border-amber-400/40 transition-colors"
                            >
                              {inlineReasoningOpen[msg.id] ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                              <span>
                                {inlineReasoningOpen[msg.id]
                                  ? "Hide reasoning"
                                  : `Show reasoning (${qResult.reasoning_trace.length} steps)`}
                              </span>
                            </button>

                            {/* Collapsible Action: Sources (Cyan/Violet Accent) */}
                            {qResult.citations.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  toggleInlineSources(msg.id);
                                  onShowSourcesClick(qResult);
                                }}
                                className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium text-cyan-300 hover:text-cyan-200 bg-[#17192F] hover:bg-[#262B4D] border border-[#363B5E] hover:border-cyan-400/40 transition-colors"
                              >
                                {inlineSourcesOpen[msg.id] ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                                <span>
                                  Sources ({qResult.citations.length})
                                </span>
                              </button>
                            )}

                            {/* Thumbs up / down feedback */}
                            <div className="ml-auto flex items-center space-x-1.5 text-[#94A3B8]">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenFeedback(
                                    qResult.queryId,
                                    qResult.question,
                                    qResult.answer,
                                    true
                                  )
                                }
                                title="Helpful & grounded"
                                className={`p-1.5 rounded-lg hover:bg-[#262B4D] transition-colors ${
                                  msg.feedback?.isHelpful === true
                                    ? "text-emerald-400 bg-emerald-500/15 border border-emerald-500/40"
                                    : "hover:text-[#F8FAFC]"
                                }`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenFeedback(
                                    qResult.queryId,
                                    qResult.question,
                                    qResult.answer,
                                    false
                                  )
                                }
                                title="Inaccurate / not grounded"
                                className={`p-1.5 rounded-lg hover:bg-[#262B4D] transition-colors ${
                                  msg.feedback?.isHelpful === false
                                    ? "text-rose-400 bg-rose-500/15 border border-rose-500/40"
                                    : "hover:text-[#F8FAFC]"
                                }`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Inline Expanded Reasoning Preview */}
                          {inlineReasoningOpen[msg.id] && (
                            <div className="mt-2.5 p-3.5 bg-[#15172B] rounded-xl border border-amber-500/30 text-xs space-y-2 animate-fadeIn">
                              <p className="font-semibold text-amber-400 text-[11px] font-heading">
                                Reasoning Trace Scratchpad:
                              </p>
                              <ul className="space-y-1 pl-2">
                                {qResult.reasoning_trace.map((trace, tIdx) => (
                                  <li key={tIdx} className="text-[#C7D2FE] text-[11px] list-disc list-inside">
                                    {trace}
                                  </li>
                                ))}
                              </ul>
                              <p
                                className="text-[10px] text-cyan-400 cursor-pointer hover:underline pt-1"
                                onClick={() => onShowReasoningClick(qResult)}
                              >
                                View full 6-stage breakdown in Details Panel →
                              </p>
                            </div>
                          )}

                          {/* Inline Expanded Sources Preview */}
                          {inlineSourcesOpen[msg.id] && (
                            <div className="mt-2.5 p-3.5 bg-[#15172B] rounded-xl border border-cyan-500/30 text-xs space-y-2 animate-fadeIn">
                              <p className="font-semibold text-cyan-300 text-[11px] font-heading">
                                Cited Knowledge Base Chunks:
                              </p>
                              <div className="space-y-1.5">
                                {qResult.citations.map((c) => (
                                  <div
                                    key={c.id}
                                    onClick={() => onCitationClick(c.id, qResult)}
                                    className="p-2.5 bg-[#1E223D] hover:bg-[#262B4D] rounded-lg border border-[#363B5E] hover:border-cyan-400 cursor-pointer text-[11px] transition-all"
                                  >
                                    <div className="flex items-center justify-between font-semibold text-[#F8FAFC]">
                                      <span>
                                        [{c.id}] {c.doc} (p.{c.page})
                                      </span>
                                      <span className="text-[10px] text-cyan-400 font-mono">
                                        {(c.similarity * 100).toFixed(0)}% match
                                      </span>
                                    </div>
                                    <p className="text-[#94A3B8] mt-1 line-clamp-2">{c.text}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-[#64748B] mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}

        {/* Live Loading Pipeline Animation */}
        {isLoading && (
          <div className="flex flex-col items-start space-y-1">
            <div className="p-4 bg-[#1E223D] rounded-2xl rounded-bl-xs border border-[#363B5E] shadow-lg text-xs space-y-2.5 max-w-sm">
              <div className="flex items-center space-x-2 text-cyan-400 font-semibold font-heading">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                <span>Executing AI Reasoning Pipeline...</span>
              </div>
              <div className="text-[11px] text-[#94A3B8] space-y-1 pl-6">
                <p className="animate-pulse text-[#C7D2FE]">• [1] Query Decomposition & Intent Parsing</p>
                <p className="animate-pulse text-[#C7D2FE]">• [2] Vector Retrieval (top-k=8)</p>
                <p className="animate-pulse text-[#C7D2FE]">• [3] Cross-Encoder Reranking to top-4</p>
                <p className="animate-pulse text-[#C7D2FE]">• [4] Scratchpad Reasoning & Conflict Analysis</p>
                <p className="animate-pulse text-[#C7D2FE]">• [5] Grounded Synthesis (T=0.3)</p>
                <p className="animate-pulse text-[#C7D2FE]">• [6] Groundedness & Anti-Hallucination Audit</p>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <footer className="p-3 sm:p-4 bg-[#15172B] border-t border-[#363B5E] shrink-0">
        <div className="max-w-3xl mx-auto relative flex items-center">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question (e.g. How do the Q1 and Q3 refund policies differ?)..."
            className="w-full text-xs sm:text-sm pl-4 pr-12 py-3 bg-[#1E223D] border border-[#363B5E] rounded-xl focus:outline-hidden focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 text-[#F8FAFC] resize-none shadow-inner transition-all placeholder:text-[#64748B]"
          />
          <button
            id="send-query-btn"
            type="button"
            onClick={handleSubmit}
            disabled={!inputQuery.trim() || isLoading}
            className="absolute right-2.5 p-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md shadow-violet-500/25 transition-all"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-center text-[#64748B] mt-1.5">
          Grounded RAG: Answers strictly from indexed knowledge base chunks. Press Enter to submit. Max 2,000 chars.
        </p>
      </footer>
    </main>
  );
};
