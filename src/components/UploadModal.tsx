import React, { useState, useRef } from "react";
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Company Policies");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setSelectedFile(f);
      if (!title) setTitle(f.name);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      if (!title) setTitle(f.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === "file") {
        if (!selectedFile) {
          throw new Error("Please select a file to upload.");
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", title || selectedFile.name);
        formData.append("category", category);

        const res = await fetch("/api/ingest", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setSuccessMsg(`Successfully ingested ${data.document.name} into ${data.chunksGenerated} chunks.`);
      } else {
        if (!rawText.trim()) {
          throw new Error("Please paste document text to ingest.");
        }
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || "pasted_document.txt",
            text: rawText,
            category,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ingestion failed");
        setSuccessMsg(`Successfully ingested into ${data.chunksGenerated} chunks.`);
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to ingest document.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="upload-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    >
      <div
        id="upload-modal-card"
        className="w-full max-w-lg bg-[#1E223D] rounded-2xl shadow-2xl border border-[#363B5E] overflow-hidden text-[#F8FAFC]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#363B5E] bg-[#181A32]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-violet-600/30">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-heading">Ingest Knowledge Document</h3>
              <p className="text-xs text-[#94A3B8]">Add to vector knowledge base (rate limited)</p>
            </div>
          </div>
          <button
            id="close-upload-modal-btn"
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#282D52] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[#363B5E] px-6 pt-3 space-x-6 bg-[#17192F]">
          <button
            type="button"
            onClick={() => setTab("file")}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-all ${
              tab === "file"
                ? "border-cyan-400 text-cyan-300 font-semibold"
                : "border-transparent text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            Upload File (PDF / DOCX / TXT)
          </button>
          <button
            type="button"
            onClick={() => setTab("paste")}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-all ${
              tab === "paste"
                ? "border-cyan-400 text-cyan-300 font-semibold"
                : "border-transparent text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            Paste Raw Content
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-start space-x-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-start space-x-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === "file" ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#363B5E] hover:border-cyan-400 hover:bg-[#262B4D]/50 rounded-2xl p-6 text-center cursor-pointer transition-all bg-[#17192F]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,.json"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 mx-auto rounded-xl bg-[#1E223D] border border-[#363B5E] flex items-center justify-center text-cyan-400 mb-2.5">
                <FileText className="w-6 h-6" />
              </div>
              {selectedFile ? (
                <div>
                  <p className="text-xs font-semibold text-white">{selectedFile.name}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Click to choose different file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-[#C7D2FE]">Drag & drop your document here, or click to browse</p>
                  <p className="text-[11px] text-[#64748B] mt-1">Supports PDF, DOCX, TXT, Markdown (Max 25MB)</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[#C7D2FE] mb-1.5">Document Text</label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the document text, policy clauses, or handbook notes here..."
                rows={6}
                className="w-full text-xs font-mono p-3 bg-[#17192F] border border-[#363B5E] rounded-xl text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#C7D2FE] mb-1.5">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q4 Policy Update"
                className="w-full text-xs px-3 py-2 bg-[#17192F] border border-[#363B5E] rounded-xl text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#C7D2FE] mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#17192F] border border-[#363B5E] rounded-xl text-[#F8FAFC] focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
              >
                <option value="Company Policies">Company Policies</option>
                <option value="Technical Standards">Technical Standards</option>
                <option value="HR & People">HR & People</option>
                <option value="Finance & Legal">Finance & Legal</option>
                <option value="General Knowledge">General Knowledge</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] rounded-xl hover:bg-[#282D52] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (tab === "file" && !selectedFile) || (tab === "paste" && !rawText.trim())}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md shadow-violet-500/25 flex items-center space-x-1.5 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Chunking & Indexing...</span>
                </>
              ) : (
                <span>Ingest into Knowledge Base</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
