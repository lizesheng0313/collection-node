/* eslint valid-jsdoc: "off" */

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
      host: '127.0.0.1',
      // 端口号
      port: '3306',
      // 用户名
      user: 'root',
      // 密码
      password: '@lizesheng123@',
      // 数据库名
      database: 'blog',
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
    secret: 'blog-jwt-secret-key', // JWT密钥，实际应用中应使用更复杂的密钥
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
    currentModel: 'deepseek', // 当前使用的AI模型
    models: {
      deepseek: {
        api_url: 'https://api.deepseek.com/v1/chat/completions',
        api_key: 'sk-e685248451cf4ce29b633e21894f96f8',
        model: 'deepseek-chat',
      },
    },
  };

  return {
    ...config,
    ...userConfig,
  };
};
