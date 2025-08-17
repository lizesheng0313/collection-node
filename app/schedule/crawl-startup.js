const Subscription = require('egg').Subscription;

class CrawlStartup extends Subscription {
  static get schedule() {
    return {
      immediate: false,
      type: 'worker',
      disable: true,
    };
  }

  async subscribe() {
    const ctx = this.ctx;
    try {
      ctx.logger.info('🚀 启动后自动执行爬取');

      const tasks = [
        { period: 'daily', limit: 50 },
        { period: 'weekly', limit: 100 },
        { period: 'monthly', limit: 200 },
      ];

      for (let i = 0; i < tasks.length; i++) {
        const { period, limit } = tasks[i];
        const periodName = period === 'daily' ? '按天' : period === 'weekly' ? '按周' : '按月';
        ctx.logger.info(`▶️ 开始：${periodName}（${limit}）`);
        const newCount = await ctx.service.crawler.crawlByLanguage(period, null, limit);
        ctx.logger.info(`✅ 完成：${periodName} 新增 ${newCount || 0} 条`);
        if (i < tasks.length - 1) {
          ctx.logger.info('⏸ 暂停 2 秒...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      ctx.logger.info('🎉 启动爬取完成');
    } catch (error) {
      ctx.logger.error('❌ 启动爬取失败：', error);
    }
  }
}

module.exports = CrawlStartup;
