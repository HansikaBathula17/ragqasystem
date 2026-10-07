import express from "express";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { PDFParse } from "pdf-parse";
import { createServer as createViteServer } from "vite";
import { db, ChatMessage } from "./server/db";
import { runRagReasoningPipeline } from "./server/rag/pipeline";

dotenv.config();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Rate limiting settings with sane defaults and environment variable overrides
const QUERY_WINDOW_MS = Number(process.env.RATE_LIMIT_QUERY_WINDOW_MS) || 10 * 60 * 1000;
const QUERY_MAX = Number(process.env.RATE_LIMIT_QUERY_MAX) || 20;

const INGEST_WINDOW_MS = Number(process.env.RATE_LIMIT_INGEST_WINDOW_MS) || 10 * 60 * 1000;
const INGEST_MAX = Number(process.env.RATE_LIMIT_INGEST_MAX) || 5;

const queryRateLimiter = rateLimit({
  windowMs: QUERY_WINDOW_MS,
  max: QUERY_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again in a few minutes." },
});

const ingestRateLimiter = rateLimit({
  windowMs: INGEST_WINDOW_MS,
  max: INGEST_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again in a few minutes." },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "30mb" }));
  app.use(express.urlencoded({ extended: true, limit: "30mb" }));

  // API Routes

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasGeminiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY",
      documentsCount: db.getDocuments().length,
      chunksCount: db.vectorStore.getAllChunks().length,
      timestamp: new Date().toISOString(),
    });
  });

  // Ingest Document (File upload or JSON raw text)
  app.post("/api/ingest", ingestRateLimiter, upload.single("file"), async (req, res) => {
    try {
      let fileName = req.body.title || req.body.name || "uploaded_document.txt";
      let content = req.body.text || "";
      let category = req.body.category || "Uploaded Knowledge";
      let fileType = "txt";

      if (req.file) {
        fileName = req.file.originalname;
        const ext = path.extname(fileName).toLowerCase().replace(".", "") || "txt";
        fileType = ext;

        // Extract text from buffer
        // UTF-8 decoding handles TXT, Markdown, CSV, JSON, and common text formats
        // For binary PDF/DOCX where text is embedded, extract printable text sequences
        const rawBuf = req.file.buffer;
        const decoded = rawBuf.toString("utf-8");

        if (ext === "pdf") {
          try {
            const parser = new PDFParse({ data: rawBuf });
            const parseResult = await parser.getText();
            content = parseResult?.text || "";
          } catch (pdfErr) {
            console.warn("[PDFParse] Failed to parse PDF document:", pdfErr);
            res.status(400).json({
              error: "Failed to parse PDF document. Please ensure it is a valid, uncorrupted PDF file.",
            });
            return;
          }

          // Check if extracted text has fewer than ~30 alphabetic characters (e.g. scanned/image-only PDFs)
          const alphaMatches = content.match(/[a-zA-Z]/g);
          const alphaCount = alphaMatches ? alphaMatches.length : 0;
          if (alphaCount < 30) {
            res.status(400).json({
              error:
                "This PDF appears to have no extractable text layer (e.g. a scanned/image-only PDF). Please upload a text-based PDF or a .txt/.md file instead.",
            });
            return;
          }
        } else {
          content = decoded;
        }
      }

      if (!content || content.trim().length < 10) {
        res.status(400).json({ error: "Document content is too short or empty." });
        return;
      }

      const doc = await db.addDocument(fileName, content, fileType, category);
      res.json({
        success: true,
        document: doc,
        chunksGenerated: doc.chunkCount,
      });
    } catch (err: any) {
      console.error("Ingest error:", err);
      res.status(500).json({ error: err?.message || "Failed to ingest document." });
    }
  });

  // List Documents
  app.get("/api/documents", (req, res) => {
    res.json(db.getDocuments());
  });

  // Get chunks for a specific document
  app.get("/api/documents/:id/chunks", (req, res) => {
    const chunks = db.getChunksForDoc(req.params.id);
    res.json(chunks);
  });

  // Delete document
  app.delete("/api/documents/:id", (req, res) => {
    const success = db.deleteDocument(req.params.id);
    res.json({ success });
  });

  // Reset to Benchmark Sample Documents
  app.post("/api/documents/reset", async (req, res) => {
    await db.resetToSamples();
    res.json({ success: true, documents: db.getDocuments() });
  });

  // Query Endpoint (Main RAG Reasoning Pipeline)
  app.post("/api/query", queryRateLimiter, async (req, res) => {
    const { question, sessionId } = req.body;
    if (!question || typeof question !== "string" || !question.trim()) {
      res.status(400).json({ error: "Question parameter is required." });
      return;
    }

    if (question.trim().length > 2000) {
      res.status(400).json({ error: "Question text exceeds maximum length of 2000 characters." });
      return;
    }

    try {
      // 1. Run the 6-stage reasoning RAG pipeline
      const pipelineResult = await runRagReasoningPipeline(question.trim(), db.vectorStore);

      // 2. Persist to session if sessionId provided
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const sessions = db.getSessions();
        currentSessionId = sessions.length > 0 ? sessions[0].id : db.createSession().id;
      }

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-u`,
        role: "user",
        content: question.trim(),
        timestamp: new Date().toISOString(),
      };

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: "assistant",
        content: pipelineResult.answer,
        timestamp: new Date().toISOString(),
        queryResult: pipelineResult,
      };

      db.addMessageToSession(currentSessionId, userMsg);
      const updatedSession = db.addMessageToSession(currentSessionId, assistantMsg);

      res.json({
        ...pipelineResult,
        sessionId: currentSessionId,
        session: updatedSession,
      });
    } catch (err: any) {
      console.error("Query pipeline error:", err);
      res.status(500).json({ error: err?.message || "Failed to process query pipeline." });
    }
  });

  // Chat Sessions
  app.get("/api/sessions", (req, res) => {
    res.json(db.getSessions());
  });

  app.get("/api/sessions/:id", (req, res) => {
    const session = db.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json(session);
  });

  app.post("/api/sessions", (req, res) => {
    const newSession = db.createSession(req.body.title);
    res.json(newSession);
  });

  app.delete("/api/sessions/:id", (req, res) => {
    const success = db.deleteSession(req.params.id);
    res.json({ success });
  });

  // Feedback (Thumbs Up / Down)
  app.post("/api/feedback", (req, res) => {
    const { queryId, question, answer, isHelpful, comment } = req.body;
    if (!queryId || typeof isHelpful !== "boolean") {
      res.status(400).json({ error: "queryId and isHelpful boolean are required." });
      return;
    }

    const record = db.saveFeedback(queryId, question || "", answer || "", isHelpful, comment);
    res.json({ success: true, feedback: record });
  });

  app.get("/api/feedback", (req, res) => {
    res.json(db.getFeedbacks());
  });

  // Observability & Pipeline Metrics
  app.get("/api/observability", (req, res) => {
    res.json(db.getObservabilityStats());
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
