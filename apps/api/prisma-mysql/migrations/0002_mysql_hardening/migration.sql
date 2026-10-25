-- MySQL 加固迁移
-- MySQL 不支持部分唯一索引：用 VIRTUAL 生成列把「全局设置（siteId IS NULL）」映射为唯一键，
-- 从而在数据库层保证 (siteId=NULL, key) 唯一；非全局行生成列为 NULL，不受唯一约束影响。
-- 注意：
--   1) key 是 MySQL 保留字，表达式里必须使用反引号；
--   2) 必须用 VIRTUAL 而非 STORED —— MySQL 8 对带外键的表新增 STORED 生成列会报 ERROR 1215。
ALTER TABLE `Setting`
  ADD COLUMN `globalKey` VARCHAR(191) GENERATED ALWAYS AS (IF(`siteId` IS NULL, `key`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX `Setting_global_key_unique` (`globalKey`);
