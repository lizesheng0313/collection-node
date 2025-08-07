const { Controller } = require('egg');

class GitHubController extends Controller {
  /**
   * 获取GitHub热门项目
   * GET /api/github/trending
   */
  async trending() {
    const { ctx } = this;
    const { period = 'daily', language, page = 1, limit = 25 } = ctx.query;

    try {
      // 参数验证
      if (!['daily', 'weekly', 'monthly'].includes(period)) {
        ctx.body = {
          success: false,
          message: 'Invalid period. Must be daily, weekly, or monthly.',
        };
        ctx.status = 400;
        return;
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        ctx.body = {
          success: false,
          message: 'Invalid pagination parameters.',
        };
        ctx.status = 400;
        return;
      }

      const result = await ctx.service.starrank.getTrendingWithTranslation({
        period,
        language,
        page: pageNum,
        limit: limitNum,
      });

      ctx.body = result;
    } catch (error) {
      ctx.logger.error('Failed to get trending repositories:', error);
      ctx.body = {
        success: false,
        message: 'Failed to fetch trending repositories',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 搜索GitHub项目
   * GET /api/github/search
   */
  async search() {
    const { ctx } = this;
    const { q: query, page = 1, limit = 25, sort = 'stars', order = 'desc' } = ctx.query;

    try {
      // 参数验证
      if (!query || query.trim().length < 2) {
        ctx.body = {
          success: false,
          message: 'Query parameter is required and must be at least 2 characters.',
        };
        ctx.status = 400;
        return;
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        ctx.body = {
          success: false,
          message: 'Invalid pagination parameters.',
        };
        ctx.status = 400;
        return;
      }

      if (!['stars', 'forks', 'updated'].includes(sort)) {
        ctx.body = {
          success: false,
          message: 'Invalid sort parameter. Must be stars, forks, or updated.',
        };
        ctx.status = 400;
        return;
      }

      if (!['asc', 'desc'].includes(order)) {
        ctx.body = {
          success: false,
          message: 'Invalid order parameter. Must be asc or desc.',
        };
        ctx.status = 400;
        return;
      }

      const result = await ctx.service.starrank.searchRepositories(query.trim(), {
        page: pageNum,
        limit: limitNum,
        sort,
        order,
      });

      ctx.body = result;
    } catch (error) {
      ctx.logger.error('Failed to search repositories:', error);
      ctx.body = {
        success: false,
        message: 'Failed to search repositories',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 获取项目详情
   * GET /api/github/repos/:owner/:repo
   */
  async repository() {
    const { ctx } = this;
    const { owner, repo } = ctx.params;

    try {
      // 参数验证
      if (!owner || !repo) {
        ctx.body = {
          success: false,
          message: 'Owner and repo parameters are required.',
        };
        ctx.status = 400;
        return;
      }

      const repoData = await ctx.service.github.getRepositoryDetails(owner, repo);

      // 翻译描述
      if (repoData.description) {
        const cached = await ctx.service.starrank.getCachedTranslation(repoData.description);
        if (cached) {
          repoData.description_cn = cached;
        } else {
          const translated = await ctx.service.ai.translateToChinese(repoData.description);
          repoData.description_cn = translated;
          await ctx.service.starrank.saveCachedTranslation(repoData.description, translated);
        }
      }

      // 保存到数据库
      const repoId = await ctx.service.starrank.saveRepository(repoData);
      repoData.db_id = repoId;

      ctx.body = {
        success: true,
        data: repoData,
      };
    } catch (error) {
      ctx.logger.error(`Failed to get repository ${owner}/${repo}:`, error);
      ctx.body = {
        success: false,
        message: 'Failed to fetch repository details',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 获取搜索建议
   * GET /api/github/suggestions
   */
  async suggestions() {
    const { ctx } = this;
    const { q: query } = ctx.query;

    try {
      if (!query || query.trim().length < 2) {
        ctx.body = {
          success: false,
          message: 'Query parameter is required and must be at least 2 characters.',
        };
        ctx.status = 400;
        return;
      }

      const { getSearchSuggestions } = require('../config/prompts');
      const suggestions = getSearchSuggestions(query.trim());

      ctx.body = {
        success: true,
        data: {
          query: query.trim(),
          suggestions,
        },
      };
    } catch (error) {
      ctx.logger.error('Failed to get search suggestions:', error);
      ctx.body = {
        success: false,
        message: 'Failed to get search suggestions',
        error: error.message,
      };
      ctx.status = 500;
    }
  }
}

module.exports = GitHubController;