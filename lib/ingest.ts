import "server-only";
// pdf-parse 워커는 pdf-parse보다 먼저 import 해야 서버리스(Vercel)에서도 동작한다
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embed } from "./embeddings";
import { DOCUMENTS_BUCKET, SUPPORTED_EXTENSIONS, extensionOf } from "./document-files";
import { extractExcelSections } from "./parsers/excel";
import { extractHwpText, extractHwpxText } from "./parsers/hwp";

PDFParse.setWorker(getData());

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH = 50;

/** 파일 형식별로 텍스트 단위(섹션) 목록을 만든다 */
async function loadSections(buffer: Buffer, ext: string): Promise<string[]> {
  switch (ext) {
    case ".pdf": {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        // 페이지 구분 표시("-- 1 of 3 --") 제거
        return [result.text.replace(/^-- \d+ of \d+ --$/gm, "")];
      } finally {
        await parser.destroy();
      }
    }
    case ".hwp":
      return [extractHwpText(buffer)];
    case ".hwpx":
      return [await extractHwpxText(buffer)];
    case ".xlsx":
    case ".xls":
      return extractExcelSections(buffer);
    case ".txt":
    case ".md":
      return [buffer.toString("utf8")];
    case ".csv": {
      const { data } = Papa.parse<Record<string, string>>(buffer.toString("utf8"), {
        header: true,
        skipEmptyLines: true,
      });
      // 각 행을 "컬럼: 값" 형태의 문장으로
      return data.map((row) =>
        Object.entries(row)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n"),
      );
    }
    case ".json": {
      const json = JSON.parse(buffer.toString("utf8"));
      const items = Array.isArray(json) ? json : [json];
      return items.map((item) => (typeof item === "string" ? item : JSON.stringify(item, null, 2)));
    }
    default:
      throw new Error(`지원하지 않는 형식입니다. (${SUPPORTED_EXTENSIONS.join(", ")})`);
  }
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
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}

/** 짧은 섹션(CSV 행 등)은 묶어서 하나의 청크로 */
function buildChunks(sections: string[]): string[] {
  const chunks: string[] = [];
  let buffer = "";
  for (const section of sections) {
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

type DocumentFile = { id: string; name: string; storage_path: string };

/**
 * Storage에 올라간 파일을 내려받아 청크 → Upstage 임베딩 → documents 테이블에 저장한다.
 * 같은 파일을 다시 처리하면 기존 청크를 교체한다. 성공 시 청크 수를 돌려준다.
 */
export async function ingestDocumentFile(admin: SupabaseClient, file: DocumentFile): Promise<number> {
  const { data: blob, error: downloadError } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .download(file.storage_path);
  if (downloadError || !blob) throw new Error(`파일 다운로드 실패: ${downloadError?.message}`);

  const sections = await loadSections(Buffer.from(await blob.arrayBuffer()), extensionOf(file.name));
  const chunks = buildChunks(sections);
  if (chunks.length === 0) {
    throw new Error("추출된 텍스트가 없습니다. (이미지로만 된 스캔 PDF는 지원하지 않습니다)");
  }

  const { error: deleteError } = await admin.from("documents").delete().eq("file_id", file.id);
  if (deleteError) throw new Error(`기존 청크 삭제 실패: ${deleteError.message}`);

  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    const vectors = await embed(batch, "passage");
    const rows = batch.map((content, j) => ({
      file_id: file.id,
      source: file.name,
      chunk_index: i + j,
      content,
      metadata: { ext: extensionOf(file.name).slice(1), total_chunks: chunks.length },
      embedding: JSON.stringify(vectors[j]),
    }));
    const { error } = await admin.from("documents").insert(rows);
    if (error) throw new Error(`청크 저장 실패: ${error.message}`);
  }
  return chunks.length;
}
