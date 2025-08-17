'use strict';

const Controller = require('egg').Controller;

class CommentsController extends Controller {
  // 获取评论列表
  async index() {
    const { ctx } = this;
    const { articleId, articleType = 'github_project', page = 1, pageSize = 10, sortBy = 'newest' } = ctx.query;

    if (!articleId) {
      ctx.body = {
        success: false,
        message: '文章ID不能为空'
      };
      return;
    }

    try {
      const result = await ctx.service.comments.getComments({
        articleId: parseInt(articleId),
        articleType,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        sortBy
      });

      ctx.body = {
        success: true,
        data: result
      };
    } catch (error) {
      ctx.logger.error('获取评论列表失败:', error);
      ctx.body = {
        success: false,
        message: '获取评论列表失败'
      };
    }
  }

  // 提交评论
  async create() {
    const { ctx } = this;
    const { articleId, articleType = 'github_project', nickname, email, content, parentId } = ctx.request.body;

    // 参数验证
    if (!articleId || !nickname || !email || !content) {
      ctx.body = {
        success: false,
        message: '参数不完整'
      };
      return;
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      ctx.body = {
        success: false,
        message: '邮箱格式不正确'
      };
      return;
    }

    // 内容长度验证
    if (content.length > 1000) {
      ctx.body = {
        success: false,
        message: '评论内容不能超过1000字符'
      };
      return;
    }

    try {
      // 获取客户端IP和User-Agent
      const ipAddress = ctx.ip;
      const userAgent = ctx.get('User-Agent');

      const result = await ctx.service.comments.createComment({
        articleId: parseInt(articleId),
        articleType,
        nickname: nickname.trim(),
        email: email.trim(),
        content: content.trim(),
        parentId: parentId ? parseInt(parentId) : null,
        ipAddress,
        userAgent
      });

      // 根据审核状态返回不同消息
      let message = '评论发表成功';
      if (result._needReview) {
        message = '评论已提交，正在审核中';
      }

      ctx.body = {
        success: true,
        data: result,
        message
      };
    } catch (error) {
      ctx.logger.error('提交评论失败:', error);
      ctx.body = {
        success: false,
        message: '评论发表失败'
      };
    }
  }

  // 点赞评论
  async like() {
    const { ctx } = this;
    const { id } = ctx.params;

    if (!id) {
      ctx.body = {
        success: false,
        message: '评论ID不能为空'
      };
      return;
    }

    try {
      // 获取客户端IP
      const ipAddress = ctx.ip;
      const userAgent = ctx.get('User-Agent');

      const result = await ctx.service.comments.likeComment({
        commentId: parseInt(id),
        ipAddress,
        userAgent
      });

      ctx.body = {
        success: true,
        data: result,
        message: result.action === 'like' ? '点赞成功' : '取消点赞成功'
      };
    } catch (error) {
      ctx.logger.error('点赞评论失败:', error);
      ctx.body = {
        success: false,
        message: '操作失败'
      };
    }
  }

  // 获取评论详情
  async show() {
    const { ctx } = this;
    const { id } = ctx.params;

    if (!id) {
      ctx.body = {
        success: false,
        message: '评论ID不能为空'
      };
      return;
    }

    try {
      const result = await ctx.service.comments.getCommentById(parseInt(id));

      if (!result) {
        ctx.body = {
          success: false,
          message: '评论不存在'
        };
        return;
      }

      ctx.body = {
        success: true,
        data: result
      };
    } catch (error) {
      ctx.logger.error('获取评论详情失败:', error);
      ctx.body = {
        success: false,
        message: '获取评论详情失败'
      };
    }
  }

  // 回复评论
  async reply() {
    const { ctx } = this;
    const { id } = ctx.params;
    const { nickname, email, content } = ctx.request.body;

    // 参数验证
    if (!id || !nickname || !email || !content) {
      ctx.body = {
        success: false,
        message: '参数不完整'
      };
      return;
    }

    try {
      // 先获取父评论信息
      const parentComment = await ctx.service.comments.getCommentById(parseInt(id));
      if (!parentComment) {
        ctx.body = {
          success: false,
          message: '父评论不存在'
        };
        return;
      }

      // 获取客户端IP和User-Agent
      const ipAddress = ctx.ip;
      const userAgent = ctx.get('User-Agent');

      const result = await ctx.service.comments.createComment({
        articleId: parentComment.article_id,
        articleType: parentComment.article_type,
        nickname: nickname.trim(),
        email: email.trim(),
        content: content.trim(),
        parentId: parseInt(id),
        ipAddress,
        userAgent
      });

      ctx.body = {
        success: true,
        data: result,
        message: '回复成功'
      };
    } catch (error) {
      ctx.logger.error('回复评论失败:', error);
      ctx.body = {
        success: false,
        message: '回复失败'
      };
    }
  }
}

module.exports = CommentsController;
