import { inflateRawSync } from "node:zlib";
import CFB from "cfb";
import JSZip from "jszip";

/*
 * 한글(HWP 5.0 바이너리) 텍스트 추출
 * - OLE 복합 문서의 BodyText/SectionN 스트림을 읽는다 (압축 시 raw deflate)
 * - 각 스트림은 레코드 목록이며, HWPTAG_PARA_TEXT(67) 레코드에 문단 텍스트(UTF-16LE)가 있다
 * - 표 안의 셀 텍스트도 문단 레코드로 들어 있어 함께 추출된다
 * 참고: 한글 문서 파일 형식 5.0 공개 문서 (한컴)
 */

const HWPTAG_PARA_TEXT = 16 + 51;

// 1 WCHAR 크기의 문자 컨트롤 (나머지 0~31 코드는 8 WCHAR 크기의 인라인/확장 컨트롤)
const CHAR_CONTROLS = new Set([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31]);

function decodeParaText(buf: Buffer): string {
  let out = "";
  for (let i = 0; i + 1 < buf.length; ) {
    const code = buf.readUInt16LE(i);
    if (code >= 32) {
      out += String.fromCharCode(code);
      i += 2;
    } else if (CHAR_CONTROLS.has(code)) {
      if (code === 10) out += "\n";
      else if (code >= 24) out += " "; // 하이픈/공백류
      i += 2;
    } else {
      i += 16; // 표·그림·각주 등 컨트롤 자리표시 (텍스트 아님)
    }
  }
  return out;
}

function readSectionText(data: Buffer): string {
  const paragraphs: string[] = [];
  let offset = 0;
  while (offset + 4 <= data.length) {
    const header = data.readUInt32LE(offset);
    offset += 4;
    const tagId = header & 0x3ff;
    let size = (header >>> 20) & 0xfff;
    if (size === 0xfff) {
      size = data.readUInt32LE(offset);
      offset += 4;
    }
    if (tagId === HWPTAG_PARA_TEXT) {
      const text = decodeParaText(data.subarray(offset, offset + size)).trim();
      if (text) paragraphs.push(text);
    }
    offset += size;
  }
  return paragraphs.join("\n");
}

export function extractHwpText(buffer: Buffer): string {
  const cfb = CFB.read(buffer, { type: "buffer" });

  const header = CFB.find(cfb, "FileHeader");
  if (!header?.content) throw new Error("올바른 한글(HWP) 문서가 아닙니다.");
  const headerBuf = Buffer.from(header.content as Uint8Array);
  const props = headerBuf.readUInt32LE(36);
  const compressed = (props & 0x1) !== 0;
  if (props & 0x2) throw new Error("암호가 걸린 한글 문서는 읽을 수 없습니다.");
  if (props & 0x4) throw new Error("배포용(읽기 전용) 한글 문서는 텍스트를 추출할 수 없습니다.");

  const sections = cfb.FullPaths.map((path, i) => ({ path, entry: cfb.FileIndex[i] }))
    .filter(({ path }) => /\/BodyText\/Section\d+$/i.test(path))
    .sort((a, b) => Number(a.path.match(/\d+$/)![0]) - Number(b.path.match(/\d+$/)![0]));

  return sections
    .map(({ entry }) => {
      const raw = Buffer.from(entry.content as Uint8Array);
      return readSectionText(compressed ? inflateRawSync(raw) : raw);
    })
    .join("\n\n");
}

/*
 * 한글(HWPX) 텍스트 추출
 * - ZIP 안의 Contents/sectionN.xml 에서 문단(<hp:p>)별로 텍스트(<hp:t>)를 모은다
 */
export async function extractHwpxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const sectionFiles = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/i)![1]) - Number(b.match(/(\d+)\.xml$/i)![1]));
  if (sectionFiles.length === 0) throw new Error("올바른 한글(HWPX) 문서가 아닙니다.");

  const decode = (s: string) =>
    s
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&amp;/g, "&");

  const texts: string[] = [];
  for (const name of sectionFiles) {
    const xml = await zip.file(name)!.async("string");
    // 문단 단위로 줄바꿈, 문단 안의 텍스트 런(<hp:t>)은 이어붙임 (표 셀 문단 포함)
    for (const para of xml.split(/<\/hp:p>/)) {
      const runs = [...para.matchAll(/<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g)].map((m) => decode(m[1]));
      const line = runs.join("").trim();
      if (line) texts.push(line);
    }
  }
  return texts.join("\n");
}
