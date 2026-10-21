import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

test("answer export controls are unavailable while streaming", async () => {
  const { AnswerDownload } = await import("./AnswerDownload");
  const html = renderToStaticMarkup(<AnswerDownload text="테스트 답변" disabled />);
  assert.match(html, /답변 다운로드/);
  assert.match(html, /disabled/);
});
