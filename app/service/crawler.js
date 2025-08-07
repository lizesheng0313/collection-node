const { Service } = require('egg');

class CrawlerService extends Service {
  constructor(ctx) {
    super(ctx);
    this.isRunning = false;
    this.crawlHistory = new Set(); // 记录已爬取的项目ID
  }

  /**
   * 启动爬虫 - 应用启动时调用
   */
  async startCrawler() {
    this.logger.info('🕷️ Starting GitHub crawler...');
    
    // 立即执行一次爬取
    await this.crawlAllPeriods();
    
    // 设置定时任务
    this.setupScheduledTasks();
  }

  /**
   * 爬取所有时间段的热门项目
   */
  async crawlAllPeriods() {
    if (this.isRunning) {
      this.logger.warn('Crawler is already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.logger.info('🚀 Starting comprehensive crawl...');

    try {
      // 爬取不同时间段的项目
      const periods = ['daily', 'weekly', 'monthly'];
      const languages = ['JavaScript', 'Python', 'Java', 'TypeScript', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Swift'];
      
      for (const period of periods) {
        this.logger.info(`📅 Crawling ${period} trending...`);
        
        // 爬取所有语言
        await this.crawlByLanguage(period, null, this.getLimitByPeriod(period));
        
        // 爬取热门语言
        for (const language of languages.slice(0, 5)) { // 只爬前5种语言避免API限制
          await this.crawlByLanguage(period, language, 20);
          await this.sleep(1000); // 避免API限制
        }
        
        await this.sleep(2000); // 每个时间段之间暂停
      }

      this.logger.info('✅ Comprehensive crawl completed');
    } catch (error) {
      this.logger.error('❌ Crawl failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 按语言爬取项目
   */
  async crawlByLanguage(period, language, limit) {
    try {
      const options = { period, limit };
      if (language) {
        options.language = language;
      }

      const result = await this.service.starrank.getTrendingWithTranslation(options);
      
      if (result.success && result.data.repositories) {
        const newProjects = result.data.repositories.filter(repo => 
          !this.crawlHistory.has(repo.id)
        );

        this.logger.info(`📊 ${period}${language ? ` (${language})` : ''}: Found ${result.data.repositories.length} projects, ${newProjects.length} new`);
        
        // 记录已爬取的项目
        result.data.repositories.forEach(repo => {
          this.crawlHistory.add(repo.id);
        });

        return newProjects.length;
      }
    } catch (error) {
      this.logger.error(`Failed to crawl ${period} ${language || 'all'}:`, error.message);
    }
    
    return 0;
  }

  /**
   * 根据时间段获取爬取数量限制
   */
  getLimitByPeriod(period) {
    const limits = {
      daily: 50,
      weekly: 100,
      monthly: 200
    };
    return limits[period] || 50;
  }

  /**
   * 设置定时任务
   */
  setupScheduledTasks() {
    // 每天早上8点爬取daily trending
    this.scheduleTask('0 0 8 * * *', async () => {
      this.logger.info('🌅 Daily scheduled crawl starting...');
      await this.crawlByLanguage('daily', null, 50);
    });

    // 每周一早上8点爬取weekly trending  
    this.scheduleTask('0 0 8 * * 1', async () => {
      this.logger.info('📅 Weekly scheduled crawl starting...');
      await this.crawlByLanguage('weekly', null, 100);
    });

    // 每月1号早上8点爬取monthly trending
    this.scheduleTask('0 0 8 1 * *', async () => {
      this.logger.info('📆 Monthly scheduled crawl starting...');
      await this.crawlByLanguage('monthly', null, 200);
    });

    this.logger.info('⏰ Scheduled tasks configured');
  }

  /**
   * 简单的定时任务实现
   */
  scheduleTask(cronPattern, task) {
    // 这里可以集成node-cron或其他定时任务库
    // 暂时用简单的setInterval实现
    const intervals = {
      '0 0 8 * * *': 24 * 60 * 60 * 1000, // 每天
      '0 0 8 * * 1': 7 * 24 * 60 * 60 * 1000, // 每周
      '0 0 8 1 * *': 30 * 24 * 60 * 60 * 1000, // 每月(简化)
    };

    const interval = intervals[cronPattern];
    if (interval) {
      setInterval(task, interval);
    }
  }

  /**
   * 手动触发爬取
   */
  async manualCrawl(period = 'daily', language = null, limit = 50) {
    this.logger.info(`🔧 Manual crawl triggered: ${period} ${language || 'all'}`);
    return await this.crawlByLanguage(period, language, limit);
  }

  /**
   * 获取爬取统计
   */
  getCrawlStats() {
    return {
      isRunning: this.isRunning,
      totalCrawled: this.crawlHistory.size,
      lastCrawlTime: new Date().toISOString()
    };
  }

  /**
   * 清理爬取历史（避免内存泄漏）
   */
  clearCrawlHistory() {
    this.crawlHistory.clear();
    this.logger.info('🧹 Crawl history cleared');
  }

  /**
   * 工具方法：延时
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CrawlerService;
