import { sanitizeDatabaseText } from "./database-text";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/** 청크 경계에서 정상 이모지 등의 UTF-16 surrogate pair가 분리되는지 확인한다. */
function splitsSurrogatePair(text: string, index: number): boolean {
  const before = text.charCodeAt(index - 1);
  const after = text.charCodeAt(index);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

/** 문단 경계를 최대한 살리며 CHUNK_SIZE 내외로 자르고 CHUNK_OVERLAP 만큼 겹치게 한다 */
function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(". "));
      if (breakAt > CHUNK_SIZE * 0.5) end = start + breakAt + 1;
    }
    if (splitsSurrogatePair(clean, end)) end -= 1;
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
    if (splitsSurrogatePair(clean, start)) start -= 1;
  }
  return chunks.filter(Boolean);
}

/** 짧은 섹션(CSV 행 등)은 묶어서 하나의 청크로 */
export function buildChunks(sections: string[]): string[] {
  const chunks: string[] = [];
  let buffer = "";
  for (const rawSection of sections) {
    const section = sanitizeDatabaseText(rawSection);
    if (!section.trim()) continue;
    if (section.length > CHUNK_SIZE) {
      if (buffer) chunks.push(buffer);
      buffer = "";
      chunks.push(...chunkText(section));
    } else if ((buffer + "\n\n" + section).length > CHUNK_SIZE) {
      if (buffer) chunks.push(buffer);
      buffer = section;
    } else {
      buffer = buffer ? `${buffer}\n\n${section}` : section;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}
