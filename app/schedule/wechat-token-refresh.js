'use strict';

const Subscription = require('egg').Subscription;

class WechatTokenRefresh extends Subscription {
  // 通过 schedule 属性来设置定时任务的执行间隔等配置
  static get schedule() {
    return {
      interval: '1h', // 每小时执行一次
      type: 'all', // 指定所有的 worker 都需要执行
      immediate: false, // 配置了该参数为 true 时，这个定时任务会在应用启动并 ready 后立刻执行一次这个定时任务
    };
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe() {
    const { ctx } = this;
    
    try {
      ctx.logger.info('开始执行微信Access Token刷新任务...');
      
      // 清理过期的token
      const cleanedCount = await ctx.service.wechat.cleanExpiredTokens();
      if (cleanedCount > 0) {
        ctx.logger.info(`清理了 ${cleanedCount} 个过期的Access Token`);
      }
      
      // 检查当前token是否即将过期（提前30分钟刷新）
      const { app, config } = ctx;
      const appId = config.miniprogram.appId;
      
      if (!appId) {
        ctx.logger.warn('未配置小程序AppID，跳过Access Token刷新');
        return;
      }
      
      const tokenRecord = await app.mysql.get('wechat_access_tokens', { app_id: appId });
      
      if (!tokenRecord) {
        // 没有token记录，获取新的
        ctx.logger.info('没有找到Access Token记录，获取新的token...');
        await ctx.service.wechat.refreshAccessToken();
      } else {
        // 检查是否即将过期（提前30分钟）
        const expiresAt = new Date(tokenRecord.expires_at);
        const now = new Date();
        const timeDiff = expiresAt.getTime() - now.getTime();
        const minutesLeft = Math.floor(timeDiff / (1000 * 60));
        
        if (minutesLeft <= 30) {
          ctx.logger.info(`Access Token将在 ${minutesLeft} 分钟后过期，开始刷新...`);
          await ctx.service.wechat.refreshAccessToken();
        } else {
          ctx.logger.info(`Access Token还有 ${minutesLeft} 分钟过期，暂不刷新`);
        }
      }
      
      ctx.logger.info('微信Access Token刷新任务执行完成');
    } catch (error) {
      ctx.logger.error('微信Access Token刷新任务执行失败:', error);
    }
  }
}

module.exports = WechatTokenRefresh;
