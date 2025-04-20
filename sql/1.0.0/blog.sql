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

