'use strict';

module.exports = options => {
  return async function miniprogramAuth(ctx, next) {
    // 获取请求头中的token
    const token = ctx.request.header.authorization || ctx.request.header.token;
    
    if (!token) {
      ctx.status = 401;
      ctx.body = {
        success: false,
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

      // 验证用户是否存在
      if (decoded.openid) {
        const user = await ctx.app.mysql.get('user', { openid: decoded.openid });
        if (!user) {
          ctx.status = 401;
          ctx.body = {
            success: false,
            code: 401,
            message: '用户不存在',
          };
          return;
        }
        
        // 将用户信息挂载到ctx上
        ctx.state.user = {
          ...decoded,
          userId: user.id,
          userInfo: user
        };
      } else {
        ctx.state.user = decoded;
      }

      await next();
    } catch (err) {
      console.error('小程序JWT验证失败:', err.message);
      ctx.status = 401;
      ctx.body = {
        success: false,
        code: 401,
        message: '未登录或登录已过期',
      };
    }
  };
};
