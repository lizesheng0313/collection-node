-- 评论表
CREATE TABLE `comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  `article_id` int(11) NOT NULL COMMENT '文章ID',
  `article_type` varchar(50) NOT NULL DEFAULT 'github_project' COMMENT '文章类型：github_project, blog_post',
  `parent_id` int(11) DEFAULT NULL COMMENT '父评论ID，用于回复功能',
  `nickname` varchar(100) NOT NULL COMMENT '昵称',
  `email` varchar(255) NOT NULL COMMENT '邮箱',
  `content` text NOT NULL COMMENT '评论内容',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text DEFAULT NULL COMMENT '用户代理',
  `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '状态：0-待审核，1-已通过，2-已拒绝',
  `like_count` int(11) NOT NULL DEFAULT 0 COMMENT '点赞数',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_article_type` (`article_type`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- 评论点赞表
CREATE TABLE `comment_likes` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '点赞ID',
  `comment_id` int(11) NOT NULL COMMENT '评论ID',
  `ip_address` varchar(45) NOT NULL COMMENT 'IP地址',
  `user_agent` text DEFAULT NULL COMMENT '用户代理',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_comment_ip` (`comment_id`, `ip_address`),
  KEY `idx_comment_id` (`comment_id`),
  FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论点赞表';
