/** PostgreSQL text/jsonb에서 허용하지 않는 NUL과 잘못된 UTF-16을 제거·치환한다. */
export function sanitizeDatabaseText(text: string): string {
  return text.split("\0").join("").replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    "\uFFFD",
  );
}

/** UTF-16 코드 단위 대신 유니코드 코드 포인트 단위로 잘라 이모지 분리를 방지한다. */
export function createChatTitle(question: string): string {
  return Array.from(sanitizeDatabaseText(question).trim()).slice(0, 40).join("");
}
