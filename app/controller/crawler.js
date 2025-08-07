const { Controller } = require('egg');

class CrawlerController extends Controller {
  /**
   * 获取爬虫状态
   */
  async status() {
    const { ctx } = this;
    
    try {
      const stats = ctx.service.crawler.getCrawlStats();
      
      // 获取数据库中的项目统计
      const totalProjects = await ctx.app.mysql.query(
        'SELECT COUNT(*) as count FROM articles WHERE article_type = ?',
        ['github_project']
      );

      const todayProjects = await ctx.app.mysql.query(
        'SELECT COUNT(*) as count FROM articles WHERE article_type = ? AND DATE(created_at) = CURDATE()',
        ['github_project']
      );

      ctx.body = {
        success: true,
        data: {
          crawler: stats,
          database: {
            totalProjects: totalProjects[0].count,
            todayProjects: todayProjects[0].count
          }
        }
      };
    } catch (error) {
      ctx.logger.error('Failed to get crawler status:', error);
      ctx.body = {
        success: false,
        message: 'Failed to get crawler status',
        error: error.message
      };
    }
  }

  /**
   * 手动触发爬取
   */
  async trigger() {
    const { ctx } = this;
    const { period = 'daily', language, limit = 50 } = ctx.request.body;

    try {
      ctx.logger.info(`Manual crawl triggered: ${period} ${language || 'all'} (${limit})`);
      
      const newCount = await ctx.service.crawler.manualCrawl(period, language, parseInt(limit));
      
      ctx.body = {
        success: true,
        data: {
          message: `Crawl completed for ${period} ${language || 'all languages'}`,
          newProjects: newCount,
          period,
          language: language || 'all',
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      ctx.logger.error('Manual crawl failed:', error);
      ctx.body = {
        success: false,
        message: 'Manual crawl failed',
        error: error.message
      };
    }
  }

  /**
   * 获取爬取历史
   */
  async history() {
    const { ctx } = this;
    const { page = 1, limit = 20, period, language } = ctx.query;

    try {
      const where = {
        article_type: 'github_project'
      };

      if (period) {
        // 根据period筛选时间范围
        const now = new Date();
        let startDate;
        
        switch (period) {
          case 'daily':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'weekly':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case 'monthly':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
        }
        
        if (startDate) {
          where.created_at = { $gte: startDate };
        }
      }

      if (language) {
        where.programming_language = language;
      }

      const result = await ctx.service.article.list({
        where,
        page: parseInt(page),
        limit: parseInt(limit),
        order: [['created_at', 'DESC']]
      });

      ctx.body = {
        success: true,
        data: result
      };
    } catch (error) {
      ctx.logger.error('Failed to get crawl history:', error);
      ctx.body = {
        success: false,
        message: 'Failed to get crawl history',
        error: error.message
      };
    }
  }

  /**
   * 清理爬取历史缓存
   */
  async clearCache() {
    const { ctx } = this;

    try {
      ctx.service.crawler.clearCrawlHistory();
      
      ctx.body = {
        success: true,
        data: {
          message: 'Crawl history cache cleared successfully'
        }
      };
    } catch (error) {
      ctx.logger.error('Failed to clear crawl cache:', error);
      ctx.body = {
        success: false,
        message: 'Failed to clear crawl cache',
        error: error.message
      };
    }
  }

  /**
   * 获取支持的编程语言列表
   */
  async languages() {
    const { ctx } = this;

    try {
      // 从数据库获取已爬取的编程语言
      const languages = await ctx.app.mysql.query(`
        SELECT programming_language, COUNT(*) as count 
        FROM articles 
        WHERE article_type = 'github_project' 
        AND programming_language IS NOT NULL 
        GROUP BY programming_language 
        ORDER BY count DESC 
        LIMIT 20
      `);

      // 预定义的热门语言
      const popularLanguages = [
        'JavaScript', 'Python', 'Java', 'TypeScript', 'Go', 
        'Rust', 'C++', 'C#', 'PHP', 'Swift', 'Kotlin', 'Ruby'
      ];

      ctx.body = {
        success: true,
        data: {
          popular: popularLanguages,
          fromDatabase: languages.map(lang => ({
            name: lang.programming_language,
            count: lang.count
          }))
        }
      };
    } catch (error) {
      ctx.logger.error('Failed to get languages:', error);
      ctx.body = {
        success: false,
        message: 'Failed to get languages',
        error: error.message
      };
    }
  }
}

module.exports = CrawlerController;
