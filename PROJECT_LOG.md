# Project Development Log — RAG Q&A System with AI Reasoning

## System Summary
- **Architecture**: Full-Stack Enterprise RAG with 6-stage AI reasoning pipeline.
- **Backend**: Express + Node.js with `@google/genai` (Gemini 3.8 Flash, embeddings, deterministic reasoning at T=0, synthesis at T=0.3).
- **Vector Retrieval**: Dense cosine similarity vector store with top-k=8 candidate retrieval and top-k=4 cross-relevance reranker.
- **Frontend**: React 19 + Tailwind CSS + Lucide icons + responsive 3-column layout.

## Pipeline Flow Verified
```
User Question
 │
 ▼
[1] Query Decomposition ──► Multi-entity / comparative triggers split into sub-questions
 │
 ▼
[2] Vector Retrieval ──► Top-k=8 candidate chunks fetched via vector similarity
 │
 ▼
[3] Reranker ──► Filtered and scored down to Top-4 most relevant chunks
 │
 ▼
[4] Reasoning Layer ──► Scratchpad: what chunks support, nuance/conflict detection, evidence gaps
 │
 ▼
[5] Groundedness / Hallucination Check ──► Verification audit, confidence rating (High/Med/Low)
 │
 ▼
[6] Final Answer + Inline Citations [1], [2] ──► UI Chat Panel & Stepper Details
```

## Benchmark Verification Case
- **Query**: "How do the Q1 and Q3 refund policies differ?"
- **Expected Decomposed Sub-Questions**:
  1. (a) Q1 refund window and conditions
  2. (b) Q3 refund window and scope updates
- **Retrieved Chunks**:
  - `refund_policy_q1.pdf` (Page 2, Section 2.1) -> 30 calendar days return window for physical/unopened goods.
  - `refund_policy_q3.pdf` (Page 1, Section 1.0) -> Return window reduced to 14 days for digital goods; physical goods retain 30-day baseline.
- **Reasoning Scratchpad**:
  - Chunk 1 supports 30-day window for Q1.
  - Chunk 2 supports 14-day window for digital goods in Q3.
  - No direct conflict: Q3 is an amendment scoped to digital media, not a full repeal.
- **Groundedness Result**: Confidence: High (100% grounded in provided documents).
