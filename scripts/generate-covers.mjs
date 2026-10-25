/**
 * 生成门户/媒体库使用的本地封面图（离线可用，不依赖外部图片服务）。
 * 运行：node scripts/generate-covers.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'apps', 'web', 'public', 'covers');

const PALETTES = [
  ['#6366f1', '#a855f7', '#0f172a'],
  ['#0ea5e9', '#22d3ee', '#082f49'],
  ['#f59e0b', '#f97316', '#431407'],
  ['#10b981', '#34d399', '#022c22'],
  ['#ec4899', '#f43f5e', '#4c0519'],
  ['#8b5cf6', '#6366f1', '#1e1b4b'],
  ['#14b8a6', '#06b6d4', '#042f2e'],
  ['#f43f5e', '#fb923c', '#450a0a'],
];

const SHEETS = [
  'xinghai-bian',
  'chang-ye-xing',
  'du-shi-shou-ye-ren',
  'da-yong-feng-yun',
  'chun-shen-bu-zhi-chu',
  'ni-shi-wo-de-xing-he',
  'wu-du-lai-xin',
];

/** 稳定哈希：同一 slug 每次生成相同的配色与构图 */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function svgFor(slug) {
  const h = hash(slug);
  const palette = PALETTES[h % PALETTES.length];
  const [start, end, dark] = palette;
  const variant = h % 4;
  const rotation = (h % 60) - 30;

  const blobs = [
    `<circle cx="${180 + (h % 120)}" cy="${140 + (h % 90)}" r="${220 + (h % 90)}" fill="${start}" opacity="0.55"/>`,
    `<circle cx="${900 - (h % 140)}" cy="${560 - (h % 80)}" r="${240 + (h % 70)}" fill="${end}" opacity="0.45"/>`,
    `<rect x="${520 + (h % 80)}" y="${120 + (h % 60)}" width="${260 + (h % 90)}" height="${260 + (h % 80)}" rx="64" fill="#ffffff" opacity="0.10" transform="rotate(${rotation} 720 320)"/>`,
    `<path d="M0 ${560 + (h % 60)} Q ${300 + (h % 100)} ${420 + (h % 90)} 640 ${520 + (h % 50)} T 1200 ${470 + (h % 70)} L1200 750 L0 750 Z" fill="${dark}" opacity="0.55"/>`,
  ].join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750" role="img" aria-label="XHCMS 封面">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${start}"/>
      <stop offset="55%" stop-color="${end}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1.3" fill="#ffffff" opacity="0.18"/>
    </pattern>
  </defs>
  <rect width="1200" height="750" fill="url(#bg)"/>
  <g>${blobs}</g>
  <rect width="1200" height="750" fill="url(#dots)"/>
  <g transform="translate(1060 92)" opacity="0.9">
    <rect width="68" height="68" rx="20" fill="#ffffff" opacity="0.16"/>
    <path d="M20 34 L30 22 L38 34 L46 26 L48 46 L20 46 Z" fill="#ffffff" opacity="0.85"/>
  </g>
  <rect x="0" y="0" width="1200" height="750" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
  <g opacity="${variant === 3 ? 0.0 : 0.9}"/>
</svg>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const slug of SHEETS) {
  writeFileSync(join(OUT_DIR, `${slug}.svg`), svgFor(slug), 'utf8');
}
// 通用兜底封面
writeFileSync(
  join(OUT_DIR, 'default.svg'),
  svgFor('wmcms-default-cover'),
  'utf8',
);
console.log(`已生成 ${SHEETS.length + 1} 张本地封面 -> ${OUT_DIR}`);
