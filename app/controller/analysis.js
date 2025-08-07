const { Controller } = require('egg');

class AnalysisController extends Controller {
  /**
   * 分析项目商业价值
   * GET /api/analysis/:owner/:repo
   */
  async analyze() {
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

      const result = await ctx.service.starrank.getRepositoryAnalysis(owner, repo);
      ctx.body = result;
    } catch (error) {
      ctx.logger.error(`Failed to analyze repository ${owner}/${repo}:`, error);
      ctx.body = {
        success: false,
        message: 'Failed to analyze repository',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 翻译文本
   * POST /api/analysis/translate
   */
  async translate() {
    const { ctx } = this;
    const { text } = ctx.request.body;

    try {
      // 参数验证
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        ctx.body = {
          success: false,
          message: 'Text parameter is required and must be a non-empty string.',
        };
        ctx.status = 400;
        return;
      }

      if (text.length > 5000) {
        ctx.body = {
          success: false,
          message: 'Text is too long. Maximum length is 5000 characters.',
        };
        ctx.status = 400;
        return;
      }

      // 检查缓存
      const cached = await ctx.service.starrank.getCachedTranslation(text.trim());
      if (cached) {
        ctx.body = {
          success: true,
          data: {
            original: text.trim(),
            translated: cached,
            source: 'cache',
          },
        };
        return;
      }

      // AI翻译
      const translated = await ctx.service.ai.translateToChinese(text.trim());

      // 保存到缓存
      await ctx.service.starrank.saveCachedTranslation(text.trim(), translated);

      ctx.body = {
        success: true,
        data: {
          original: text.trim(),
          translated,
          source: 'ai',
        },
      };
    } catch (error) {
      ctx.logger.error('Failed to translate text:', error);
      ctx.body = {
        success: false,
        message: 'Failed to translate text',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 批量翻译
   * POST /api/analysis/translate/batch
   */
  async batchTranslate() {
    const { ctx } = this;
    const { texts } = ctx.request.body;

    try {
      // 参数验证
      if (!Array.isArray(texts) || texts.length === 0) {
        ctx.body = {
          success: false,
          message: 'Texts parameter must be a non-empty array.',
        };
        ctx.status = 400;
        return;
      }

      if (texts.length > 50) {
        ctx.body = {
          success: false,
          message: 'Too many texts. Maximum is 50 texts per batch.',
        };
        ctx.status = 400;
        return;
      }

      const results = [];
      for (const text of texts) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          results.push({
            original: text,
            translated: text,
            source: 'skip',
            error: 'Invalid text',
          });
          continue;
        }

        if (text.length > 5000) {
          results.push({
            original: text,
            translated: text,
            source: 'skip',
            error: 'Text too long',
          });
          continue;
        }

        try {
          // 检查缓存
          const cached = await ctx.service.starrank.getCachedTranslation(text.trim());
          if (cached) {
            results.push({
              original: text.trim(),
              translated: cached,
              source: 'cache',
            });
            continue;
          }

          // AI翻译
          const translated = await ctx.service.ai.translateToChinese(text.trim());
          await ctx.service.starrank.saveCachedTranslation(text.trim(), translated);

          results.push({
            original: text.trim(),
            translated,
            source: 'ai',
          });
        } catch (error) {
          ctx.logger.warn(`Failed to translate text: ${text.substring(0, 50)}...`, error);
          results.push({
            original: text,
            translated: text,
            source: 'error',
            error: error.message,
          });
        }
      }

      ctx.body = {
        success: true,
        data: {
          results,
          total: texts.length,
          successful: results.filter(r => r.source !== 'error' && r.source !== 'skip').length,
        },
      };
    } catch (error) {
      ctx.logger.error('Failed to batch translate:', error);
      ctx.body = {
        success: false,
        message: 'Failed to batch translate',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 获取分析历史
   * GET /api/analysis/history
   */
  async history() {
    const { ctx } = this;
    const { page = 1, limit = 20, owner, repo } = ctx.query;

    try {
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

      const offset = (pageNum - 1) * limitNum;
      let whereClause = '';
      const params = [];

      if (owner && repo) {
        whereClause = 'WHERE r.owner = ? AND r.name = ?';
        params.push(owner, repo);
      } else if (owner) {
        whereClause = 'WHERE r.owner = ?';
        params.push(owner);
      }

      const sql = `
        SELECT
          a.*,
          r.full_name,
          r.owner,
          r.name,
          r.description,
          r.description_cn,
          r.language,
          r.stars_count,
          r.html_url
        FROM github_analysis a
        JOIN github_repositories r ON a.repository_id = r.id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `;

      params.push(limitNum, offset);
      const results = await ctx.app.mysql.query(sql, params);

      // 格式化结果
      const formattedResults = results.map(row => ({
        id: row.id,
        repository: {
          full_name: row.full_name,
          owner: row.owner,
          name: row.name,
          description: row.description,
          description_cn: row.description_cn,
          language: row.language,
          stars_count: row.stars_count,
          html_url: row.html_url,
        },
        analysis: {
          overall_score: row.overall_score,
          analysis_data: row.analysis_data ? JSON.parse(row.analysis_data) : null,
          summary: row.summary,
        },
        created_at: row.created_at,
      }));

      ctx.body = {
        success: true,
        data: {
          results: formattedResults,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: formattedResults.length,
          },
        },
      };
    } catch (error) {
      ctx.logger.error('Failed to get analysis history:', error);
      ctx.body = {
        success: false,
        message: 'Failed to get analysis history',
        error: error.message,
      };
      ctx.status = 500;
    }
  }
}

module.exports = AnalysisController;