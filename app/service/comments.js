'use strict';

const Service = require('egg').Service;

class CommentsService extends Service {
  // 获取评论列表
  async getComments({ articleId, articleType, page = 1, pageSize = 10, sortBy = 'newest' }) {
    const { app } = this;
    
    // 构建排序条件
    let orderBy = [['created_at', 'desc']];
    switch (sortBy) {
      case 'oldest':
        orderBy = [['created_at', 'asc']];
        break;
      case 'likes':
        orderBy = [['like_count', 'desc'], ['created_at', 'desc']];
        break;
      default:
        orderBy = [['created_at', 'desc']];
    }

    const offset = (page - 1) * pageSize;

    try {
      // 获取评论列表（只获取顶级评论，不包括回复）
      const comments = await app.mysql.select('comments', {
        where: {
          article_id: articleId,
          article_type: articleType,
          parent_id: null,
          status: 1 // 只显示已通过的评论
        },
        orders: orderBy,
        limit: pageSize,
        offset
      });

      // 获取总数
      const total = await app.mysql.count('comments', {
        article_id: articleId,
        article_type: articleType,
        parent_id: null,
        status: 1
      });

      // 为每个评论获取回复数量
      for (const comment of comments) {
        const replyCount = await app.mysql.count('comments', {
          parent_id: comment.id,
          status: 1
        });
        comment.reply_count = replyCount;

        // 获取前3条回复作为预览
        if (replyCount > 0) {
          const replies = await app.mysql.select('comments', {
            where: {
              parent_id: comment.id,
              status: 1
            },
            orders: [['created_at', 'asc']],
            limit: 3
          });
          comment.replies = replies;
        } else {
          comment.replies = [];
        }
      }

      return {
        list: comments,
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total
      };
    } catch (error) {
      this.logger.error('获取评论列表失败:', error);
      throw error;
    }
  }

  // 创建评论
  async createComment({ articleId, articleType, nickname, email, content, parentId, ipAddress, userAgent }) {
    const { app } = this;

    try {
      // 检查是否是回复评论
      if (parentId) {
        const parentComment = await app.mysql.get('comments', { id: parentId });
        if (!parentComment) {
          throw new Error('父评论不存在');
        }
      }

      // 内容安全检查
      let status = 1; // 默认通过
      try {
        const secCheckResult = await this.ctx.service.wechat.msgSecCheck(content);
        if (!secCheckResult.pass) {
          if (secCheckResult.needReview) {
            status = 0; // 需要人工审核
            this.logger.warn('评论需要人工审核:', { content, reason: secCheckResult.message });
          } else {
            // 直接拒绝
            throw new Error('评论内容包含敏感信息，请修改后重试');
          }
        }
      } catch (secError) {
        this.logger.error('内容安全检查失败:', secError);
        // 如果是敏感内容错误，直接抛出
        if (secError.message.includes('敏感信息')) {
          throw secError;
        }
        // 其他错误则放行，避免影响用户体验
      }

      // 插入评论
      const result = await app.mysql.insert('comments', {
        article_id: articleId,
        article_type: articleType,
        parent_id: parentId,
        nickname,
        email,
        content,
        ip_address: ipAddress,
        user_agent: userAgent,
        status, // 根据安全检查结果设置状态
        like_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      // 返回创建的评论
      const comment = await app.mysql.get('comments', { id: result.insertId });

      // 如果需要审核，返回特殊消息
      if (status === 0) {
        comment._needReview = true;
      }

      return comment;
    } catch (error) {
      this.logger.error('创建评论失败:', error);
      throw error;
    }
  }

  // 点赞评论
  async likeComment({ commentId, ipAddress, userAgent }) {
    const { app } = this;

    try {
      // 检查评论是否存在
      const comment = await app.mysql.get('comments', { id: commentId });
      if (!comment) {
        throw new Error('评论不存在');
      }

      // 检查是否已经点赞过
      const existingLike = await app.mysql.get('comment_likes', {
        comment_id: commentId,
        ip_address: ipAddress
      });

      let action;
      let likeCount = comment.like_count || 0;

      if (existingLike) {
        // 已经点赞过，取消点赞
        await app.mysql.delete('comment_likes', {
          comment_id: commentId,
          ip_address: ipAddress
        });
        likeCount = Math.max(0, likeCount - 1);
        action = 'unlike';
      } else {
        // 没有点赞过，添加点赞
        await app.mysql.insert('comment_likes', {
          comment_id: commentId,
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: new Date()
        });
        likeCount = likeCount + 1;
        action = 'like';
      }

      // 更新评论的点赞数
      await app.mysql.update('comments', {
        like_count: likeCount,
        updated_at: new Date()
      }, {
        where: { id: commentId }
      });

      return {
        action,
        like_count: likeCount
      };
    } catch (error) {
      this.logger.error('点赞评论失败:', error);
      throw error;
    }
  }

  // 根据ID获取评论
  async getCommentById(id) {
    const { app } = this;

    try {
      const comment = await app.mysql.get('comments', { id });
      return comment;
    } catch (error) {
      this.logger.error('获取评论详情失败:', error);
      throw error;
    }
  }

  // 获取评论的回复列表
  async getCommentReplies({ commentId, page = 1, pageSize = 10 }) {
    const { app } = this;
    const offset = (page - 1) * pageSize;

    try {
      const replies = await app.mysql.select('comments', {
        where: {
          parent_id: commentId,
          status: 1
        },
        orders: [['created_at', 'asc']],
        limit: pageSize,
        offset
      });

      const total = await app.mysql.count('comments', {
        parent_id: commentId,
        status: 1
      });

      return {
        list: replies,
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total
      };
    } catch (error) {
      this.logger.error('获取评论回复失败:', error);
      throw error;
    }
  }

  // 删除评论（软删除，更新状态）
  async deleteComment(id) {
    const { app } = this;

    try {
      const result = await app.mysql.update('comments', {
        status: 2, // 2表示已删除
        updated_at: new Date()
      }, {
        where: { id }
      });

      return result.affectedRows > 0;
    } catch (error) {
      this.logger.error('删除评论失败:', error);
      throw error;
    }
  }

  // 审核评论
  async moderateComment(id, status) {
    const { app } = this;

    try {
      const result = await app.mysql.update('comments', {
        status, // 0-待审核，1-已通过，2-已拒绝
        updated_at: new Date()
      }, {
        where: { id }
      });

      return result.affectedRows > 0;
    } catch (error) {
      this.logger.error('审核评论失败:', error);
      throw error;
    }
  }
}

module.exports = CommentsService;
