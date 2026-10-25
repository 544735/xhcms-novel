# 数据库选型：PostgreSQL（默认）/ MySQL 8（可选）

本项目同一套代码支持两种数据库，通过**选择 Prisma schema + 生成对应客户端**切换。
两者都通过了完整 E2E（23 项）。

## 目录约定

| 用途 | PostgreSQL（默认） | MySQL 8（可选） |
|---|---|---|
| Prisma schema | `apps/api/prisma/schema.prisma` | `apps/api/prisma-mysql/schema.prisma` |
| 迁移 | `apps/api/prisma/migrations/` | `apps/api/prisma-mysql/migrations/` |
| 生成客户端 | `pnpm --filter @wmcms/api db:generate` | `pnpm --filter @wmcms/api db:generate:mysql` |
| 应用迁移 | `pnpm db:deploy` | `pnpm --filter @wmcms/api db:deploy:mysql` |
| 重置+种子 | `pnpm db:reset` | `pnpm --filter @wmcms/api db:reset:mysql` |

> Prisma 的 provider 是编译器级选择：**切换数据库必须重新生成客户端**（`db:generate*`），
> 且同一时间只有一种客户端生效；业务代码无需改动。

## 快速使用

### PostgreSQL（推荐，默认）

```bash
pnpm infra:up                 # docker compose -f docker-compose.infra.yml（PG:5433 + Redis:6379）
cp apps/api/.env.example apps/api/.env
pnpm db:deploy
pnpm --filter @wmcms/api db:seed
```

### MySQL 8

```bash
# 1) 准备库与账号（示例）
mysql -uroot -p -e "CREATE DATABASE xhcms CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -uroot -p -e "CREATE USER 'xhcms'@'%' IDENTIFIED BY 'xhcms'; GRANT ALL ON xhcms.* TO 'xhcms'@'%';"

# 2) .env 指向 MySQL，并生成 MySQL 客户端与迁移
#    DATABASE_URL="mysql://xhcms:xhcms@127.0.0.1:3306/xhcms"
pnpm --filter @wmcms/api db:generate:mysql
pnpm --filter @wmcms/api db:reset:mysql      # 迁移 + 种子（会清库）
pnpm dev:api
```

E2E（会重置数据库）：

```bash
# PostgreSQL
pnpm --filter @wmcms/api test

# MySQL
TEST_DATABASE_URL="mysql://xhcms:xhcms@127.0.0.1:3306/xhcms" \
PRISMA_SCHEMA="prisma-mysql/schema.prisma" \
pnpm --filter @wmcms/api test
```

## 两种实现差异（均为已实现，不是 TODO）

| 能力 | PostgreSQL | MySQL 8 |
|---|---|---|
| 全局设置唯一（`siteId IS NULL, key`） | 部分唯一索引 `Setting_global_key_unique` | VIRTUAL 生成列 `globalKey` + 唯一索引（MySQL 无部分索引；STORED 生成列会因外键报 1215，故用 VIRTUAL） |
| 中文子串搜索 | `pg_trgm` GIN 索引加速 `LIKE/ILIKE` | 退化为 `LIKE '%kw%'` 全表扫描（无 trigram 等价物）；中文场景建议上 `ngram` FULLTEXT 或外部搜索引擎 |
| 大小写敏感性 | `mode: 'insensitive'` **已移除**（MySQL 客户端类型不支持）；MySQL 默认排序规则不区分大小写，PG 下为区分大小写 |
| 分类并发环检测 | 事务内 `FOR UPDATE` 行锁 | 同样 `FOR UPDATE`（InnoDB） |
| 长文本字段 | `text` 无长度上限 | 已为 content/summary/url 等标注 `@db.LongText`/`@db.Text`；唯一索引字段（slug/username/email 等）保持 `VARCHAR(191)`，`Chapter.sourceUrl` 为 `VARCHAR(500)` 以满足组合唯一索引长度 |
| 金额/积分 | `Int` | `Int` |

## 注意事项

- 两个 schema 需**手工保持同步**（字段/索引变更时两边都改），迁移各自生成。
- `README`/部署脚本默认 PostgreSQL；生产推荐 `docker-compose.yml`（内置 PG）。
- MySQL 下 `prisma migrate reset` 需要账号具备 CREATE/DROP 库权限；生产环境请勿使用 reset。
- 旧的 SQLite 库文件（`apps/api/prisma/*.db`）已不再使用，可以删除。
