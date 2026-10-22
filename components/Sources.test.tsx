import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Sources } from "./Sources";

test("문서 원본 다운로드는 ID를 사용하고 출처/유사도와 웹 링크를 유지", () => {
  const html = renderToStaticMarkup(<Sources sources={[
    { type: "doc", title: "보험.pdf", fileId: "11111111-1111-4111-8111-111111111111", similarity: 0.8 },
    { type: "web", title: "웹 출처", url: "https://example.com/reference" },
  ]} />);
  assert.match(html, /참고한 출처/);
  assert.match(html, /유사도 0.8/);
  assert.match(html, /href="\/api\/documents\/download\?fileId=11111111-1111-4111-8111-111111111111"/);
  assert.match(html, /aria-label="보험.pdf 원본 다운로드"/);
  assert.match(html, /href="https:\/\/example.com\/reference"/);
});

test("기존 대화는 한글·특수문자 파일명을 URL 인코딩하고 HTML은 이스케이프", () => {
  const title = '한글 & <script>".pdf';
  const html = renderToStaticMarkup(<Sources sources={[{ type: "doc", title, similarity: 0 }]} />);
  assert.match(html, /유사도 0/);
  assert.ok(html.includes(`/api/documents/download?${new URLSearchParams({ source: title })}`));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /원본 다운로드/);
});
