/**
 * 章节字数口径（与后端 reader.util.countChapterWords 保持一致）：
 * 中文字符 + 英文/数字单词。
 */
export function countChapterWords(text: string | null | undefined): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const latin = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return cjk + latin;
}

export function formatWordCount(count: number): string {
  if (count >= 10_000) return `${(count / 10_000).toFixed(1)} 万字`;
  return `${count.toLocaleString('zh-CN')} 字`;
}
