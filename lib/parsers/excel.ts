import * as XLSX from "xlsx";

/**
 * 엑셀(.xlsx/.xls) → 시트별·행별 텍스트 섹션
 * 첫 행을 헤더로 보고 각 행을 "[시트명]\n컬럼: 값" 형태로 만든다. (CSV와 같은 방식)
 */
export function extractExcelSections(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    normalizeDefaultDates(sheet);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false, // 날짜·숫자를 화면에 보이는 형식 그대로
      blankrows: false,
    });
    for (const row of rows) {
      const fields = Object.entries(row)
        .filter(([key, v]) => v !== "" && v !== null && !key.startsWith("__EMPTY"))
        .map(([key, v]) => `${key}: ${String(v).trim()}`);
      // 헤더 없는 열(__EMPTY)도 값이 있으면 포함
      const unnamed = Object.entries(row)
        .filter(([key, v]) => key.startsWith("__EMPTY") && v !== "")
        .map(([, v]) => String(v).trim());
      const line = [...fields, ...unnamed].join("\n");
      if (line) sections.push(`[${sheetName}]\n${line}`);
    }
  }
  return sections;
}

/**
 * 엑셀 기본 날짜 서식(14번, 'm/d/yy')은 PC 지역 설정에 따라 다르게 보인다.
 * 한국어 엑셀과 같도록 yyyy-mm-dd(시간이 있으면 HH:mm 포함)로 바꾼다. 사용자 지정 서식은 그대로 둔다.
 */
function normalizeDefaultDates(sheet: XLSX.WorkSheet) {
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith("!")) continue;
    const c = cell as XLSX.CellObject;
    if (c.t !== "d" || !(c.v instanceof Date)) continue;
    if (c.z && c.z !== "m/d/yy" && c.z !== 14) continue;
    // SheetJS는 셀 값을 UTC 기준 Date로 만든다 (서버 시간대와 무관하게 UTC 필드 사용)
    const d = c.v;
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const time =
      d.getUTCHours() || d.getUTCMinutes() ? ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : "";
    c.w = date + time;
  }
}
