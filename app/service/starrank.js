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
      for (const repo of repositories) {
        try {
          // 翻译描述
          if (repo.description && !repo.description_cn) {
            // 先检查缓存
            const cached = await this.getCachedTranslation(repo.description);
            if (cached) {
              repo.description_cn = cached;
            } else {
              // 调用AI翻译
              const translated = await this.service.ai.translateToChinese(repo.description);
              repo.description_cn = translated;
              // 保存到缓存
              await this.saveCachedTranslation(repo.description, translated);
            }
          }

          // 保存到数据库
          const repoId = await this.saveRepository(repo);
          repo.db_id = repoId;

          // 异步触发商业价值分析
          if (repoId) {
            this.triggerBusinessAnalysis(repo.full_name, repoId);
          }

          processedRepos.push(repo);
        } catch (error) {
          this.logger.warn(`Error processing repo ${repo.full_name}:`, error);
          processedRepos.push(repo); // 即使处理失败也返回原始数据
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
          period,
          language,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get trending repositories:', error);
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
      this.logger.info(`Starting analysis for ${owner}/${repo}`);

      // 获取仓库详细信息
      const repoData = await this.service.github.getRepositoryDetails(owner, repo);

      // 翻译项目描述
      if (repoData.description && !repoData.description_cn) {
        const cached = await this.getCachedTranslation(repoData.description);
        if (cached) {
          repoData.description_cn = cached;
        } else {
          const translated = await this.service.ai.translateToChinese(repoData.description);
          repoData.description_cn = translated;
          await this.saveCachedTranslation(repoData.description, translated);
        }
      }

      // 生成项目介绍
      const cacheKey = `project_intro_${owner}_${repo}`;
      const cached = await this.getCachedTranslation(cacheKey);
      if (cached) {
        repoData.project_intro = cached;
      } else {
        const projectIntro = await this.service.ai.generateProjectIntro(repoData);
        repoData.project_intro = projectIntro;
        await this.saveCachedTranslation(cacheKey, projectIntro);
      }

      // 商业价值分析
      const analysis = await this.service.ai.analyzeBusinessValue(repoData);

      // 验证分析结果
      if (!analysis || !analysis.overall_score) {
        throw new Error('商业价值分析失败，无法保存项目');
      }

      // 保存到数据库
      const repoId = await this.saveRepository(repoData, analysis);

      return {
        success: true,
        data: {
          repository: repoData,
          analysis,
          db_ids: {
            repository: repoId,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Failed to analyze repository ${owner}/${repo}:`, error);
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
            const cached = await this.getCachedTranslation(repo.description);
            if (cached) {
              repo.description_cn = cached;
            } else {
              try {
                const translated = await this.service.ai.translateToChinese(repo.description);
                repo.description_cn = translated;
                await this.saveCachedTranslation(repo.description, translated);
              } catch (error) {
                this.logger.warn(`Translation failed for ${repo.full_name}:`, error);
                repo.description_cn = repo.description;
              }
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

      const allResults = [...dbResults, ...githubResults];

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
      const results = await this.app.mysql.query(sql, [limit, offset]);

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
   * @return {Promise<number>} 文章ID
   */
  async saveRepository(repoData, analysisData = null) {
    try {
      // 检查是否已存在
      const existing = await this.service.article.findByGitHubId(repoData.id);

      if (existing) {
        // 更新现有项目
        const result = await this.service.article.updateGitHubProject(
          existing.id,
          repoData,
          analysisData
        );
        return existing.id;
      } else {
        // 创建新的GitHub项目文章
        const result = await this.service.article.createGitHubProject(repoData, analysisData);
        return result.id;
      }
    } catch (error) {
      this.logger.error('Failed to save repository:', error);
      throw error;
    }
  }

  /**
   * 保存商业价值分析结果
   * @param {number} repoId - 仓库ID
   * @param {Object} analysis - 分析结果
   * @return {Promise<number>} 分析ID
   */
  async saveAnalysis(repoId, analysis) {
    try {
      // 计算总分
      const scores = Object.values(analysis.analysis || {}).map(item => item.score || 0);
      const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      const data = {
        article_id: repoId,
        analysis_type: 'business_value',
        analysis_data: JSON.stringify(analysis),
        overall_score: overallScore,
        ai_model: 'deepseek',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = await this.app.mysql.insert('analysis_results', data);
      return result.insertId;
    } catch (error) {
      this.logger.error('Failed to save analysis:', error);
      throw error;
    }
  }

  /**
   * 保存分析历史记录
   * @param {number} articleId - 文章ID
   * @param {string} analysisType - 分析类型
   * @param {Object} analysisData - 分析数据
   * @param {string} aiModel - AI模型
   * @param {string} prompt - 使用的提示词
   * @param {string} aiResponse - AI原始响应
   * @param {number} processingTime - 处理时间(毫秒)
   * @return {Promise<number>} 分析历史ID
   */
  async saveAnalysisHistory(articleId, analysisType, analysisData, aiModel, prompt, aiResponse, processingTime) {
    try {
      const data = {
        article_id: articleId,
        analysis_type: analysisType,
        ai_model: aiModel,
        prompt_used: prompt,
        ai_response: aiResponse,
        analysis_result: JSON.stringify(analysisData),
        processing_time_ms: processingTime,
        success: analysisData ? 1 : 0,
        error_message: analysisData ? null : 'Analysis failed',
        created_at: new Date(),
      };

      const result = await this.app.mysql.insert('analysis_history', data);
      return result.insertId;
    } catch (error) {
      this.logger.error('Failed to save analysis history:', error);
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

  /**
   * 异步触发商业价值分析
   * @param {string} fullName - GitHub项目全名 owner/repo
   * @param {number} repoId - 数据库中的项目ID
   */
  triggerBusinessAnalysis(fullName, repoId) {
    // 异步执行，不阻塞爬虫流程
    setTimeout(async () => {
      try {
        this.logger.info(`🤖 Starting AI analysis for ${fullName}...`);

        const [owner, repo] = fullName.split('/');

        // 获取项目详细信息
        const repoData = await this.service.github.getRepository(owner, repo);

        if (repoData.success) {
          // 进行AI商业价值分析
          const analysis = await this.service.ai.analyzeBusinessValue(repoData.data);

          if (analysis && analysis.overall_score) {
            // 保存分析结果
            await this.saveAnalysis(repoId, analysis);

            // 更新项目的综合评分
            await this.service.article.update(repoId, {
              overall_score: analysis.overall_score
            });

            this.logger.info(`✅ AI analysis completed for ${fullName}, score: ${analysis.overall_score}`);
          } else {
            this.logger.warn(`⚠️ AI analysis returned invalid data for ${fullName}`);
          }
        } else {
          this.logger.warn(`⚠️ Failed to get repository data for ${fullName}`);
        }
      } catch (error) {
        this.logger.error(`❌ AI analysis failed for ${fullName}:`, error.message);
      }
    }, 2000); // 延迟2秒执行，确保项目已保存
  }
}

module.exports = StarRankService;