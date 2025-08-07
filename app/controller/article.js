const { Controller } = require('egg');

class ArticleController extends Controller {
  /**
   * 创建文章
   */
  async create() {
    const { ctx, service } = this;
    const data = ctx.request.body;
    try {
      const result = await service.article.create(data);
      ctx.body = {
        success: true,
        data: result,
        message: '文章创建成功'
      };
    } catch (error) {
      ctx.body = {
        success: false,
        message: '文章创建失败',
        error: error.message
      };
    }
  }

  /**
   * 更新文章
   */
  async update() {
    const { ctx, service } = this;
    const id = ctx.params.id;
    const data = ctx.request.body;
    try {
      const result = await service.article.update(id, data);
      ctx.body = {
        success: true,
        data: result,
        message: '文章更新成功'
      };
    } catch (error) {
      ctx.body = {
        success: false,
        message: '文章更新失败',
        error: error.message
      };
    }
  }

  /**
   * 删除文章
   */
  async destroy() {
    const { ctx, service } = this;
    const id = ctx.params.id;
    try {
      const result = await service.article.destroy(id);
      ctx.body = {
        success: true,
        data: result,
        message: '文章删除成功'
      };
    } catch (error) {
      ctx.body = {
        success: false,
        message: '文章删除失败',
        error: error.message
      };
    }
  }

  /**
   * 获取单个文章
   */
  async show() {
    const { ctx, service } = this;
    const id = ctx.params.id;
    const { no_read } = ctx.query;
    try {
      const article = await service.article.find(id, { no_read: no_read === '1' });
      ctx.body = {
        success: true,
        data: article,
        message: '获取文章成功'
      };
    } catch (error) {
      ctx.body = {
        success: false,
        message: '获取文章失败',
        error: error.message
      };
    }
  }

  /**
   * 获取文章列表（分页）
   */
  async index() {
    const { ctx, service } = this;
    // 添加日志，记录当前请求的用户信息
    console.log('当前访问用户信息:', ctx.state.user);

    const { page = 1, pageSize = 10, status, source, article_type } = ctx.query;
    try {
      const where = { status, source };
      if (article_type) {
        where.article_type = article_type;
      }

      const result = await service.article.list(page, pageSize, where);
      ctx.body = {
        success: true,
        data: result,
        message: '获取文章列表成功'
      };
    } catch (error) {
      ctx.body = {
        success: false,
        message: '获取文章列表失败',
        error: error.message
      };
    }
  }

  /**
   * 获取GitHub项目列表
   * GET /api/articles/github
   */
  async github() {
    const { ctx, service } = this;
    const {
      page = 1,
      pageSize = 20,
      language,
      min_stars,
      trending_period,
      sort = 'stars_count',
      order = 'desc'
    } = ctx.query;

    try {
      const filters = { language, min_stars, trending_period };
      const result = await service.article.getGitHubProjects(page, pageSize, filters);

      ctx.body = {
        success: true,
        data: result,
        message: 'GitHub项目列表获取成功'
      };
    } catch (error) {
      ctx.logger.error('Failed to get GitHub projects:', error);
      ctx.body = {
        success: false,
        message: 'GitHub项目列表获取失败',
        error: error.message
      };
      ctx.status = 500;
    }
  }

  /**
   * 获取GitHub项目详情
   * GET /api/articles/github/:owner/:repo
   */
  async githubDetail() {
    const { ctx, service } = this;
    const { owner, repo } = ctx.params;
    const fullName = `${owner}/${repo}`;

    try {
      const article = await service.article.findByGitHubFullName(fullName);

      if (!article) {
        ctx.body = {
          success: false,
          message: '项目不存在'
        };
        ctx.status = 404;
        return;
      }

      // 增加阅读量
      if (article.article_type === 'github_project') {
        await service.article.update(article.id, {
          read_count: (article.read_count || 0) + 1
        });
        article.read_count = (article.read_count || 0) + 1;
      }

      ctx.body = {
        success: true,
        data: article,
        message: 'GitHub项目详情获取成功'
      };
    } catch (error) {
      ctx.logger.error(`Failed to get GitHub project ${fullName}:`, error);
      ctx.body = {
        success: false,
        message: 'GitHub项目详情获取失败',
        error: error.message
      };
      ctx.status = 500;
    }
  }

  /**
   * 获取热门编程语言统计
   * GET /api/articles/github/languages
   */
  async githubLanguages() {
    const { ctx } = this;

    try {
      const sql = `
        SELECT
          programming_language as language,
          COUNT(*) as count,
          AVG(stars_count) as avg_stars,
          SUM(stars_count) as total_stars
        FROM articles
        WHERE article_type = 'github_project'
          AND programming_language IS NOT NULL
          AND programming_language != ''
        GROUP BY programming_language
        ORDER BY count DESC, total_stars DESC
        LIMIT 20
      `;

      const results = await ctx.app.mysql.query(sql);

      ctx.body = {
        success: true,
        data: results.map(row => ({
          language: row.language,
          count: row.count,
          avg_stars: Math.round(row.avg_stars),
          total_stars: row.total_stars
        })),
        message: '编程语言统计获取成功'
      };
    } catch (error) {
      ctx.logger.error('Failed to get language statistics:', error);
      ctx.body = {
        success: false,
        message: '编程语言统计获取失败',
        error: error.message
      };
      ctx.status = 500;
    }
  }

  /**
   * 获取项目评分分布
   * GET /api/articles/github/scores
   */
  async githubScores() {
    const { ctx } = this;

    try {
      const sql = `
        SELECT
          CASE
            WHEN overall_score >= 9 THEN '9-10分'
            WHEN overall_score >= 8 THEN '8-9分'
            WHEN overall_score >= 7 THEN '7-8分'
            WHEN overall_score >= 6 THEN '6-7分'
            WHEN overall_score >= 5 THEN '5-6分'
            ELSE '5分以下'
          END as score_range,
          COUNT(*) as count
        FROM articles
        WHERE article_type = 'github_project'
          AND overall_score IS NOT NULL
        GROUP BY score_range
        ORDER BY MIN(overall_score) DESC
      `;

      const results = await ctx.app.mysql.query(sql);

      ctx.body = {
        success: true,
        data: results,
        message: '评分分布获取成功'
      };
    } catch (error) {
      ctx.logger.error('Failed to get score distribution:', error);
      ctx.body = {
        success: false,
        message: '评分分布获取失败',
        error: error.message
      };
      ctx.status = 500;
    }
  }
}

module.exports = ArticleController; 