const Subscription = require('egg').Subscription;

class CrawlDaily extends Subscription {
  // 通过 schedule 属性来设置定时任务的执行间隔等配置
  static get schedule() {
    return {
      cron: '0 0 8 * * *', // 每天早上8点执行
      type: 'all', // 指定所有的 worker 都需要执行
    };
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe() {
    const ctx = this.ctx;

    try {
      ctx.logger.info('🌅 按天任务开始（50个）');

      // 爬取daily trending项目
      const newCount = await ctx.service.crawler.crawlByLanguage('daily', null, 50);

      ctx.logger.info(`✅ 按天任务完成：新增 ${newCount || 0} 条`);
    } catch (error) {
      ctx.logger.error('❌ 按天任务失败：', error);
    }
  }
}

module.exports = CrawlDaily;
