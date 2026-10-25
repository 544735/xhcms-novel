import { sanitizeContent, sanitizePlainText } from '../../src/common/utils/sanitize.util';

/**
 * 富文本 / 纯文本清洗的回归用例。
 * 关注点：实体重编码、script 内容残留、危险协议、iframe 白名单。
 */
describe('sanitizePlainText（纯文本清洗）', () => {
  it('不把 & 重新编码成 &amp;（Q&A 原样保留）', () => {
    expect(sanitizePlainText('Q&A')).toBe('Q&A');
  });

  it('折叠连续空白并 trim', () => {
    expect(sanitizePlainText('  a   b  ')).toBe('a b');
  });

  it('标签替换为空格，避免相邻文本粘连', () => {
    expect(sanitizePlainText('<b>粗体</b>文本')).toBe('粗体 文本');
  });

  it('script/style 连同内部内容一起删除', () => {
    const cleaned = sanitizePlainText('<script>alert(1)</script>安全');
    expect(cleaned).toBe('安全');
    expect(cleaned).not.toContain('alert');
  });

  it('按 maxLength 截断', () => {
    expect(sanitizePlainText('abcdef', 3)).toBe('abc');
  });

  it('空值返回空串', () => {
    expect(sanitizePlainText(null)).toBe('');
  });
});

describe('sanitizeContent（富文本白名单清洗）', () => {
  it('保留正常正文，删除 script 及其内容', () => {
    const html = sanitizeContent('<script>alert(1)</script><p>正文</p>');
    expect(html).toContain('正文');
    expect(html).not.toContain('alert');
  });

  it('剥离 javascript: 协议的 href', () => {
    const html = sanitizeContent('<a href="javascript:alert(1)">点我</a>');
    expect(html).not.toContain('javascript:');
  });

  it('非白名单 iframe 不输出 <iframe>，降级为外链', () => {
    const html = sanitizeContent('<iframe src="https://evil.example/x"></iframe>');
    expect(html).not.toMatch(/<iframe/i);
    expect(html).toContain('https://evil.example/x');
  });

  it('白名单 iframe（YouTube）保留并强制 sandbox', () => {
    const html = sanitizeContent('<iframe src="https://www.youtube.com/embed/abc"></iframe>');
    expect(html).toContain('<iframe');
    expect(html).toContain('sandbox=');
  });

  it('阻断协议相对 img src（//evil.example）', () => {
    const html = sanitizeContent('<img src="//evil.example/a.png">');
    expect(html).not.toContain('evil.example');
  });

  it('空值返回空串', () => {
    expect(sanitizeContent(undefined)).toBe('');
  });
});
