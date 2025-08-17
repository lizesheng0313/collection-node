-- 微信Access Token表
CREATE TABLE `wechat_access_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `app_id` varchar(100) NOT NULL COMMENT '小程序AppID',
  `access_token` text NOT NULL COMMENT 'Access Token',
  `expires_in` int(11) NOT NULL DEFAULT 7200 COMMENT '过期时间（秒）',
  `expires_at` timestamp NOT NULL COMMENT '过期时间戳',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_app_id` (`app_id`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信Access Token表';
