

CREATE TABLE `articles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',

  -- 基础信息
  `title` varchar(255) NOT NULL COMMENT '标题',
  `content` longtext COMMENT '内容',
  `summary` text COMMENT '摘要',
  `status` enum('draft','published','archived') DEFAULT 'published' COMMENT '状态',
  `article_type` enum('blog','github_project') DEFAULT 'blog' COMMENT '文章类型',

  -- GitHub项目专用字段
  `github_id` bigint DEFAULT NULL COMMENT 'GitHub仓库ID',
  `github_full_name` varchar(255) DEFAULT NULL COMMENT 'GitHub仓库全名(owner/repo)',
  `github_url` varchar(500) DEFAULT NULL COMMENT 'GitHub仓库URL',
  `original_description` text COMMENT '原始英文描述',
  `translated_description` text COMMENT '翻译后的中文描述',
  `project_intro` text COMMENT '项目介绍',

  -- 技术信息
  `programming_language` varchar(100) DEFAULT NULL COMMENT '主要编程语言',
  `topics` text COMMENT '项目标签(逗号分隔)',
  `license` varchar(100) DEFAULT NULL COMMENT '开源协议',

  -- 统计数据
  `stars_count` int DEFAULT 0 COMMENT 'Star数量',
  `forks_count` int DEFAULT 0 COMMENT 'Fork数量',
  `read_count` int DEFAULT 0 COMMENT '阅读次数',

  -- 评分和分析
  `overall_score` decimal(3,1) DEFAULT NULL COMMENT '综合评分(0-10)',
  `business_analysis` json DEFAULT NULL COMMENT '商业价值分析JSON',

  -- 分类和标签
  `trending_period` enum('daily','weekly','monthly') DEFAULT NULL COMMENT '热门周期',

  -- 时间字段
  `github_created_at` datetime DEFAULT NULL COMMENT 'GitHub创建时间',
  `github_updated_at` datetime DEFAULT NULL COMMENT 'GitHub最后更新时间',
  `collect_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '收集时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `publish_time` datetime DEFAULT NULL COMMENT '发布时间',

  PRIMARY KEY (`id`),

  -- 索引优化
  KEY `idx_article_type` (`article_type`),
  KEY `idx_github_url` (`github_url`),
  KEY `idx_github_full_name` (`github_full_name`),
  KEY `idx_programming_language` (`programming_language`),
  KEY `idx_trending_period` (`trending_period`),
  KEY `idx_status` (`status`),
  KEY `idx_stars_count` (`stars_count`),
  KEY `idx_overall_score` (`overall_score`),
  KEY `idx_collect_time` (`collect_time`),

  -- 唯一约束：防止重复入库
  UNIQUE KEY `uk_github_url` (`github_url`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章表(支持博客和GitHub项目)';





