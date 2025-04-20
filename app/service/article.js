const { Service } = require('egg');

class ArticleService extends Service {
  /**
   * 创建文章
   * @param {Object} article - 文章信息
   * @return {Promise<Object>} 结果
   */
  async create(article) {
    // 设置创建相关字段
    article.collect_time = article.collect_time || new Date();
    article.update_time = new Date();
    article.publish_time = article.status === 'published' ? new Date() : null;

    const result = await this.app.mysql.insert('articles', article);
    return {
      success: result.affectedRows === 1,
      id: result.insertId,
    };
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
   * @return {Promise<Object>} 文章信息
   */
  async find(id) {
    // 使用mapper中的SQL查询
    const article = await this.app.mysql.get('articles', { id });
    
    // 如果文章存在且发布，增加阅读量
    if (article && article.status === 'published') {
      await this.app.mysql.query(this.app.mapper.article.increaseReadCount, [id]);
    }

    return article;
  }

  /**
   * 获取文章列表（分页）
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
      orders: [['collect_time', 'desc']],
      limit,
      offset,
    };

    // 获取总数和列表
    const [total, list] = await Promise.all([
      this.app.mysql.count('articles', where),
      this.app.mysql.select('articles', queryOptions),
    ]);

    return {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      list,
    };
  }
}

module.exports = ArticleService; 