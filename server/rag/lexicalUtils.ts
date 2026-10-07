/**
 * Shared Lexical Utilities for Dynamic Reranker and Reasoning Scratchpad Fallbacks
 */

export const GENERIC_OR_STOPWORDS = new Set([
  // Common grammatical stopwords
  "the", "and", "or", "for", "with", "about", "what", "how", "why", "when", "where",
  "which", "who", "whom", "this", "that", "these", "those", "can", "could", "should",
  "would", "will", "are", "was", "were", "been", "being", "have", "has", "had", "does",
  "did", "doing", "between", "difference", "differ", "differences", "versus", "both",
  "also", "into", "from", "than", "then", "under", "over", "more", "most", "less",
  "such", "only", "any", "some", "all", "our", "their", "your", "its", "not", "tell",
  "give", "explain", "describe", "show", "find", "compare", "comparison", "contrasting",
  // Overly generic domain boilerplate words in enterprise knowledge bases
  "policy", "policies", "purchase", "purchases", "purchased", "item", "items",
  "customer", "customers", "standard", "general", "terms", "company", "information",
  "regarding", "requirement", "requirements", "document", "documents", "section", "page",
  "update", "updates", "updated", "guidelines", "handbook", "overview", "corp", "corporation"
]);

/**
 * Extracts normalized, unique informative terms from a text string,
 * filtering out short tokens and generic domain / grammatical stopwords.
 */
export function extractInformativeTerms(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const w of words) {
    if (!GENERIC_OR_STOPWORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      terms.push(w);
    }
  }
  return terms;
}

/**
 * Checks which informative terms appear verbatim in a passage of text.
 */
export function checkChunkTermMatches(chunkText: string, informativeTerms: string[]): string[] {
  if (!chunkText || informativeTerms.length === 0) return [];
  const lowerChunk = chunkText.toLowerCase();
  const chunkTokens = new Set(lowerChunk.split(/\W+/).filter((w) => w.length > 2));

  return informativeTerms.filter((term) => {
    if (chunkTokens.has(term)) return true;
    const pattern = new RegExp(`\\b${term}`, "i");
    return pattern.test(lowerChunk);
  });
}

/**
 * Computes coverage and identifies matched vs missing query terms across passages.
 */
export function computeInformativeTermCoverage(
  informativeTerms: string[],
  chunkTexts: string[]
): {
  coverage: number;
  matchedTerms: string[];
  missingTerms: string[];
} {
  if (informativeTerms.length === 0) {
    return { coverage: 0, matchedTerms: [], missingTerms: [] };
  }

  const matchedSet = new Set<string>();
  for (const text of chunkTexts) {
    const matches = checkChunkTermMatches(text, informativeTerms);
    for (const m of matches) {
      matchedSet.add(m);
    }
  }

  const matchedTerms = informativeTerms.filter((t) => matchedSet.has(t));
  const missingTerms = informativeTerms.filter((t) => !matchedSet.has(t));
  const coverage = matchedTerms.length / informativeTerms.length;

  return { coverage, matchedTerms, missingTerms };
}
