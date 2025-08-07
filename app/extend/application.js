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
    // 启动爬虫服务
    try {
      this.logger.info('🚀 Application ready, starting crawler...');

      // 延迟5秒启动爬虫，确保所有服务都已初始化
      setTimeout(async () => {
        try {
          const ctx = this.createAnonymousContext();
          await ctx.service.crawler.startCrawler();
        } catch (error) {
          this.logger.error('Failed to start crawler:', error);
        }
      }, 5000);

    } catch (error) {
      this.logger.error('Failed to initialize crawler:', error);
    }
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
   */
  async triggerCrawl(period = 'daily', language = null, limit = 50) {
    const ctx = this.createAnonymousContext();
    return await ctx.service.crawler.manualCrawl(period, language, limit);
  }
};