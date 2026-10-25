import { CHAPTER_DEFAULT_PRICE } from '@wmcms/shared';
import { normalizeChapterPrice } from '../../src/modules/novels/novel.util';

/**
 * VIP 章节定价归一化的回归用例。
 * 规则：非 VIP 恒为 0；VIP 至少 1 书币、非法/缺失回落默认价、上限 100000。
 */
describe('normalizeChapterPrice', () => {
  it('VIP 合法价格原样保留', () => {
    expect(normalizeChapterPrice(true, 5)).toBe(5);
  });

  it('VIP 0 币回落默认价（避免「VIP 但免费」）', () => {
    expect(normalizeChapterPrice(true, 0)).toBe(CHAPTER_DEFAULT_PRICE);
  });

  it('VIP 未填价格回落默认价', () => {
    expect(normalizeChapterPrice(true, undefined)).toBe(CHAPTER_DEFAULT_PRICE);
    expect(normalizeChapterPrice(true, null)).toBe(CHAPTER_DEFAULT_PRICE);
  });

  it('VIP 负数回落默认价', () => {
    expect(normalizeChapterPrice(true, -3)).toBe(CHAPTER_DEFAULT_PRICE);
  });

  it('VIP 非数字回落默认价', () => {
    expect(normalizeChapterPrice(true, Number.NaN)).toBe(CHAPTER_DEFAULT_PRICE);
  });

  it('VIP 价格取整并受上限约束', () => {
    expect(normalizeChapterPrice(true, 3.9)).toBe(3);
    expect(normalizeChapterPrice(true, 999_999)).toBe(100_000);
  });

  it('非 VIP 价格一律归零', () => {
    expect(normalizeChapterPrice(false, 999)).toBe(0);
    expect(normalizeChapterPrice(false, 0)).toBe(0);
  });
});
