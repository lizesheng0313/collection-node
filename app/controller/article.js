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
    
    const { page = 1, pageSize = 10, status, source } = ctx.query;
    try {
      const result = await service.article.list(page, pageSize, { status, source });
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
}

module.exports = ArticleController; 