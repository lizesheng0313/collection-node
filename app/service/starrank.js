const { Service } = require('egg');

class StarRankService extends Service {
  /**
   * 获取热门项目列表（带翻译）
   * @param {Object} options - 查询选项
   * @return {Promise<Object>} 项目列表和分页信息
   */
  async getTrendingWithTranslation(options = {}) {
    const { period = 'daily', language, page = 1, limit = 25 } = options;

    try {
      // 获取GitHub热门项目
      const repositories = await this.service.github.getTrendingRepositories({
        period,
        language,
        page,
        limit,
      });

      // 处理每个仓库：翻译描述
      const processedRepos = [];
      for (let i = 0; i < repositories.length; i++) {
        const repo = repositories[i];
        try {
          // 已存在则跳过重处理
          try {
            const existed = await this.service.article.findByGitHubId(repo.html_url);
            if (existed) {
              this.logger.info(`已存在，跳过：${repo.full_name}`);
              continue;
            }
          } catch (_) {}
          // 五步进度（带信息与进度）
          this.logger.info(`开始爬取 [${i + 1}/${repositories.length}]：${repo.full_name || repo.name}`);
          this.logger.info(`标题：${repo.name || repo.full_name}`);
          // 翻译描述
          if (repo.description && !repo.description_cn) {
            this.logger.info(`开始翻译：${repo.description.slice(0, 50)}${repo.description.length > 50 ? '...' : ''}`);
            const translated = await this.service.ai.translateToChinese(repo.description, repo);
            repo.description_cn = translated;
          }

          // 生成项目介绍
          const projectIntro = await this.service.ai.generateProjectIntro(repo);
          repo.project_intro = projectIntro;

          // 分析并保存
          this.logger.info(`开始分析：${repo.full_name}`);

          try {
            const analysis = await this.service.ai.analyzeBusinessValue(repo);

            // 严格检查：必须有完整的商业分析字段
            if (!analysis || !analysis.overall_score) {
              throw new Error('AI分析返回空结果或缺少评分');
            }

            // 检查是否有完整的商业分析字段
            const hasCompleteAnalysis = analysis.money_making_ideas || analysis.target_customers || analysis.problem_solved;
            if (!hasCompleteAnalysis) {
              throw new Error('AI分析缺少关键商业分析字段（money_making_ideas, target_customers, problem_solved）');
            }

            try {
              const repoId = await this.saveRepository(repo, analysis, period);
              repo.db_id = repoId;
              this.logger.info(`✅ 入库完成：ID=${repoId}，评分=${analysis.overall_score}，完整分析`);
              processedRepos.push(repo);
            } catch (saveError) {
              this.logger.error(`❌ 入库失败：${repo.full_name}，原因：${saveError.message}`);
              throw saveError;
            }
          } catch (analysisError) {
            this.logger.error(`❌ 商业分析失败：${repo.full_name}`);
            this.logger.error(`   错误类型：${analysisError.name || 'Unknown'}`);
            this.logger.error(`   错误信息：${analysisError.message}`);
            this.logger.error(`   项目描述：${repo.description || '无描述'}`);
            this.logger.error(`   项目语言：${repo.language || '未知'}`);
            this.logger.error(`   项目标签：${(repo.topics || []).join(', ') || '无标签'}`);
            // 不入库，继续处理下一个项目
          }
        } catch (error) {
          this.logger.warn(`处理仓库出错：${repo.full_name}`, error);
          // 移除这行，避免错误的项目也被添加到结果中
          // processedRepos.push(repo);
        }
      }

      return {
        success: true,
        data: {
          repositories: processedRepos,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: processedRepos.length,
          },
          stats: {
            totalFetched: repositories.length,
            newProcessed: processedRepos.length,
            skipped: repositories.length - processedRepos.length,
          },
          period,
          language,
        },
      };
    } catch (error) {
      this.logger.error('获取热门仓库失败：', error);
      throw error;
    }
  }

  /**
   * 获取项目详情和商业价值分析
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @return {Promise<Object>} 项目详情和分析结果
   */
  async getRepositoryAnalysis(owner, repo) {
    try {
      this.logger.info(`开始分析：${owner}/${repo}`);
      // 获取仓库详细信息
      const repoData = await this.service.github.getRepositoryDetails(owner, repo);
      // 翻译项目描述
      if (repoData.description && !repoData.description_cn) {
        const translated = await this.service.ai.translateToChinese(repoData.description);
        repoData.description_cn = translated;
      }
      // 生成项目介绍
      const projectIntro = await this.service.ai.generateProjectIntro(repoData);
      repoData.project_intro = projectIntro;
      // 商业价值分析
      const analysis = await this.service.ai.analyzeBusinessValue(repoData);
      if (!analysis || !analysis.overall_score) {
        throw new Error('商业价值分析失败，无法保存项目');
      }
      // 保存到数据库
      const repoId = await this.saveRepository(repoData, analysis);
      return {
        success: true,
        data: { repository: repoData, analysis, db_ids: { repository: repoId } },
      };
    } catch (error) {
      this.logger.error(`分析失败：${owner}/${repo}`, error);
      throw error;
    }
  }

  /**
   * 搜索项目（带翻译）
   * @param {string} query - 搜索关键词
   * @param {Object} options - 搜索选项
   * @return {Promise<Object>} 搜索结果
   */
  async searchRepositories(query, options = {}) {
    const { page = 1, limit = 25, sort = 'stars', order = 'desc' } = options;

    try {
      // 先从数据库搜索
      const dbResults = await this.searchFromDatabase(query, { page, limit, sort, order });

      // 如果数据库结果不足，从GitHub搜索
      let githubResults = [];
      if (dbResults.length < limit) {
        githubResults = await this.service.github.searchRepositories(query, {
          page,
          limit: limit - dbResults.length,
          sort,
          order,
        });

        // 处理GitHub搜索结果
        for (const repo of githubResults) {
          // 翻译描述
          if (repo.description && !repo.description_cn) {
            try {
              const translated = await this.service.ai.translateToChinese(repo.description);
              repo.description_cn = translated;
            } catch (error) {
              this.logger.warn(`Translation failed for ${repo.full_name}:`, error);
              repo.description_cn = repo.description;
            }
          }

          // 先进行商业价值分析，再保存到数据库
          try {
            this.logger.info(`🤖 Starting AI analysis for ${repo.full_name}...`);

            // 进行AI商业价值分析
            const analysis = await this.service.ai.analyzeBusinessValue(repo);

            if (analysis && analysis.overall_score) {
              // 只有分析成功才保存项目
              const repoId = await this.saveRepository(repo, analysis);
              if (repoId) {
                this.logger.info(`✅ Successfully analyzed and saved ${repo.full_name} with score ${analysis.overall_score}`);
              }
            } else {
              this.logger.warn(`❌ Business analysis failed for ${repo.full_name}, skipping save`);
            }
          } catch (error) {
            this.logger.warn(`Failed to analyze and save repo ${repo.full_name}:`, error);
          }
        }
      }

      const allResults = [ ...dbResults, ...githubResults ];

      return {
        success: true,
        data: {
          repositories: allResults,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: allResults.length,
          },
          query,
          sources: {
            database: dbResults.length,
            github: githubResults.length,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to search repositories:', error);
      throw error;
    }
  }

  /**
   * 从数据库搜索GitHub项目
   * @param {string} query - 搜索关键词
   * @param {Object} options - 搜索选项
   * @return {Promise<Array>} 搜索结果
   */
  async searchFromDatabase(query, options = {}) {
    const { page = 1, limit = 25, sort = 'stars_count', order = 'desc' } = options;

    try {
      // 构建搜索条件
      const where = {
        article_type: 'github_project',
        status: 'published',
      };

      // 使用LIKE搜索
      const searchConditions = [
        `github_full_name LIKE '%${query}%'`,
        `original_description LIKE '%${query}%'`,
        `translated_description LIKE '%${query}%'`,
        `programming_language LIKE '%${query}%'`,
        `topics LIKE '%${query}%'`,
      ];

      const sql = `
        SELECT * FROM articles
        WHERE article_type = 'github_project'
          AND status = 'published'
          AND (${searchConditions.join(' OR ')})
        ORDER BY ${sort} ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;

      const offset = (page - 1) * limit;
      const results = await this.app.mysql.query(sql, [ limit, offset ]);

      return results.map(row => this.service.article.formatArticleData(row));
    } catch (error) {
      this.logger.error('Database search failed:', error);
      return [];
    }
  }

  /**
   * 保存GitHub项目为文章
   * @param {Object} repoData - 仓库数据
   * @param {Object} analysisData - 分析数据
   * @param {string} period - 热门周期
   * @return {Promise<number>} 文章ID
   */
  async saveRepository(repoData, analysisData = null, period = null) {
    try {
      this.logger.info(`[SAVE] 💾 Upsert ${repoData.full_name} url=${repoData.html_url}`);

      // 检查是否已存在（用 github_url 去重）
      const existing = await this.service.article.findByGitHubId(repoData.html_url);

      if (existing) {
        // 更新现有项目
        const result = await this.service.article.updateGitHubProject(
          existing.id,
          repoData,
          analysisData,
          period
        );
        return existing.id;
      }
      // 创建新的GitHub项目文章
      const result = await this.service.article.createGitHubProject(repoData, analysisData, period);
      return result.id;

    } catch (error) {
      this.logger.error('Failed to save repository:', error);
      throw error;
    }
  }


  /**
   * 获取缓存的翻译
   * @param {string} originalText - 原文
   * @return {Promise<string|null>} 翻译结果
   */
  async getCachedTranslation(originalText) {
    try {
      const result = await this.app.mysql.get('translation_cache', { original_text: originalText });
      return result ? result.translated_text : null;
    } catch (error) {
      this.logger.error('Failed to get cached translation:', error);
      return null;
    }
  }

  /**
   * 保存翻译到缓存
   * @param {string} originalText - 原文
   * @param {string} translatedText - 译文
   * @return {Promise<void>}
   */
  async saveCachedTranslation(originalText, translatedText) {
    try {
      const data = {
        original_text: originalText,
        translated_text: translatedText,
        source: 'ai_model',
        created_at: new Date(),
      };

      await this.app.mysql.insert('translation_cache', data);
    } catch (error) {
      this.logger.error('Failed to save cached translation:', error);
      // 不抛出错误，缓存失败不应该影响主流程
    }
  }

  /**
   * 格式化数据库行数据
   * @param {Object} row - 数据库行
   * @return {Object} 格式化后的数据
   */
  formatDatabaseRow(row) {
    return {
      id: row.github_id,
      full_name: row.full_name,
      name: row.name,
      owner: row.owner,
      description: row.description,
      description_cn: row.description_cn,
      language: row.language,
      stars_count: row.stars_count,
      forks_count: row.forks_count,
      watchers_count: row.watchers_count,
      open_issues_count: row.open_issues_count,
      size_kb: row.size_kb,
      topics: row.topics ? JSON.parse(row.topics) : [],
      license: row.license,
      is_fork: row.is_fork === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
      pushed_at: row.pushed_at,
      html_url: row.html_url,
      clone_url: row.clone_url,
      homepage: row.homepage,
      default_branch: row.default_branch,
      db_id: row.id,
      collect_time: row.collect_time,
      update_time: row.update_time,
    };
  }


}

module.exports = StarRankService;
