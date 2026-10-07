import React, { useState } from "react";
import { X, ThumbsUp, ThumbsDown, Send, CheckCircle2 } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryId: string;
  question: string;
  answer: string;
  initialHelpful: boolean;
  onSubmitted: (isHelpful: boolean, comment?: string) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  queryId,
  question,
  answer,
  initialHelpful,
  onSubmitted,
}) => {
  const [isHelpful, setIsHelpful] = useState(initialHelpful);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryId,
          question,
          answer,
          isHelpful,
          comment: comment.trim() || undefined,
        }),
      });
      setSubmitted(true);
      onSubmitted(isHelpful, comment.trim() || undefined);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
      }, 1000);
    } catch (err) {
      console.error("Feedback error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="feedback-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    >
      <div
        id="feedback-modal-card"
        className="w-full max-w-md bg-[#1E223D] rounded-2xl shadow-2xl border border-[#363B5E] overflow-hidden text-[#F8FAFC]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#363B5E] bg-[#181A32]">
          <h3 className="text-sm font-bold text-white font-heading">Provide Response Feedback</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#282D52] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white font-heading">Thank you for your feedback!</h4>
            <p className="text-xs text-[#94A3B8]">Your review calibrates the grounding and reasoning verifier.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <p className="text-xs text-[#C7D2FE] mb-2.5">Was this grounded answer accurate and helpful?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsHelpful(true)}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    isHelpful
                      ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-950/40"
                      : "bg-[#17192F] border-[#363B5E] text-[#94A3B8] hover:bg-[#262B4D] hover:text-[#F8FAFC]"
                  }`}
                >
                  <ThumbsUp className="w-4 h-4 text-emerald-400" />
                  <span>Helpful & Grounded</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHelpful(false)}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    !isHelpful
                      ? "bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-md shadow-rose-950/40"
                      : "bg-[#17192F] border-[#363B5E] text-[#94A3B8] hover:bg-[#262B4D] hover:text-[#F8FAFC]"
                  }`}
                >
                  <ThumbsDown className="w-4 h-4 text-rose-400" />
                  <span>Inaccurate</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#C7D2FE] mb-1.5">
                Optional comments or citation review
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What was missing or could be improved about the citations or reasoning?"
                rows={3}
                className="w-full text-xs p-3 bg-[#17192F] border border-[#363B5E] rounded-xl text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
              />
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] rounded-xl hover:bg-[#282D52] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-40 rounded-xl shadow-md shadow-violet-500/25 flex items-center space-x-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Feedback</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
