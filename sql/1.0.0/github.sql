

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


-- 微信小程序用户表
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `openid` varchar(100) NOT NULL COMMENT '微信openid',
  `unionid` varchar(100) DEFAULT NULL COMMENT '微信unionid',
  `nickName` varchar(100) DEFAULT NULL COMMENT '用户昵称',
  `avatarUrl` varchar(500) DEFAULT NULL COMMENT '头像URL',
  `gender` tinyint DEFAULT NULL COMMENT '性别：0-未知，1-男，2-女',
  `city` varchar(50) DEFAULT NULL COMMENT '城市',
  `province` varchar(50) DEFAULT NULL COMMENT '省份',
  `country` varchar(50) DEFAULT NULL COMMENT '国家',
  `language` varchar(20) DEFAULT NULL COMMENT '语言',
  `source` varchar(50) DEFAULT 'weapp' COMMENT '来源：weapp-微信小程序',
  `create_time` bigint DEFAULT NULL COMMENT '创建时间戳',
  `update_time` bigint DEFAULT NULL COMMENT '更新时间戳',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`),
  KEY `idx_unionid` (`unionid`),
  KEY `idx_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信小程序用户表';

-- 用户收藏表
CREATE TABLE `user_favorites` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `article_id` int NOT NULL COMMENT '文章ID',
  `article_type` enum('blog','github_project') NOT NULL COMMENT '收藏类型',
  `create_time` bigint DEFAULT NULL COMMENT '收藏时间戳',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_article` (`user_id`, `article_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_article_type` (`article_type`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户收藏表';

-- 用户阅读历史表
CREATE TABLE `user_read_history` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `article_id` int NOT NULL COMMENT '文章ID',
  `article_type` enum('blog','github_project') NOT NULL COMMENT '文章类型',
  `read_time` bigint DEFAULT NULL COMMENT '阅读时间戳',
  `read_duration` int DEFAULT 0 COMMENT '阅读时长(秒)',
  `read_progress` decimal(5,2) DEFAULT 0 COMMENT '阅读进度百分比(0-100)',
  `last_position` int DEFAULT 0 COMMENT '最后阅读位置',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_article` (`user_id`, `article_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_read_time` (`read_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户阅读历史表';

-- 用户标签表（用于个性化推荐）
CREATE TABLE `user_tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `tag_name` varchar(50) NOT NULL COMMENT '标签名称',
  `tag_type` enum('language','topic','interest') DEFAULT 'interest' COMMENT '标签类型',
  `weight` int DEFAULT 1 COMMENT '权重',
  `create_time` bigint DEFAULT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_tag` (`user_id`, `tag_name`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_tag_name` (`tag_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户标签表';

-- 文章统计表
CREATE TABLE `article_stats` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `article_id` int NOT NULL COMMENT '文章ID',
  `view_count` int DEFAULT 0 COMMENT '浏览次数',
  `favorite_count` int DEFAULT 0 COMMENT '收藏次数',
  `share_count` int DEFAULT 0 COMMENT '分享次数',
  `avg_read_time` int DEFAULT 0 COMMENT '平均阅读时长(秒)',
  `update_time` bigint DEFAULT NULL COMMENT '更新时间戳',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_article_id` (`article_id`),
  KEY `idx_view_count` (`view_count`),
  KEY `idx_favorite_count` (`favorite_count`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章统计表';



