/* eslint valid-jsdoc: "off" */

// 加载环境变量
require('dotenv').config();

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1744549122242_7343';

  // 服务器配置
  config.cluster = {
    listen: {
      port: parseInt(process.env.PORT) || 7003,
      hostname: '127.0.0.1',
    },
  };

  // 日志配置
  config.logger = {
    dir: process.env.LOG_DIR || './logs',
  };

  // add your middleware config here
  config.middleware = [];

  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
  };

  // 添加MySQL配置
  config.mysql = {
    // 单数据库信息配置
    client: {
      // host
      host: process.env.DB_HOST || '127.0.0.1',
      // 端口号
      port: process.env.DB_PORT || '3306',
      // 用户名
      user: process.env.DB_USER || 'root',
      // 密码
      password: process.env.DB_PASSWORD || '',
      // 数据库名
      database: process.env.DB_NAME || 'blog',
      // 连接超时时间
      connectTimeout: 60000,
      // 连接池配置
      connectionLimit: 10,
      // SSL配置
      ssl: false,
    },
    // 是否加载到 app 上，默认开启
    app: true,
    // 是否加载到 agent 上，默认关闭
    agent: false,
  };

  // JWT配置
  config.jwt = {
    secret: process.env.JWT_SECRET || 'blog-jwt-secret-key', // JWT密钥，实际应用中应使用更复杂的密钥
    expiresIn: '24h', // token过期时间
  };

  // 完全禁用安全相关功能，包括CSRF
  config.security = {
    csrf: {
      enable: false, // 关闭CSRF
      ignoreJSON: true, // 忽略JSON请求
    },
    domainWhiteList: [ '*' ],
  };

  // CORS配置
  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',
  };

  // 禁用Session功能，因为使用JWT不需要Session
  config.session = {
    enable: false,
  };

  // GitHub配置
  config.github = {
    token: process.env.GITHUB_TOKEN || '', // GitHub API Token
  };

  // AI模型配置
  config.ai = {
    currentModel: process.env.AI_CURRENT_MODEL || 'deepseek', // 当前使用的AI模型
    models: {
      deepseek: {
        api_url: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
        api_key: process.env.DEEPSEEK_API_KEY || '',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      },
    },
  };

  return {
    ...config,
    ...userConfig,
  };
};
