// 작동 원리 페이지용 일러스트. 사이트 색상 토큰(CSS 변수)을 써서 다크모드에서도 자연스럽게 보인다.

/** 문서 + 웹 → TToTA → 출처가 달린 답변 */
export function HeroFlowIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 300" className={className} role="img" aria-label="업로드 문서와 실시간 웹 정보가 TToTA를 거쳐 출처가 달린 답변이 되는 흐름">
      {/* 연결선 */}
      <g fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
        <path className="flow-dash" d="M206 80 C 240 80, 238 128, 266 138" />
        <path className="flow-dash" d="M206 220 C 240 220, 238 172, 266 162" />
        <path className="flow-dash" d="M380 150 L 436 150" />
      </g>

      {/* 업로드 문서 */}
      <rect x="16" y="30" width="190" height="100" rx="18" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      <g transform="translate(36 52)">
        <rect x="6" y="4" width="34" height="44" rx="5" fill="var(--bubble)" stroke="var(--border)" />
        <rect x="0" y="0" width="34" height="44" rx="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
        <path d="M8 12h18M8 20h18M8 28h12" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <text x="92" y="76" fontSize="18" fontWeight="700" fill="var(--foreground)">업로드 문서</text>
      <text x="92" y="100" fontSize="13" fill="var(--muted)">PDF · HWP · XLSX</text>

      {/* 실시간 웹 */}
      <rect x="16" y="170" width="190" height="100" rx="18" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      <g transform="translate(56 220)" fill="none" stroke="var(--accent)" strokeWidth="2.2">
        <circle r="20" />
        <ellipse rx="9" ry="20" />
        <path d="M-20 0h40M-17 -10h34M-17 10h34" strokeWidth="1.6" />
      </g>
      <text x="92" y="216" fontSize="18" fontWeight="700" fill="var(--foreground)">실시간 웹</text>
      <text x="92" y="240" fontSize="13" fill="var(--muted)">Tavily 검색</text>

      {/* TToTA */}
      <circle cx="322" cy="150" r="84" fill="var(--accent)" opacity="0.1" />
      <circle cx="322" cy="150" r="58" fill="var(--accent)" />
      <path
        transform="translate(290 118) scale(2)"
        d="M9 10.5h14M16 10.5V23M11.5 16.5h9"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <text x="322" y="262" fontSize="17" fontWeight="700" textAnchor="middle" fill="var(--foreground)">TToTA AI</text>

      {/* 답변 카드 */}
      <rect x="436" y="36" width="190" height="228" rx="18" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      <circle cx="462" cy="64" r="10" fill="var(--accent)" />
      <text x="480" y="69" fontSize="15" fontWeight="700" fill="var(--foreground)">답변</text>
      <g fill="var(--bubble)">
        <rect x="456" y="90" width="150" height="10" rx="5" />
        <rect x="456" y="110" width="130" height="10" rx="5" />
        <rect x="456" y="130" width="146" height="10" rx="5" />
        <rect x="456" y="150" width="96" height="10" rx="5" />
      </g>
      <text x="456" y="190" fontSize="12" fill="var(--muted)">참고 출처</text>
      <rect x="456" y="202" width="70" height="26" rx="13" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <text x="491" y="219" fontSize="12" textAnchor="middle" fill="var(--accent-strong)">규정.pdf</text>
      <rect x="532" y="202" width="74" height="26" rx="13" fill="none" stroke="var(--border)" strokeWidth="1.5" />
      <text x="569" y="219" fontSize="12" textAnchor="middle" fill="var(--muted)">news.com</text>
    </svg>
  );
}

/** 긴 텍스트를 겹치는 청크로 자르고 각 청크를 벡터로 바꾸는 모습 */
export function ChunkingIllustration({ className = "" }: { className?: string }) {
  const lineWidths = [118, 104, 118, 90, 118, 110, 72, 118, 100];
  return (
    <svg viewBox="0 0 600 250" className={className} role="img" aria-label="문서를 200자씩 겹치는 1,000자 청크로 나누고 각 청크를 4096차원 벡터로 변환">
      {/* 원본 문서 */}
      <rect x="16" y="16" width="150" height="218" rx="12" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      {lineWidths.map((w, i) => (
        <rect key={i} x="32" y={40 + i * 20} width={w} height="8" rx="4" fill="var(--bubble)" />
      ))}
      <text x="91" y="226" fontSize="12" textAnchor="middle" fill="var(--muted)">원본 문서</text>

      <path className="flow-dash" d="M176 125 H 214" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />

      {/* 청크 3개: 앞뒤가 겹친다 */}
      {[0, 1, 2].map((i) => {
        const x = 226 + i * 110;
        return (
          <g key={i}>
            <rect x={x} y="44" width="130" height="92" rx="12" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.8" opacity="0.95" />
            <text x={x + 14} y="68" fontSize="13" fontWeight="700" fill="var(--foreground)">청크 {i + 1}</text>
            <rect x={x + 14} y="80" width="100" height="7" rx="3.5" fill="var(--bubble)" />
            <rect x={x + 14} y="94" width="86" height="7" rx="3.5" fill="var(--bubble)" />
            <rect x={x + 14} y="108" width="94" height="7" rx="3.5" fill="var(--bubble)" />
          </g>
        );
      })}
      {/* 겹침 구간 표시 */}
      {[0, 1].map((i) => (
        <rect key={i} x={336 + i * 110} y="44" width="20" height="92" fill="var(--accent)" opacity="0.22" />
      ))}
      <path d="M346 36 V 24 H 400" fill="none" stroke="var(--muted)" strokeWidth="1.2" />
      <text x="406" y="28" fontSize="12" fill="var(--muted)">200자 겹침 → 문맥이 끊기지 않게</text>

      {/* 벡터 */}
      {[0, 1, 2].map((i) => {
        const cx = 291 + i * 110;
        return (
          <g key={i}>
            <path d={`M${cx} 142 V 166`} stroke="var(--accent)" strokeWidth="2" markerEnd="url(#chunk-arrow)" />
            <rect x={cx - 48} y="176" width="96" height="30" rx="8" fill="var(--bubble)" />
            <text x={cx} y="196" fontSize="11.5" textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fill="var(--foreground)">
              [{["0.12, -0.4", "0.08, 0.31", "-0.2, 0.17"][i]}…]
            </text>
          </g>
        );
      })}
      <text x="401" y="232" fontSize="12" textAnchor="middle" fill="var(--muted)">각 청크 = 숫자 4,096개짜리 벡터</text>

      <defs>
        <marker id="chunk-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>
    </svg>
  );
}

/** 의미가 비슷한 문장은 벡터 공간에서 가까이 모인다 */
export function VectorSpaceIllustration({ className = "" }: { className?: string }) {
  const near: [number, number][] = [
    [128, 106],
    [176, 112],
    [140, 164],
  ];
  const clusterA: [number, number][] = [[104, 136], [190, 162], [96, 92]];
  const clusterB: [number, number][] = [[352, 70], [386, 96], [338, 108], [400, 62], [370, 128]];
  const clusterC: [number, number][] = [[300, 232], [340, 252], [282, 268], [326, 210], [362, 232]];
  const query: [number, number] = [154, 136];

  return (
    <svg viewBox="0 0 480 320" className={className} role="img" aria-label="질문 벡터와 가장 가까운 문서 청크들이 검색되는 벡터 공간">
      <rect x="1" y="1" width="478" height="318" rx="18" fill="var(--surface)" stroke="var(--border)" />
      {/* 격자 */}
      <g stroke="var(--border)" strokeWidth="1">
        {[80, 160, 240].map((y) => <path key={y} d={`M20 ${y} H460`} />)}
        {[120, 240, 360].map((x) => <path key={x} d={`M${x} 20 V300`} />)}
      </g>

      {/* 검색 반경 */}
      <circle cx={query[0]} cy={query[1]} r="64" fill="var(--accent)" opacity="0.08" stroke="var(--accent)" strokeDasharray="5 6" strokeWidth="1.5" />

      {/* 질문 → 가까운 청크 */}
      <g stroke="var(--accent)" strokeWidth="1.8">
        {near.map(([x, y], i) => <path key={i} d={`M${query[0]} ${query[1]} L${x} ${y}`} />)}
      </g>

      <g fill="var(--muted)" opacity="0.55">
        {[...clusterA, ...clusterB, ...clusterC].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" />)}
      </g>
      <g fill="var(--accent)">
        {near.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7.5" />)}
      </g>

      {/* 질문 (별) */}
      <path
        transform={`translate(${query[0]} ${query[1]})`}
        d="M0 -13 L3.8 -4.2 L13 -4 L5.8 2 L8.2 11 L0 5.8 L-8.2 11 L-5.8 2 L-13 -4 L-3.8 -4.2 Z"
        fill="var(--foreground)"
      />

      <text x="40" y="44" fontSize="14" fontWeight="700" fill="var(--foreground)">휴가·복지 문서</text>
      <text x="300" y="44" fontSize="14" fill="var(--muted)">회계 문서</text>
      <text x="300" y="196" fontSize="14" fill="var(--muted)">제품 문서</text>

      <rect x="56" y="218" width="166" height="56" rx="12" fill="var(--bubble)" />
      <path transform="translate(76 238)" d="M0 -7 L2 -2.3 L7 -2.2 L3.1 1.1 L4.4 6 L0 3.1 L-4.4 6 L-3.1 1.1 L-7 -2.2 L-2 -2.3 Z" fill="var(--foreground)" />
      <text x="90" y="243" fontSize="13" fontWeight="700" fill="var(--foreground)">질문: 연차는 며칠?</text>
      <circle cx="76" cy="259" r="5" fill="var(--accent)" />
      <text x="90" y="263" fontSize="12" fill="var(--muted)">가장 가까운 청크 5개</text>
    </svg>
  );
}

type IconName =
  | "upload" | "cloud" | "text" | "scissors" | "vector" | "database"
  | "lock" | "save" | "search" | "sparkle" | "globe" | "quote";

/** 단계 카드용 작은 아이콘 */
export function StepIcon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
    cloud: <><path d="M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7z" /><path d="M12 15v-4M10 13l2-2 2 2" /></>,
    text: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M12 8v9" /></>,
    scissors: <><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8.5 20 18M8 15.5 20 6" /></>,
    vector: <><path d="M7 4H5v16h2M17 4h2v16h-2" /><path d="M9 9h.01M12 12h.01M15 15h.01" strokeWidth="3" /></>,
    database: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    save: <><path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8.5 13.2 11 15.5 12l-2.3 1L12 15.5 10.8 13 8.5 12l2.3-1z" /></>,
    globe: <><circle cx="12" cy="12" r="8.5" /><ellipse cx="12" cy="12" rx="3.8" ry="8.5" /><path d="M3.5 12h17" /></>,
    quote: <><path d="M4 5h16v11H9l-5 4V5z" /><path d="M8 9h8M8 12h5" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

export type { IconName };
