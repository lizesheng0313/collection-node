'use strict';

module.exports = options => {
  return async function jwt(ctx, next) {
    // 获取请求头中的token
    const token = ctx.request.header.authorization;
    if (!token) {
      ctx.status = 401;
      ctx.body = {
        code: 401,
        message: '未登录或登录已过期',
      };
      return;
    }

    try {
      // 验证token，如果前端使用'Bearer '前缀，需要去除
      let tokenValue = token;
      if (token.startsWith('Bearer ')) {
        tokenValue = token.slice(7);
      }
      
      // 解析token
      const decoded = ctx.app.jwt.verify(tokenValue, ctx.app.config.jwt.secret);
      
      // 将用户信息挂载到ctx上
      ctx.state.user = decoded;
      
      await next();
    } catch (err) {
      console.error('JWT验证失败:', err.message);
      ctx.status = 401;
      ctx.body = {
        code: 401,
        message: '未登录或登录已过期',
      };
    }
  };
}; 