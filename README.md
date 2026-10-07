# Grounded RAG Q&A System with 6-Stage AI Reasoning Pipeline

A production-grade, transparent Retrieval-Augmented Generation (RAG) system engineered to eliminate hallucination through multi-hop query decomposition, cross-encoder reranking, scratchpad reasoning, and post-synthesis groundedness auditing.

Live Deployed Demo: [https://ais-pre-e6uvce4hurrajpps75fl3f-628013411312.asia-southeast1.run.app](https://ais-pre-e6uvce4hurrajpps75fl3f-628013411312.asia-southeast1.run.app)

---

## 🎯 What This Project Does

Standard RAG systems naively concatenate top-k retrieved text into an LLM context prompt. When questions contain comparison across multiple policy revisions (e.g. Q1 baseline vs Q3 amendment), multi-part conditions, or queries outside the knowledge base, naive RAG often blends conflicting facts or confidently hallucinates false answers.

This application provides an **end-to-end grounded question-answering platform** with a **transparent 6-stage reasoning pipeline**. Every answer is strictly grounded in uploaded documents with interactive superscript citation markers (`[1]`, `[2]`), confidence scoring, and an openable step-by-step trace showing the model's intermediate analytical reasoning.

---

## 🛡️ Anti-Hallucination Design & Relevance Gating

The core architectural invariant of this system is **refusal over hallucination**: if the indexed documents do not contain factual evidence to address the query, the system explicitly responds:
> *"I don't have enough information in the knowledge base to answer this."*

### Relevance-Gating Mechanism
1. **Verbatim & Informative Lexical Checking**: Candidate chunks are evaluated against the query's primary informative terms (stripping domain stopwords and generic filler words). Chunks lacking substantive keyword presence are disqualified.
2. **Scratchpad Relevance Gate**: In the reasoning layer, the system computes `questionAddressed` and selects `relevantChunkIds`. If retrieved chunks share superficial vocabulary (e.g., general terms like "online", "policy", or "shopping") but fail to directly address the specific inquiry (e.g. asking for the difference between online and offline shopping when only online return policies exist), `questionAddressed` is marked `false`.
3. **Compound Degradation Protection**: In the event that both the cross-encoder reranker and reasoning scratchpad operate in heuristic fallback mode (such as during sustained Gemini API rate-limiting spikes), the pipeline activates a stricter answerability threshold (`ANSWERABILITY_THRESHOLD_FULLY_DEGRADED = 0.75`), requiring literal query-term coverage and explicit heuristic passage verification before allowing synthesis.

---

## 🏗️ 6-Stage Architecture Overview

```
User Query
    │
    ▼
[1] Query Decomposition ──► Multi-entity / comparative triggers split into focused sub-questions
    │
    ▼
[2] Vector Retrieval ──► Cosine similarity search (top-k=8) against dense chunk embeddings
    │
    ▼
[3] Cross-Encoder Reranking ──► Relevance scoring filters candidate set to top-4 high-relevance chunks
    │
    ▼
[4] Reasoning Scratchpad ──► Evaluates evidence, surfaces policy nuances/revisions, detects gaps
    │
    ▼
[5] Grounded Synthesis ──► Synthesizes factual answer with inline citation tags [1], [2] at T=0.3
    │
    ▼
[6] Groundedness Audit ──► Post-hoc verification checking claim provenance and assigning confidence
```

### Degraded-Mode Fallback Resilience
Every stage in the pipeline features a deterministic local fallback path:
- **Embedding Fallback**: 384-dimensional deterministic semantic vector hasher with character trigrams for sub-word morphology.
- **Decomposition Fallback**: Regex-driven linguistic clause and conjunction parser.
- **Reranker Fallback**: IDF-weighted lexical density scoring with position discounts and domain stopword suppression.
- **Scratchpad Fallback**: Heuristic term-frequency support analyzer with verbatim term verification.
- **Synthesis Fallback**: Safe refusal response when evidence is insufficient or offline.
- **UI Degradation Visibility**: Full transparency via visual status badges indicating whether each step executed via live LLM or heuristic fallback.

---

## 💻 Tech Stack

- **Backend**: Express.js (Node.js runtime, TypeScript)
- **AI SDK**: `@google/genai` (official Google Gen AI TypeScript SDK)
- **Models**:
  - `gemini-embedding-2-preview` (Vector Embeddings)
  - `gemini-3.8-flash` (Deterministic Reasoning at T=0, Synthesis at T=0.3)
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React icons
- **Build & Dev Tooling**: Vite 6, tsx, esbuild
- **Document Ingestion**: Multi-format parser supporting PDF (`pdf-parse`), DOCX, TXT, and Markdown

---

## 🔒 Security & Abuse Protection

- **IP-Based Rate Limiting (`express-rate-limit`)**:
  - `/api/query`: 20 requests per 10-minute window per IP (configurable via `RATE_LIMIT_QUERY_MAX` and `RATE_LIMIT_QUERY_WINDOW_MS`).
  - `/api/ingest`: 5 document uploads per 10-minute window per IP (configurable via `RATE_LIMIT_INGEST_MAX` and `RATE_LIMIT_INGEST_WINDOW_MS`).
  - HTTP 429 returns `{ "error": "Too many requests, please try again in a few minutes." }` with friendly UI handling.
- **Request Body Capping**:
  - Max query length capped at 2,000 characters to prevent buffer exhaustion and injection abuse.
  - Multi-part file upload cap set to 25MB per document.
- **Model Deprecation Diagnostics**:
  - Model identifiers are centralized in `server/gemini.ts` with environment variable overrides (`EMBEDDING_MODEL`, `REASONING_MODEL`).
  - Dedicated server-side warnings for 404/deprecated model statuses for rapid triage.

---

## 🚀 Local Setup Instructions

### Prerequisites
- Node.js (v18+ or v20+)
- npm or bun
- Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### 1. Clone & Install
```bash
git clone <repository-url>
cd rag-reasoning-system
npm install
```

### 2. Configure Environment
Create a `.env` file from the provided `.env.example`:
```bash
cp .env.example .env
```
Populate `.env` with your Gemini API key:
```env
GEMINI_API_KEY="your-gemini-api-key-here"
EMBEDDING_MODEL="gemini-embedding-2-preview"
REASONING_MODEL="gemini-3.8-flash"
RATE_LIMIT_QUERY_MAX=20
RATE_LIMIT_QUERY_WINDOW_MS=600000
RATE_LIMIT_INGEST_MAX=5
RATE_LIMIT_INGEST_WINDOW_MS=600000
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The server mounts Vite development middlewares and serves the full-stack app.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## ⚠️ Known Limitations

1. **In-Memory JSON Storage**: Document chunks and session logs are persisted in a local JSON vector store (`.data/store.json`). This is designed for rapid single-instance deployment and developer demos; horizontal multi-instance scaling requires migrating to a managed vector database (e.g. Pinecone, Qdrant, or Cloud SQL pgvector).
2. **Single Shared API Key**: The public demo utilizes a single shared API key subject to standard Gemini rate limits; when rate-limited, the system safely falls back to local heuristic reasoning.
3. **No User Accounts / Multi-Tenancy**: Sessions are stored client-locally and in the shared demo state without password authentication or RBAC.
4. **Desktop-First Optimized UI**: The 3-column layout (Sidebar, Chat Feed, Details Panel) is optimized for desktop and tablet screens (1024px+ width), with collapsible panels on narrower viewports.
