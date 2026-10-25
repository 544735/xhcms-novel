# 安全策略与残余风险评估

## 依赖漏洞基线

- 审计命令：`pnpm audit --audit-level high`（CI 已设为门禁，high/critical 会阻断合并）。
- 当前状态：**0 high / 0 critical**，剩余 moderate 均为构建期或编辑器依赖，逐项评估如下。
- 升级依赖后必须回归：`pnpm typecheck`、`pnpm --filter @wmcms/api test:unit`、`pnpm build`、`pnpm --filter @wmcms/api test`。

| 依赖 | 级别 | 现状 | 风险评估与缓解 |
|---|---|---|---|
| `sanitize-html` 2.17.5 | moderate ×2 | 已修复 `javascript:` URI 绕过（GHSA 高危项）；2.18 为 ESM-only，会破坏现有 CJS Jest | 剩余两条涉及 `<noscript>` 内容与 `<meta http-equiv=refresh>`：项目的 allowlist **不包含** `noscript`/`meta`，且为 `discard` 模式；同时 `sanitizeContent()` 已增加对这两类标签的**前置剥离**作为纵深防御。不可利用 |
| `@tiptap/core` 2.27.x | moderate | 原型污染仅在 `mergeAttributes` 处理**攻击者可控属性**时触发 | 编辑器为管理端内部工具，内容入库前经服务端 sanitize；无匿名用户可控的编辑器属性入口。升级 Tiptap 3 需跨大版本改造编辑器，暂记录为接受风险 |
| `js-yaml` | moderate | 仅 `@nestjs/swagger`（生产默认关闭）与 Jest/istanbul 开发链使用 | 生产不构建 Swagger、不解析不受信 YAML；无用户输入进入 YAML 解析路径 |
| `postcss` / `postcss-selector-parser` | moderate | 已通过 pnpm override 升级到修复版本；残余为构建期工具链 | 仅构建期，不进入运行时 |

## 凭据与权限

- 仓库不含任何生产密钥；JWT 密钥在生产缺失时拒绝启动，开发环境为进程内随机生成。
- 生产 seed 在未提供 `SEED_*_PASSWORD` 时随机生成管理员口令，写入数据卷 `/data/.seed-credentials.txt`（首次登录后应改密并删除）。
- **本地 MySQL 可选方案**：不要使用 `xhcms/xhcms` 之类的示例口令。本机开发凭据放在 `apps/api/.env.mysql.local`（已在 `.gitignore` 中），MySQL E2E 通过 `TEST_DATABASE_URL` 注入；生产数据库账号只授予目标库权限，禁止使用 `migrate reset`。
- 曾在对话/工单中暴露的数据库 root 口令必须轮换。
- 管理员与会员令牌均支持 `tokenVersion` 撤销（登出/改密/重置/禁用立即失效）。

## 运行时防护清单（已在代码中）

- 上传：服务端 MIME 白名单 + magic bytes 校验 + 扩展名由 MIME 决定 + 目录白名单 + 路径相对校验；`/uploads` 强制 `nosniff` + CSP sandbox + `Content-Disposition`。
- 富文本：白名单清洗、iframe 域名白名单（强制 sandbox）、协议相对 URL 阻断、插件钩子返回值二次清洗。
- 采集：私网/保留地址解析拦截、手动重定向逐跳校验、流式响应大小上限。
- 鉴权：全局 Jwt/RBAC/站点守卫、超管目标保护、角色权限子集、站点归属子集、全局设置仅超管。
- 传输与暴露面：生产默认关闭 Swagger、HSTS/安全响应头、`TRUST_PROXY` 正确取真实 IP、登录限流。

## 漏洞报告

请勿公开提交安全问题。可通过仓库 Issue 私密报告或联系维护者，并附复现步骤与影响范围；确认后会在修复版本中致谢。
