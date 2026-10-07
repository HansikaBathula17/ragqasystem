import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { DetailsPanel } from "./components/DetailsPanel";
import { UploadModal } from "./components/UploadModal";
import { FeedbackModal } from "./components/FeedbackModal";
import { ObservabilityModal } from "./components/ObservabilityModal";
import { DocumentDetailModal } from "./components/DocumentDetailModal";
import {
  DocumentItem,
  ChatSession,
  ChatMessage,
  PipelineQueryResponse,
} from "./types";

export default function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [activeQueryResult, setActiveQueryResult] = useState<PipelineQueryResponse | null>(null);
  const [selectedCitationId, setSelectedCitationId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"reasoning" | "sources" | "telemetry">("reasoning");
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isObservabilityOpen, setIsObservabilityOpen] = useState(false);
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<DocumentItem | null>(null);
  const [feedbackState, setFeedbackState] = useState<{
    isOpen: boolean;
    queryId: string;
    question: string;
    answer: string;
    isHelpful: boolean;
  }>({
    isOpen: false,
    queryId: "",
    question: "",
    answer: "",
    isHelpful: true,
  });

  // Fetch initial documents and sessions
  const loadData = async () => {
    try {
      const [docsRes, sessRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/sessions"),
      ]);
      const docsData = await docsRes.json();
      const sessData: ChatSession[] = await sessRes.json();

      setDocuments(docsData);
      setSessions(sessData);

      if (sessData.length > 0 && !activeSessionId) {
        setActiveSessionId(sessData[0].id);
        setCurrentSession(sessData[0]);
        // Set last assistant message queryResult as active if available
        const lastMsg = [...sessData[0].messages].reverse().find((m) => m.queryResult);
        if (lastMsg?.queryResult) {
          setActiveQueryResult(lastMsg.queryResult);
        }
      }
    } catch (err) {
      console.error("Initialization error:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update currentSession when activeSessionId changes
  useEffect(() => {
    if (activeSessionId) {
      const found = sessions.find((s) => s.id === activeSessionId);
      if (found) {
        setCurrentSession(found);
        const lastMsg = [...found.messages].reverse().find((m) => m.queryResult);
        if (lastMsg?.queryResult) {
          setActiveQueryResult(lastMsg.queryResult);
        }
      }
    }
  }, [activeSessionId, sessions]);

  // Handle Query Submission
  const handleSendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: question.trim(),
      timestamp: new Date().toISOString(),
    };

    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        messages: [...currentSession.messages, tempUserMsg],
      });
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          sessionId: activeSessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Query failed");

      setActiveQueryResult(data);
      if (isDetailsCollapsed) {
        setIsDetailsCollapsed(false);
      }

      // Refresh sessions
      const sessRes = await fetch("/api/sessions");
      const sessData: ChatSession[] = await sessRes.json();
      setSessions(sessData);

      if (data.sessionId) {
        setActiveSessionId(data.sessionId);
        const updated = sessData.find((s) => s.id === data.sessionId);
        if (updated) setCurrentSession(updated);
      }
    } catch (err: any) {
      console.error("Send query error:", err);
      // Append clear error assistant message
      if (currentSession) {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: err?.message || "Failed to process query. Please try again.",
          timestamp: new Date().toISOString(),
          isError: true,
        };
        setCurrentSession({
          ...currentSession,
          messages: [...currentSession.messages, errorMsg],
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Session Handlers
  const handleNewSession = async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Q&A Session" }),
      });
      const newSess: ChatSession = await res.json();
      setSessions([newSess, ...sessions]);
      setActiveSessionId(newSess.id);
      setCurrentSession(newSess);
      setActiveQueryResult(null);
    } catch (err) {
      console.error("New session error:", err);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      const updated = sessions.filter((s) => s.id !== id);
      setSessions(updated);
      if (activeSessionId === id && updated.length > 0) {
        setActiveSessionId(updated[0].id);
        setCurrentSession(updated[0]);
      }
    } catch (err) {
      console.error("Delete session error:", err);
    }
  };

  // Reset to Benchmark Samples
  const handleResetSamples = async () => {
    try {
      const res = await fetch("/api/documents/reset", { method: "POST" });
      const data = await res.json();
      setDocuments(data.documents);
      await loadData();
    } catch (err) {
      console.error("Reset samples error:", err);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (id: string) => {
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setDocuments(documents.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Delete document error:", err);
    }
  };

  // Citation click handler (from chat superscripts [1], [2])
  const handleCitationClick = (citationId: number, qResult?: PipelineQueryResponse) => {
    if (qResult) {
      setActiveQueryResult(qResult);
    }
    setSelectedCitationId(citationId);
    setActiveTab("sources");
    setIsDetailsCollapsed(false);
  };

  const handleShowReasoning = (qResult: PipelineQueryResponse) => {
    setActiveQueryResult(qResult);
    setActiveTab("reasoning");
    setIsDetailsCollapsed(false);
  };

  const handleShowSources = (qResult: PipelineQueryResponse) => {
    setActiveQueryResult(qResult);
    setActiveTab("sources");
    setIsDetailsCollapsed(false);
  };

  const handleOpenFeedback = (
    queryId: string,
    question: string,
    answer: string,
    isHelpful: boolean
  ) => {
    setFeedbackState({
      isOpen: true,
      queryId,
      question,
      answer,
      isHelpful,
    });
  };

  const handleFeedbackSubmitted = (isHelpful: boolean, comment?: string) => {
    // Update local session message state
    if (currentSession) {
      const updatedMessages = currentSession.messages.map((m) => {
        if (m.queryResult?.queryId === feedbackState.queryId) {
          return {
            ...m,
            feedback: {
              isHelpful,
              comment,
              createdAt: new Date().toISOString(),
            },
          };
        }
        return m;
      });
      setCurrentSession({
        ...currentSession,
        messages: updatedMessages,
      });
    }
  };

  return (
    <div id="app-container" className="flex h-screen w-screen overflow-hidden bg-[#131525] text-[#F8FAFC] font-sans">
      {/* Column 1: Sidebar */}
      <Sidebar
        documents={documents}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => setActiveSessionId(id)}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onOpenUpload={() => setIsUploadOpen(true)}
        onResetSamples={handleResetSamples}
        onDeleteDocument={handleDeleteDocument}
        onOpenObservability={() => setIsObservabilityOpen(true)}
        onSelectDocument={(doc) => setSelectedDocForDetail(doc)}
        activeDocId={selectedDocForDetail?.id}
      />

      {/* Column 2: Chat Panel */}
      <ChatPanel
        messages={currentSession?.messages || []}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onCitationClick={handleCitationClick}
        onShowReasoningClick={handleShowReasoning}
        onShowSourcesClick={handleShowSources}
        onOpenFeedback={handleOpenFeedback}
        activeSessionTitle={currentSession?.title}
        hasDocuments={documents.length > 0}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      {/* Column 3: Details Panel */}
      <DetailsPanel
        activeQueryResult={activeQueryResult}
        selectedCitationId={selectedCitationId}
        onSelectCitation={(id) => setSelectedCitationId(id)}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        isCollapsed={isDetailsCollapsed}
        onToggleCollapse={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
      />

      {/* Upload Document Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* Feedback Dialog */}
      <FeedbackModal
        isOpen={feedbackState.isOpen}
        onClose={() => setFeedbackState((prev) => ({ ...prev, isOpen: false }))}
        queryId={feedbackState.queryId}
        question={feedbackState.question}
        answer={feedbackState.answer}
        initialHelpful={feedbackState.isHelpful}
        onSubmitted={handleFeedbackSubmitted}
      />

      {/* Observability & Pipeline Metrics Modal */}
      <ObservabilityModal
        isOpen={isObservabilityOpen}
        onClose={() => setIsObservabilityOpen(false)}
      />

      {/* Document Detail & Chunks Inspection Modal */}
      <DocumentDetailModal
        document={selectedDocForDetail}
        onClose={() => setSelectedDocForDetail(null)}
        onDelete={(id) => {
          handleDeleteDocument(id);
          setSelectedDocForDetail(null);
        }}
      />
    </div>
  );
}
