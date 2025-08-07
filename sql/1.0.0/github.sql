
-- 1. 扩展articles表，添加GitHub项目支持
ALTER TABLE `articles`
ADD COLUMN `article_type` ENUM('blog', 'github_project') DEFAULT 'blog' COMMENT '文章类型',
ADD COLUMN `github_id` BIGINT NULL COMMENT 'GitHub仓库ID',
ADD COLUMN `github_full_name` VARCHAR(255) NULL COMMENT 'GitHub仓库全名',
ADD COLUMN `github_url` VARCHAR(500) NULL COMMENT 'GitHub仓库URL',
ADD COLUMN `original_description` TEXT NULL COMMENT '原始英文描述',
ADD COLUMN `translated_description` TEXT NULL COMMENT '翻译后的中文描述',
ADD COLUMN `programming_language` VARCHAR(100) NULL COMMENT '主要编程语言',
ADD COLUMN `stars_count` INT DEFAULT 0 COMMENT 'Star数量',
ADD COLUMN `forks_count` INT DEFAULT 0 COMMENT 'Fork数量',
ADD COLUMN `open_issues_count` INT DEFAULT 0 COMMENT '开放Issue数量',
ADD COLUMN `size_kb` INT DEFAULT 0 COMMENT '仓库大小(KB)',
ADD COLUMN `github_created_at` DATETIME NULL COMMENT 'GitHub创建时间',
ADD COLUMN `github_updated_at` DATETIME NULL COMMENT 'GitHub最后更新时间',
ADD COLUMN `topics` TEXT NULL COMMENT '项目标签',
ADD COLUMN `homepage` VARCHAR(500) NULL COMMENT '项目主页',
ADD COLUMN `license` VARCHAR(100) NULL COMMENT '开源协议',
ADD COLUMN `overall_score` DECIMAL(3,1) NULL COMMENT '综合评分(0-10)',
ADD COLUMN `summary` TEXT NULL COMMENT '摘要',
ADD COLUMN `url` VARCHAR(1000) NULL COMMENT '原文链接',
ADD COLUMN `author` VARCHAR(100) NULL COMMENT '作者',
ADD COLUMN `tags` VARCHAR(500) NULL COMMENT '标签',
ADD COLUMN `category_id` INT NULL COMMENT '分类ID',
ADD COLUMN `is_recommend` TINYINT(1) DEFAULT 0 COMMENT '是否推荐',
ADD COLUMN `thumbnail` VARCHAR(500) NULL COMMENT '缩略图',
ADD COLUMN `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
ADD COLUMN `project_intro` TEXT NULL COMMENT '项目介绍',
ADD COLUMN `main_image` VARCHAR(500) NULL COMMENT '项目主图',
ADD COLUMN `business_analysis` JSON NULL COMMENT '商业价值分析';

-- 2. 添加索引优化查询性能
ALTER TABLE `articles`
ADD INDEX `idx_article_type` (`article_type`),
ADD INDEX `idx_github_id` (`github_id`),
ADD INDEX `idx_github_full_name` (`github_full_name`),
ADD INDEX `idx_programming_language` (`programming_language`);

-- 3. 翻译缓存表 - 避免重复翻译，提升性能
CREATE TABLE IF NOT EXISTS `translation_cache` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `original_text` TEXT NOT NULL COMMENT '原始文本',
  `translated_text` TEXT NOT NULL COMMENT '翻译后文本',
  `source` VARCHAR(50) DEFAULT 'ai_model' COMMENT '翻译来源',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_original_text` (`original_text`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='翻译缓存表';


-- 5. 新增字段 - 项目介绍和主图
ALTER TABLE `articles`
ADD COLUMN `project_intro` TEXT NULL COMMENT '项目介绍',
ADD COLUMN `main_image` VARCHAR(500) NULL COMMENT '项目主图';





