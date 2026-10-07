import fs from "fs";
import path from "path";
import { DocumentChunk, recursiveChunkText } from "./rag/chunking";
import { VectorStore } from "./rag/vectorstore";
import { SAMPLE_DOCUMENTS } from "./sampleDocs";
import { PipelineQueryResponse } from "./rag/pipeline";

export interface StoredDocument {
  id: string;
  name: string;
  category: string;
  description?: string;
  uploadDate: string;
  fileType: string;
  chunkCount: number;
  totalTokens: number;
  isPreloaded?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  queryResult?: PipelineQueryResponse;
  feedback?: {
    isHelpful: boolean;
    comment?: string;
    createdAt: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface FeedbackRecord {
  id: string;
  queryId: string;
  question: string;
  answer: string;
  isHelpful: boolean;
  comment?: string;
  createdAt: string;
}

export class AppDatabase {
  private documents: StoredDocument[] = [];
  private chunks: DocumentChunk[] = [];
  private sessions: ChatSession[] = [];
  private feedbacks: FeedbackRecord[] = [];
  public vectorStore: VectorStore = new VectorStore();
  private dataDir: string;
  private dbFilePath: string;
  private saveTimer: NodeJS.Timeout | null = null;
  private isDirty: boolean = false;
  private readonly DEBOUNCE_MS = 400;

  constructor() {
    this.dataDir = path.join(process.cwd(), ".data");
    this.dbFilePath = path.join(this.dataDir, "rag_db.json");
    this.init();
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const handleShutdown = (signal: string) => {
      this.flush();
    };
    process.once("SIGTERM", () => handleShutdown("SIGTERM"));
    process.once("SIGINT", () => handleShutdown("SIGINT"));
    process.once("beforeExit", () => handleShutdown("beforeExit"));
  }

  private init(): void {
    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    this.loadFromDisk();
    if (this.documents.length === 0) {
      this.seedSampleDocuments();
    }
  }

  private loadFromDisk(): void {
    if (fs.existsSync(this.dbFilePath)) {
      try {
        const raw = fs.readFileSync(this.dbFilePath, "utf-8");
        const data = JSON.parse(raw);
        this.documents = data.documents || [];
        this.chunks = data.chunks || [];
        this.sessions = data.sessions || [];
        this.feedbacks = data.feedbacks || [];
        this.vectorStore = new VectorStore(this.chunks);
      } catch (err) {
        console.error("Failed to load local database from disk:", err);
      }
    }
  }

  /**
   * Debounces database disk writes (~400ms after last mutation)
   * to coalesce bursts of writes (e.g. bulk seeding or rapid chat turns)
   * and prevent stutter from synchronous disk I/O.
   */
  public saveToDisk(debounceMs: number = this.DEBOUNCE_MS): void {
    this.isDirty = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.flush();
    }, debounceMs);
  }

  /**
   * Flushes any pending debounced writes to disk immediately.
   */
  public flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.isDirty) return;

    try {
      const payload = {
        documents: this.documents,
        chunks: this.chunks,
        sessions: this.sessions,
        feedbacks: this.feedbacks,
      };
      fs.writeFileSync(this.dbFilePath, JSON.stringify(payload, null, 2), "utf-8");
      this.isDirty = false;
    } catch (err) {
      console.error("Failed to write local database to disk:", err);
    }
  }

  public async seedSampleDocuments(): Promise<void> {
    for (const sample of SAMPLE_DOCUMENTS) {
      const fullText = sample.pages
        .map((p) => `[Page ${p.pageNumber}] Section: ${p.section}\n${p.content}`)
        .join("\n\n");

      const generatedChunks = recursiveChunkText(fullText, sample.id, sample.name, 512, 50);
      let totalTokens = 0;
      for (const ch of generatedChunks) {
        totalTokens += ch.tokenCount;
      }

      const docRecord: StoredDocument = {
        id: sample.id,
        name: sample.name,
        category: sample.category,
        description: sample.description,
        uploadDate: new Date().toISOString(),
        fileType: "pdf",
        chunkCount: generatedChunks.length,
        totalTokens,
        isPreloaded: true,
      };

      this.documents.push(docRecord);
      this.chunks.push(...generatedChunks);
      await this.vectorStore.addChunks(generatedChunks);
    }

    // Create default initial chat session if empty
    if (this.sessions.length === 0) {
      const defaultSession: ChatSession = {
        id: "session-default",
        title: "Refund Policy Comparison",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      this.sessions.push(defaultSession);
    }

    this.flush();
  }

  public getDocuments(): StoredDocument[] {
    return this.documents;
  }

  public getDocumentById(id: string): StoredDocument | undefined {
    return this.documents.find((d) => d.id === id);
  }

  public getChunksForDoc(docId: string): DocumentChunk[] {
    return this.chunks.filter((c) => c.docId === docId);
  }

  public async addDocument(
    name: string,
    rawText: string,
    fileType: string = "txt",
    category: string = "User Uploaded"
  ): Promise<StoredDocument> {
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newChunks = recursiveChunkText(rawText, docId, name, 512, 50);

    let totalTokens = 0;
    for (const ch of newChunks) {
      totalTokens += ch.tokenCount;
    }

    const doc: StoredDocument = {
      id: docId,
      name,
      category,
      uploadDate: new Date().toISOString(),
      fileType,
      chunkCount: newChunks.length,
      totalTokens,
      isPreloaded: false,
    };

    this.documents.unshift(doc);
    this.chunks.push(...newChunks);
    await this.vectorStore.addChunks(newChunks);
    this.saveToDisk();
    return doc;
  }

  public deleteDocument(docId: string): boolean {
    const initialCount = this.documents.length;
    this.documents = this.documents.filter((d) => d.id !== docId);
    this.chunks = this.chunks.filter((c) => c.docId !== docId);
    this.vectorStore.removeByDocId(docId);
    this.saveToDisk();
    return this.documents.length < initialCount;
  }

  public async resetToSamples(): Promise<void> {
    this.documents = [];
    this.chunks = [];
    this.vectorStore.clear();
    await this.seedSampleDocuments();
    this.flush();
  }

  // Chat sessions
  public getSessions(): ChatSession[] {
    return this.sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getSession(id: string): ChatSession | undefined {
    return this.sessions.find((s) => s.id === id);
  }

  public createSession(title?: string): ChatSession {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: title || `New Chat ${this.sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    this.sessions.unshift(newSession);
    this.saveToDisk();
    return newSession;
  }

  public addMessageToSession(sessionId: string, message: ChatMessage): ChatSession | undefined {
    let session = this.getSession(sessionId);
    if (!session) {
      session = this.createSession();
      sessionId = session.id;
    }

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    // Auto-update session title based on first user query
    if (session.messages.length === 1 && message.role === "user") {
      session.title = message.content.slice(0, 45).trim() || session.title;
    }

    this.saveToDisk();
    return session;
  }

  public deleteSession(sessionId: string): boolean {
    const initial = this.sessions.length;
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    if (this.sessions.length === 0) {
      this.createSession("New Chat");
    }
    this.saveToDisk();
    return this.sessions.length < initial;
  }

  // Feedback
  public saveFeedback(
    queryId: string,
    question: string,
    answer: string,
    isHelpful: boolean,
    comment?: string
  ): FeedbackRecord {
    const record: FeedbackRecord = {
      id: `fb-${Date.now()}`,
      queryId,
      question,
      answer,
      isHelpful,
      comment,
      createdAt: new Date().toISOString(),
    };
    this.feedbacks.unshift(record);

    // Also update in-session message if present
    for (const session of this.sessions) {
      for (const msg of session.messages) {
        if (msg.queryResult?.queryId === queryId) {
          msg.feedback = {
            isHelpful,
            comment,
            createdAt: record.createdAt,
          };
        }
      }
    }

    this.saveToDisk();
    return record;
  }

  public getFeedbacks(): FeedbackRecord[] {
    return this.feedbacks;
  }

  // Observability & Metrics
  public getObservabilityStats() {
    let totalQueries = 0;
    let totalLatency = 0;
    let highConfCount = 0;
    let mediumConfCount = 0;
    let lowConfCount = 0;
    let totalTokens = 0;

    for (const session of this.sessions) {
      for (const msg of session.messages) {
        if (msg.role === "assistant" && msg.queryResult) {
          totalQueries++;
          totalLatency += msg.queryResult.telemetry?.totalLatencyMs || 0;
          totalTokens += msg.queryResult.telemetry?.tokenCount || 0;
          const conf = msg.queryResult.confidence;
          if (conf === "high") highConfCount++;
          else if (conf === "medium") mediumConfCount++;
          else if (conf === "low") lowConfCount++;
        }
      }
    }

    const helpfulFeedbacks = this.feedbacks.filter((f) => f.isHelpful).length;
    const feedbackSatisfaction = this.feedbacks.length > 0
      ? Math.round((helpfulFeedbacks / this.feedbacks.length) * 100)
      : 100;

    return {
      totalDocuments: this.documents.length,
      totalChunks: this.chunks.length,
      totalQueries,
      avgLatencyMs: totalQueries > 0 ? Math.round(totalLatency / totalQueries) : 0,
      totalTokens,
      confidenceDistribution: {
        high: highConfCount,
        medium: mediumConfCount,
        low: lowConfCount,
      },
      feedbackStats: {
        totalFeedback: this.feedbacks.length,
        satisfactionRate: feedbackSatisfaction,
        helpfulCount: helpfulFeedbacks,
        unhelpfulCount: this.feedbacks.length - helpfulFeedbacks,
      },
    };
  }
}

export const db = new AppDatabase();
