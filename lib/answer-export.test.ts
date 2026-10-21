import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";

const sample = {
  title: "휴가 안내",
  text: "## 신청 방법\n\n**담당자**에게 신청하세요.\n\n| 구분 | 일수 |\n| --- | --- |\n| 연차 | 15 |\n\n- 승인 확인\n\n```ts\nconst ok = true;\n```",
  sources: [{ type: "doc" as const, title: "복무규정.pdf" }],
  includeSources: true,
};

test("text and Markdown export respect source selection and sanitize filenames", async () => {
  const exporter = await import("./answer-export");
  const md = await exporter.createAnswerFile(sample, "md");
  assert.match(await md.text(), /\*\*담당자\*\*/);
  assert.match(await md.text(), /복무규정.pdf/);
  const txt = await exporter.createAnswerFile({ ...sample, includeSources: false }, "txt");
  assert.match(await txt.text(), /담당자에게 신청하세요/);
  assert.doesNotMatch(await txt.text(), /복무규정|\*\*|##/);
  assert.equal(exporter.answerFilename('../휴가:안내', 'docx'), '휴가_안내.docx');
});

test("print document escapes untrusted content and includes only selected sources", async () => {
  const { buildPrintDocument } = await import("./answer-print");
  const html = buildPrintDocument({ ...sample, title: '<script>alert(1)</script>', text: sample.text + '\n<script>alert(2)</script>\n![remote](https://example.com/track)', includeSources: false });
  assert.doesNotMatch(html, /<script|<img|복무규정.pdf/);
  assert.match(html, /<table>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /default-src 'none'/);
});

test("Word export creates a real DOCX preserving Korean, headings, tables and sources", async () => {
  const exporter = await import("./answer-export");
  const blob = await exporter.createAnswerFile(sample, "docx");
  assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /휴가 안내/);
  assert.match(xml, /신청 방법/);
  assert.match(xml, /w:tbl/);
  assert.match(xml, /담당자/);
  assert.match(xml, /복무규정.pdf/);
});
