import assert from "node:assert/strict";
import test from "node:test";
import { buildChunks } from "./document-chunks";

function assertDatabaseSafe(chunks: string[]) {
  for (const chunk of chunks) {
    assert.equal(chunk.includes("\0"), false, "PostgreSQL에서 거부하는 NUL 문자가 없어야 한다");
    for (const char of chunk) {
      const codePoint = char.codePointAt(0)!;
      assert.ok(codePoint < 0xd800 || codePoint > 0xdfff, "고립된 UTF-16 surrogate가 없어야 한다");
    }
    assert.ok(chunk.length <= 1000);
    assert.equal(JSON.parse(JSON.stringify(chunk)), chunk);
  }
}

test("PDF 추출 텍스트의 NUL 제거 후 한글 본문 보존", () => {
  const chunks = buildChunks(["현대해상\0 펫보험\0\n보장 내용"]);
  assert.deepEqual(chunks, ["현대해상 펫보험\n보장 내용"]);
  assertDatabaseSafe(chunks);
});

test("짧은 섹션과 긴 섹션 모두 저장 불가 문자를 정제", () => {
  const chunks = buildChunks(["짧은\0 문장", "보험\0안내 ".repeat(600), "끝\ud800"]);
  assert.ok(chunks.length > 2);
  assertDatabaseSafe(chunks);
  assert.match(chunks.at(-1)!, /끝�/);
});

test("NUL과 공백뿐인 문서는 빈 청크를 생성하지 않음", () => {
  assert.deepEqual(buildChunks(["\0\0", " \n\t"]), []);
});

test("문자 그대로의 역슬래시 유니코드 표기는 변형하지 않음", () => {
  assert.deepEqual(buildChunks([String.raw`설명: \u0000 / \uD800`]), [String.raw`설명: \u0000 / \uD800`]);
});

test("정상 한글·이모지·개행·탭은 짧은 섹션에서 보존", () => {
  const text = "보험 🐶 / 𠀀\n보장\t확인";
  assert.deepEqual(buildChunks([text]), [text]);
  assertDatabaseSafe(buildChunks([text]));
});

test("청크 끝 및 겹침 시작에서 surrogate pair를 쪼개지 않음", () => {
  for (const offset of [798, 799, 998, 999, 1598, 1798]) {
    const chunks = buildChunks(["가".repeat(offset) + "🐶" + "나".repeat(2200)]);
    assertDatabaseSafe(chunks);
    assert.ok(chunks.some((chunk) => chunk.includes("🐶")));
    assert.ok(chunks.every((chunk) => !chunk.includes("�")));
  }
});

test("일반 문서의 청크 크기·200자 겹침 유지", () => {
  const text = "가".repeat(2100);
  assert.deepEqual(buildChunks([text]).map((chunk) => chunk.length), [1000, 1000, 500]);
  assert.deepEqual(buildChunks(["첫 섹션", "둘째 섹션"]), ["첫 섹션\n\n둘째 섹션"]);
});
