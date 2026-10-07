import crypto from "crypto";
import { DocumentChunk } from "./chunking";
import { EMBEDDING_MODEL, callGeminiWithTimeout } from "../gemini";

export const MIN_COSINE_SIMILARITY = 0.35;
export const ANSWERABILITY_THRESHOLD = 0.45;
export const ANSWERABILITY_THRESHOLD_FALLBACK = 0.65;
export const ANSWERABILITY_THRESHOLD_FULLY_DEGRADED = 0.75;
export const EMBEDDING_TIMEOUT_MS = 5000;
const CONCURRENT_EMBEDDING_LIMIT = 5;

// In-memory content-hash -> embedding cache to avoid re-embedding identical text
const embeddingCache = new Map<string, number[]>();

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text.trim()).digest("hex");
}

export interface RetrievedChunk extends DocumentChunk {
  similarity: number;
  rerankScore?: number;
}

// Compute cosine similarity between two numeric vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Deterministic semantic vector embedding generator (384 dimensions)
// Used when Gemini embedding API key is absent or offline to ensure immediate offline robustness
export function generateLocalEmbedding(text: string, dimensions: number = 384): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 1);

  if (tokens.length === 0) return vector;

  for (let idx = 0; idx < tokens.length; idx++) {
    const word = tokens[idx];
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }

    const pos1 = Math.abs(hash) % dimensions;
    const pos2 = Math.abs(hash * 37) % dimensions;
    const weight = 1.0 + Math.log(1 + word.length);

    vector[pos1] += weight;
    vector[pos2] += weight * 0.5;

    // Sub-word character trigrams for fuzzy and morphological matching
    if (word.length >= 3) {
      for (let i = 0; i <= word.length - 3; i++) {
        let thash = 0;
        for (let j = 0; j < 3; j++) {
          thash = (thash << 5) - thash + word.charCodeAt(i + j);
          thash |= 0;
        }
        const tpos = Math.abs(thash) % dimensions;
        vector[tpos] += 0.25;
      }
    }
  }

  // Normalize to unit vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

// Generate embedding for text using Gemini embedding model if available, else local fallback
export async function getEmbedding(text: string): Promise<number[]> {
  const hash = hashText(text);
  const cached = embeddingCache.get(hash);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const response = await callGeminiWithTimeout(async (ai) => {
      return ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
      });
    }, EMBEDDING_TIMEOUT_MS, EMBEDDING_MODEL);

    if (response) {
      const resAny = response as any;
      const values = resAny.embedding?.values || resAny.embeddings?.[0]?.values;
      if (values && values.length > 0) {
        embeddingCache.set(hash, values);
        return values;
      }
    }
  } catch (err) {
    console.warn("Embedding generation timed out or failed, using local semantic embedding:", err);
  }

  const localVec = generateLocalEmbedding(text);
  embeddingCache.set(hash, localVec);
  return localVec;
}

// Helper to run asynchronous tasks with a concurrency ceiling
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export class VectorStore {
  private chunks: DocumentChunk[] = [];

  constructor(initialChunks: DocumentChunk[] = []) {
    this.chunks = initialChunks;
  }

  public async addChunks(chunks: DocumentChunk[]): Promise<void> {
    // Process embeddings with concurrency limit (e.g. 5 concurrent requests)
    await mapWithConcurrency(chunks, CONCURRENT_EMBEDDING_LIMIT, async (chunk) => {
      if (!chunk.embedding || chunk.embedding.length === 0) {
        chunk.embedding = await getEmbedding(chunk.text);
      }
      return chunk;
    });

    for (const chunk of chunks) {
      const existingIdx = this.chunks.findIndex((c) => c.id === chunk.id);
      if (existingIdx >= 0) {
        this.chunks[existingIdx] = chunk;
      } else {
        this.chunks.push(chunk);
      }
    }
  }

  public removeByDocId(docId: string): void {
    this.chunks = this.chunks.filter((c) => c.docId !== docId);
  }

  public clear(): void {
    this.chunks = [];
  }

  public getAllChunks(): DocumentChunk[] {
    return this.chunks;
  }

  /**
   * Run top-k similarity search.
   * Chunks below minSimilarity (default 0.35) are excluded from candidates entirely.
   */
  public async search(
    query: string,
    topK: number = 8,
    minSimilarity: number = MIN_COSINE_SIMILARITY
  ): Promise<RetrievedChunk[]> {
    if (this.chunks.length === 0) return [];

    const queryEmbedding = await getEmbedding(query);
    const queryWords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);

    const scored: RetrievedChunk[] = [];

    for (const chunk of this.chunks) {
      let sim = 0;
      if (chunk.embedding && chunk.embedding.length > 0) {
        if (chunk.embedding.length === queryEmbedding.length) {
          sim = cosineSimilarity(queryEmbedding, chunk.embedding);
        } else {
          const localChunkEmb = generateLocalEmbedding(chunk.text, queryEmbedding.length);
          sim = cosineSimilarity(queryEmbedding, localChunkEmb);
        }
      } else {
        const localChunkEmb = generateLocalEmbedding(chunk.text, queryEmbedding.length);
        sim = cosineSimilarity(queryEmbedding, localChunkEmb);
      }

      // Hybrid boost: add small lexical boost for exact keyword hits
      const chunkLower = chunk.text.toLowerCase();
      let keywordHits = 0;
      for (const w of queryWords) {
        if (chunkLower.includes(w)) {
          keywordHits++;
        }
      }
      const lexicalBoost = queryWords.length > 0 ? (keywordHits / queryWords.length) * 0.15 : 0;
      const combinedScore = Math.min(1.0, Math.max(0, sim * 0.85 + lexicalBoost));

      // Strictly exclude chunks below the minimum similarity threshold
      if (combinedScore >= minSimilarity) {
        scored.push({
          ...chunk,
          similarity: parseFloat(combinedScore.toFixed(4)),
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }
}
