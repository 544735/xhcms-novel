-- PostgreSQL 加固迁移
-- 1) pg_trgm：让站内搜索的 LIKE/ILIKE '%关键词%' 走 GIN 索引（含中文子串），避免全表扫描
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Article_title_trgm_idx" ON "Article" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Article_summary_trgm_idx" ON "Article" USING gin ("summary" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Article_content_trgm_idx" ON "Article" USING gin ("content" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Novel_title_trgm_idx" ON "Novel" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Novel_summary_trgm_idx" ON "Novel" USING gin ("summary" gin_trgm_ops);

-- 2) 全局设置（siteId IS NULL）按 key 唯一。
--    PostgreSQL/SQLite 的唯一索引都不会约束 NULL 行，这里用部分唯一索引补上，
--    使并发写入不可能产生重复的全局配置行。
CREATE UNIQUE INDEX IF NOT EXISTS "Setting_global_key_unique" ON "Setting" ("key") WHERE "siteId" IS NULL;
