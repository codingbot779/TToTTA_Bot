/**
 * dataset/ 폴더의 문서를 청크로 나눠 Upstage Embedding으로 임베딩한 뒤
 * 원문과 함께 Supabase documents 테이블에 저장한다.
 *
 * 지원 형식: .pdf .txt .md .csv .json
 * 실행: npm run ingest            (dataset 전체)
 *       npm run ingest -- a.pdf   (특정 파일만)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import { embed } from "../lib/embeddings";

const DATASET_DIR = path.join(process.cwd(), "dataset");
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH = 50;
const SUPPORTED = [".pdf", ".txt", ".md", ".csv", ".json"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !secretKey) {
  console.error("❌ .env.local에 NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SECRET_KEY를 설정해 주세요.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });

/** 파일 형식별로 텍스트 단위(섹션) 목록을 만든다 */
async function loadSections(filePath: string): Promise<string[]> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await readFile(filePath);

  switch (ext) {
    case ".pdf": {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return [result.text];
      } finally {
        await parser.destroy();
      }
    }
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
      return [];
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

async function ingestFile(fileName: string) {
  const sections = await loadSections(path.join(DATASET_DIR, fileName));
  const chunks = buildChunks(sections);
  if (chunks.length === 0) {
    console.log(`⚠️  ${fileName}: 추출된 텍스트가 없어 건너뜁니다.`);
    return 0;
  }

  // 재실행 시 중복되지 않도록 기존 데이터 삭제
  const { error: deleteError } = await supabase.from("documents").delete().eq("source", fileName);
  if (deleteError) throw new Error(`기존 문서 삭제 실패: ${deleteError.message}`);

  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    const vectors = await embed(batch, "passage");
    const rows = batch.map((content, j) => ({
      source: fileName,
      chunk_index: i + j,
      content,
      metadata: { ext: path.extname(fileName).slice(1), total_chunks: chunks.length },
      embedding: JSON.stringify(vectors[j]),
    }));
    const { error } = await supabase.from("documents").insert(rows);
    if (error) throw new Error(`저장 실패: ${error.message}`);
  }
  console.log(`✅ ${fileName}: ${chunks.length}개 청크 저장`);
  return chunks.length;
}

async function main() {
  const only = process.argv.slice(2);
  const files = (await readdir(DATASET_DIR))
    .filter((f) => SUPPORTED.includes(path.extname(f).toLowerCase()))
    .filter((f) => only.length === 0 || only.includes(f));

  if (files.length === 0) {
    console.log(`dataset/ 폴더에 문서(${SUPPORTED.join(", ")})를 넣은 뒤 다시 실행해 주세요.`);
    return;
  }

  console.log(`📚 ${files.length}개 문서 임베딩 시작...`);
  let total = 0;
  for (const file of files) {
    try {
      total += await ingestFile(file);
    } catch (error) {
      console.error(`❌ ${file}:`, (error as Error).message);
    }
  }
  console.log(`\n완료: 총 ${total}개 청크`);
}

main();
