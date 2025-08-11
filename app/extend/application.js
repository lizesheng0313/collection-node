const path = require('path');
const fs = require('fs');

// 加载所有mapper文件
function loadMappers() {
  const mappers = {};
  const mappersPath = path.join(__dirname, '../mapper');

  // 检查目录是否存在
  if (fs.existsSync(mappersPath)) {
    const files = fs.readdirSync(mappersPath);

    for (const file of files) {
      if (file.endsWith('.js')) {
        const name = path.basename(file, '.js');
        mappers[name] = require(path.join(mappersPath, file));
      }
    }
  }

  return mappers;
}

module.exports = {
  // 应用启动时加载所有SQL mapper
  get mapper() {
    if (!this._mapper) {
      this._mapper = loadMappers();
    }
    return this._mapper;
  },

  /**
   * 应用启动完成后的初始化
   */
  async didReady() {
    this.logger.info('🚀 Application ready! Scheduled tasks will handle crawling.');
  },

  /**
   * 获取爬虫统计信息
   */
  getCrawlerStats() {
    const ctx = this.createAnonymousContext();
    return ctx.service.crawler.getCrawlStats();
  },

  /**
   * 手动触发爬取
   * @param period
   * @param language
   * @param limit
   */
  async triggerCrawl(period = 'daily', language = null, limit = 50) {
    const ctx = this.createAnonymousContext();
    return await ctx.service.crawler.manualCrawl(period, language, limit);
  },
};
