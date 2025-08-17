CREATE TABLE IF NOT EXISTS `articles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL COMMENT '文章标题',
  `source` varchar(50) NOT NULL COMMENT '来源网站',
  `collect_time` datetime NOT NULL COMMENT '收集时间',
  `update_time` datetime NOT NULL COMMENT '修改时间',
  `read_count` int(11) DEFAULT 0 COMMENT '阅读量',
  `status` varchar(20) NOT NULL DEFAULT 'published' COMMENT '发布状态',
  `publish_time` datetime DEFAULT NULL COMMENT '发布时间',
  `content` text COMMENT '文章内容',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source`),
  KEY `idx_collect_time` (`collect_time`),
  KEY `idx_publish_time` (`publish_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章表';

CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL COMMENT '用户名',
  `password` varchar(255) NOT NULL COMMENT '密码（加密存储）',
  `email` varchar(100) DEFAULT NULL COMMENT '邮箱',
  `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间',
  `status` tinyint(1) DEFAULT 1 COMMENT '状态：1-正常，0-禁用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 微信用户表
CREATE TABLE IF NOT EXISTS `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `openid` varchar(100) NOT NULL COMMENT '微信openid',
  `unionid` varchar(100) DEFAULT NULL COMMENT '微信unionid',
  `nickName` varchar(255) DEFAULT NULL COMMENT '昵称',
  `avatarUrl` varchar(500) DEFAULT NULL COMMENT '头像URL',
  `source` varchar(20) DEFAULT 'weapp' COMMENT '来源：weapp-小程序',
  `create_time` bigint(20) DEFAULT NULL COMMENT '创建时间戳',
  `update_time` bigint(20) DEFAULT NULL COMMENT '更新时间戳',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信用户表';

-- 用户收藏表
CREATE TABLE IF NOT EXISTS `user_favorites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `article_id` int(11) NOT NULL COMMENT '文章ID',
  `article_type` varchar(50) DEFAULT 'article' COMMENT '文章类型',
  `create_time` bigint(20) DEFAULT NULL COMMENT '收藏时间戳',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_article` (`user_id`,`article_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_article_id` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户收藏表';