const { Service } = require('egg');

class CrawlerService extends Service {
  constructor(ctx) {
    super(ctx);
    this.isRunning = false;
    this.crawlHistory = new Set(); // 记录已爬取的项目ID
  }

  /**
   * 爬取所有时间段的热门项目
   */
  async crawlAllPeriods() {
    if (this.isRunning) {
      this.logger.warn('爬虫已在运行，跳过本次触发');
      return;
    }

    this.isRunning = true;
    this.logger.info('▶️ 开始全量爬取（按周期）');

    try {
      const periods = [ 'daily', 'weekly' ];
      for (const period of periods) {
        const limit = this.getLimitByPeriod(period);
        this.logger.info(`📌 开始爬取「${period === 'daily' ? '天' : '周'}」的 ${limit} 个任务`);
        await this.crawlByLanguage(period, null, limit);
        await this.sleep(1500);
      }
      this.logger.info('✅ 全量爬取完成');
    } catch (error) {
      this.logger.error('❌ 全量爬取失败：', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 按语言爬取项目
   * @param period
   * @param language
   * @param limit
   */
  async crawlByLanguage(period, language, limit) {
    try {
      const options = { period, limit };
      if (language) options.language = language;

      this.logger.info(`开始爬取${period === 'daily' ? '天' : '周'}的 ${limit}个任务`);
      const result = await this.service.starrank.getTrendingWithTranslation(options);

      if (result.success && result.data) {
        const stats = result.data.stats || {};
        const totalFetched = stats.totalFetched || 0;
        const newProcessed = stats.newProcessed || 0;

        this.logger.info(`✅ 完成（${period === 'daily' ? '按天' : '按周'}）：共 ${totalFetched} 条，新入库 ${newProcessed} 条`);
        return newProcessed;
      }
    } catch (error) {
      this.logger.error(`爬取失败：${period} ${language || '全部'}`, error.message);
    }
    return 0;
  }

  /**
   * 根据时间段获取爬取数量限制
   * @param period
   */
  getLimitByPeriod(period) {
    const limits = { daily: 50, weekly: 100 };
    return limits[period] || 50;
  }

  /**
   * 手动触发爬取
   * @param period
   * @param language
   * @param limit
   */
  async manualCrawl(period = 'daily', language = null, limit = 50) {
    this.logger.info(`🔧 手动触发：${period} ${language || '全部'}`);
    return await this.crawlByLanguage(period, language, limit);
  }

  /** 获取爬取统计 */
  getCrawlStats() {
    return {
      isRunning: this.isRunning,
      totalCrawled: this.crawlHistory.size,
      lastCrawlTime: new Date().toISOString(),
    };
  }

  /** 清理历史 */
  clearCrawlHistory() {
    this.crawlHistory.clear();
    this.logger.info('🧹 已清理爬取历史');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CrawlerService;
