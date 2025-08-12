const { Service } = require('egg');

class ArticleService extends Service {
  /**
   * 创建文章（支持博客文章和GitHub项目）
   * @param {Object} article - 文章信息
   * @return {Promise<Object>} 结果
   */
  async create(article) {
    // 设置创建相关字段，默认为发布状态
    article.status = 'published';
    article.article_type = article.article_type || 'blog'; // 默认为博客类型
    article.collect_time = article.collect_time || new Date();
    article.update_time = new Date();
    article.publish_time = new Date();

    // 如果是GitHub项目类型，设置特殊的标题格式
    if (article.article_type === 'github_project' && article.github_full_name) {
      article.title = article.title || `GitHub项目: ${article.github_full_name}`;
    }

    const result = await this.app.mysql.insert('articles', article);
    return {
      success: result.affectedRows === 1,
      id: result.insertId,
    };
  }

  /**
   * 创建GitHub项目文章（简化版）
   * @param {Object} repoData - GitHub仓库数据
   * @param {Object} analysisData - 商业价值分析数据
   * @param {string} period - 热门周期
   * @return {Promise<Object>} 结果
   */
  async createGitHubProject(repoData, analysisData = null, period = null) {
    const article = {
      article_type: 'github_project',
      title: `GitHub项目: ${repoData.full_name}`,
      content: this.generateGitHubProjectContent(repoData, analysisData),

      // GitHub核心字段（id 可能为空，保留数值列语义；用 url 去重）
      github_id: typeof repoData.id === 'number' ? repoData.id : null,
      github_full_name: repoData.full_name,
      github_url: repoData.html_url,
      original_description: repoData.description,
      translated_description: repoData.description_cn,
      project_intro: repoData.project_intro,
      main_image: repoData.main_image,
      programming_language: repoData.language,
      // 兼容解析字段名：优先 stars_count，其次 stargazers_count
      stars_count: (repoData.stars_count ?? repoData.stargazers_count ?? 0),
      forks_count: repoData.forks_count,
      topics: (repoData.topics || []).join(','),

      // 分析相关字段
      overall_score: analysisData ? analysisData.overall_score : null,
      business_analysis: analysisData ? JSON.stringify(analysisData) : null,

      // 热门周期
      trending_period: period,
    };

    return await this.create(article);
  }

  /**
   * 更新文章
   * @param {Number} id - 文章ID
   * @param {Object} article - 文章信息
   * @return {Promise<Object>} 结果
   */
  async update(id, article) {
    // 设置更新相关字段
    article.update_time = new Date();
    if (article.status === 'published' && !article.publish_time) {
      article.publish_time = new Date();
    }

    const options = {
      where: { id },
    };

    const result = await this.app.mysql.update('articles', article, options);
    return {
      success: result.affectedRows === 1,
    };
  }

  /**
   * 删除文章
   * @param {Number} id - 文章ID
   * @return {Promise<Object>} 结果
   */
  async destroy(id) {
    const result = await this.app.mysql.delete('articles', { id });
    return {
      success: result.affectedRows === 1,
    };
  }

  /**
   * 查找单个文章
   * @param {Number} id - 文章ID
   * @param {Object} options - 附加选项
   * @return {Promise<Object>} 文章信息
   */
  async find(id, options = {}) {
    // 使用mapper中的SQL查询
    const article = await this.app.mysql.get('articles', { id });

    // 如果文章存在且发布，且不是禁止增加阅读量的请求，则增加阅读量
    if (article && article.status === 'published' && !options.no_read) {
      await this.app.mysql.query(this.app.mapper.article.increaseReadCount, [ id ]);
    }

    return article;
  }

  /**
   * 获取文章列表（分页，支持类型筛选）
   * @param {Number} page - 页码
   * @param {Number} pageSize - 每页条数
   * @param {Object} where - 筛选条件
   * @return {Promise<Object>} 分页结果
   */
  async list(page, pageSize, where = {}) {
    // 清除空查询条件
    Object.keys(where).forEach(key => {
      if (!where[key]) {
        delete where[key];
      }
    });

    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    // 构建查询条件
    const queryOptions = {
      where,
      orders: [[ 'collect_time', 'desc' ]],
      limit,
      offset,
    };

    // 获取总数和列表
    const [ total, list ] = await Promise.all([
      this.app.mysql.count('articles', where),
      this.app.mysql.select('articles', queryOptions),
    ]);

    // 格式化GitHub项目数据
    const formattedList = list.map(item => this.formatArticleData(item));

    return {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      list: formattedList,
    };
  }

  /**
   * 获取GitHub项目列表
   * @param {Number} page - 页码
   * @param {Number} pageSize - 每页条数
   * @param {Object} filters - 筛选条件
   * @return {Promise<Object>} 分页结果
   */
  async getGitHubProjects(page, pageSize, filters = {}) {
    const where = { article_type: 'github_project' };

    // 添加筛选条件
    if (filters.language) {
      where.programming_language = filters.language;
    }
    if (filters.min_stars) {
      where.stars_count = [ '>=', parseInt(filters.min_stars) ];
    }
    if (filters.trending_period) {
      where.trending_period = filters.trending_period;
    }

    return await this.list(page, pageSize, where);
  }

  /**
   * 根据GitHub URL查找项目
   * @param {String} githubUrl - GitHub仓库URL地址
   * @return {Promise<Object>} 项目信息
   */
  async findByGitHubId(githubUrl) {
    const article = await this.app.mysql.get('articles', {
      github_url: githubUrl,
      article_type: 'github_project',
    });
    return article ? this.formatArticleData(article) : null;
  }

  /**
   * 根据GitHub完整名称查找项目
   * @param {String} fullName - GitHub完整名称 (owner/repo)
   * @return {Promise<Object>} 项目信息
   */
  async findByGitHubFullName(fullName) {
    const article = await this.app.mysql.get('articles', {
      github_full_name: fullName,
      article_type: 'github_project',
    });

    return article ? this.formatArticleData(article) : null;
  }

  /**
   * 更新GitHub项目数据（简化版）
   * @param {Number} id - 文章ID
   * @param {Object} repoData - 更新的仓库数据
   * @param {Object} analysisData - 更新的分析数据
   * @param {string} period - 热门周期
   * @return {Promise<Object>} 结果
   */
  async updateGitHubProject(id, repoData, analysisData = null, period = null) {
    const updateData = {
      update_time: new Date(),
      stars_count: repoData.stars_count,
      forks_count: repoData.forks_count,
    };

    // 如果有翻译更新
    if (repoData.description_cn) {
      updateData.translated_description = repoData.description_cn;
    }

    // 如果有项目介绍更新
    if (repoData.project_intro) {
      updateData.project_intro = repoData.project_intro;
    }

    // 如果有分析数据更新
    if (analysisData) {
      updateData.overall_score = analysisData.overall_score;
      updateData.content = this.generateGitHubProjectContent(repoData, analysisData);
    }

    // 如果有热门周期更新
    if (period) {
      updateData.trending_period = period;
    }

    return await this.update(id, updateData);
  }
  /**
   * 生成GitHub项目的文章内容（简化版）
   * @param {Object} repoData - 仓库数据
   * @param {Object} analysisData - 分析数据
   * @return {String} 文章内容
   */
  generateGitHubProjectContent(repoData, analysisData = null) {
    let content = `# ${repoData.full_name}\n\n`;

    // 基本信息
    content += '## 📊 项目信息\n\n';
    content += `- **GitHub地址**: [${repoData.html_url}](${repoData.html_url})\n`;
    content += `- **编程语言**: ${repoData.language || '未知'}\n`;
    content += `- **Star数量**: ${repoData.stars_count || 0}\n`;
    content += `- **Fork数量**: ${repoData.forks_count || 0}\n\n`;

    // 项目描述
    if (repoData.description) {
      content += '## 📝 项目描述\n\n';
      content += `**原文**: ${repoData.description}\n\n`;
      if (repoData.description_cn) {
        content += `**中文**: ${repoData.description_cn}\n\n`;
      }
    }

    // 技术标签
    if (repoData.topics && repoData.topics.length > 0) {
      content += '## 🏷️ 技术标签\n\n';
      const topics = Array.isArray(repoData.topics) ? repoData.topics : repoData.topics.split(',');
      content += topics.map(topic => `\`${topic.trim()}\``).join(' ') + '\n\n';
    }

    // 商业价值分析
    if (analysisData && analysisData.overall_score) {
      content += '## 💼 商业价值分析\n\n';
      content += `**综合评分**: ${analysisData.overall_score}/10\n\n`;

      if (analysisData.summary) {
        content += `**分析总结**: ${analysisData.summary}\n\n`;
      }
    }

    content += '---\n\n';
    content += '*本文由AI自动生成和分析*';

    return content;
  }

  /**
   * 格式化文章数据（简化版）
   * @param {Object} article - 原始文章数据
   * @return {Object} 格式化后的数据
   */
  formatArticleData(article) {
    if (article.article_type === 'github_project') {
      // 解析topics字段
      if (article.topics && typeof article.topics === 'string') {
        article.topics = article.topics.split(',').map(t => t.trim()).filter(t => t);
      }

      // 解析business_analysis字段
      if (article.business_analysis && typeof article.business_analysis === 'string') {
        try {
          article.business_analysis = JSON.parse(article.business_analysis);
        } catch (e) {
          // 如果解析失败，保持原始字符串
          console.warn('Failed to parse business_analysis JSON:', e);
        }
      }

      // 添加GitHub信息便捷访问
      article.github_info = {
        id: article.github_id,
        full_name: article.github_full_name,
        url: article.github_url,
        language: article.programming_language,
        stars: article.stars_count,
        forks: article.forks_count,
        topics: article.topics || [],
        original_description: article.original_description,
        translated_description: article.translated_description,
      };

      // 添加分析信息
      if (article.overall_score) {
        article.analysis_info = {
          overall_score: article.overall_score,
        };
      }
    }

    return article;
  }
}

module.exports = ArticleService;
