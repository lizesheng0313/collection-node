const Subscription = require('egg').Subscription;

class CrawlMonthly extends Subscription {
  // 通过 schedule 属性来设置定时任务的执行间隔等配置
  static get schedule() {
    return {
      cron: '0 0 3 * * *', // 每天凌晨3点执行
      type: 'worker', // 指定单个 worker 执行，避免重复
    };
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe() {
    const ctx = this.ctx;

    try {
      ctx.logger.info('📆 Monthly scheduled crawl starting...');

      // 爬取monthly trending项目
      const result = await ctx.service.crawler.crawlByLanguage('monthly', null, 200);

      ctx.logger.info(`✅ Monthly crawl completed: ${result.newProjects} new projects`);
    } catch (error) {
      ctx.logger.error('❌ Monthly crawl failed:', error);
    }
  }
}

module.exports = CrawlMonthly;
