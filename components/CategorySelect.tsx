import React from "react";

/** 채팅에서 검색할 문서 카테고리 선택 ("" = 전체 문서) */
export function CategorySelect({
  categories,
  value,
  onChange,
  disabled,
}: {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="문서 카테고리 선택"
        title="선택한 카테고리의 문서만 검색합니다"
        className="h-11 max-w-[220px] appearance-none truncate rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm transition hover:border-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">📚 전체 문서</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            🗂️ {category}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
