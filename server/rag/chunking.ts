export interface DocumentChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  page: number;
  section: string;
  text: string;
  tokenCount: number;
  embedding?: number[];
}

/**
 * Recursive sentence-aware text splitter adhering to rules:
 * ~512 tokens (~1800 characters), ~50 tokens overlap (~180 characters),
 * splits on paragraphs first, then sentences, preserving context without mid-sentence cuts.
 */
export function recursiveChunkText(
  text: string,
  docId: string,
  docName: string,
  targetTokenSize: number = 512,
  overlapTokens: number = 50
): DocumentChunk[] {
  // Approximate 1 token ~ 3.5 characters in English
  const targetChars = Math.max(200, targetTokenSize * 3.5);
  const overlapChars = Math.max(40, overlapTokens * 3.5);

  // Normalize newlines
  const cleanedText = text.replace(/\r\n/g, "\n").trim();
  if (!cleanedText) return [];

  // Split into structural blocks (sections, double newlines)
  const rawParagraphs = cleanedText.split(/\n\s*\n/);
  const chunks: DocumentChunk[] = [];
  let currentChunkText = "";
  let currentPage = 1;
  let currentSection = "General";
  let chunkCounter = 0;

  for (const para of rawParagraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Detect section headers (e.g. # Section, Section 1, 1. Overview)
    const headerMatch = trimmedPara.match(/^(?:#+\s*|[0-9]+\.[0-9]*\s*|[A-Z\s]{4,}:)(.+)$/m);
    if (headerMatch && trimmedPara.length < 120) {
      currentSection = headerMatch[1]?.trim() || trimmedPara;
    }

    // Detect page markers if present (e.g. [Page 2], --- Page 2 ---)
    const pageMatch = trimmedPara.match(/(?:page|p\.)\s*(\d+)/i);
    if (pageMatch) {
      const pNum = parseInt(pageMatch[1], 10);
      if (!isNaN(pNum)) currentPage = pNum;
    }

    // If paragraph itself fits within target
    if (currentChunkText.length + trimmedPara.length + 2 <= targetChars) {
      currentChunkText = currentChunkText ? `${currentChunkText}\n\n${trimmedPara}` : trimmedPara;
    } else {
      // If we already have accumulated text, save it as a chunk
      if (currentChunkText) {
        chunkCounter++;
        chunks.push({
          id: `${docId}-chunk-${chunkCounter}`,
          docId,
          docName,
          chunkIndex: chunkCounter,
          page: currentPage,
          section: currentSection,
          text: currentChunkText.trim(),
          tokenCount: Math.round(currentChunkText.length / 3.5),
        });

        // Compute overlap string by taking the last overlapChars from sentence boundaries
        const overlapSlice = currentChunkText.slice(-overlapChars);
        const sentenceBoundary = overlapSlice.search(/(?<=[.?!])\s+/);
        const overlapText = sentenceBoundary !== -1 ? overlapSlice.slice(sentenceBoundary).trim() : "";

        currentChunkText = overlapText ? `${overlapText}\n\n${trimmedPara}` : trimmedPara;
      } else {
        // Paragraph itself exceeds targetChars, split sentence by sentence
        const sentences = trimmedPara.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [trimmedPara];
        for (const sent of sentences) {
          const trimmedSent = sent.trim();
          if (!trimmedSent) continue;

          if (currentChunkText.length + trimmedSent.length + 1 <= targetChars) {
            currentChunkText = currentChunkText ? `${currentChunkText} ${trimmedSent}` : trimmedSent;
          } else {
            if (currentChunkText) {
              chunkCounter++;
              chunks.push({
                id: `${docId}-chunk-${chunkCounter}`,
                docId,
                docName,
                chunkIndex: chunkCounter,
                page: currentPage,
                section: currentSection,
                text: currentChunkText.trim(),
                tokenCount: Math.round(currentChunkText.length / 3.5),
              });
              const overlapSlice = currentChunkText.slice(-overlapChars);
              const sentenceBoundary = overlapSlice.search(/(?<=[.?!])\s+/);
              const overlapText = sentenceBoundary !== -1 ? overlapSlice.slice(sentenceBoundary).trim() : "";
              currentChunkText = overlapText ? `${overlapText} ${trimmedSent}` : trimmedSent;
            } else {
              // Edge case: single sentence is unusually long
              currentChunkText = trimmedSent;
            }
          }
        }
      }
    }
  }

  if (currentChunkText.trim()) {
    chunkCounter++;
    chunks.push({
      id: `${docId}-chunk-${chunkCounter}`,
      docId,
      docName,
      chunkIndex: chunkCounter,
      page: currentPage,
      section: currentSection,
      text: currentChunkText.trim(),
      tokenCount: Math.round(currentChunkText.length / 3.5),
    });
  }

  return chunks;
}
