"use strict";
const baseConfig = require("../../config/basicConfig");
const Controller = require("egg").Controller;

const successMsg = (data) => {
  return {
    success: true,
    code: 0,
    message: "",
    data: data || null,
  };
};

const errorMsg = (message, code = 500) => {
  return {
    success: false,
    code,
    message,
    data: null,
  };
};

class MiniprogramController extends Controller {
  /**
   * 微信小程序登录，获取openid
   * POST /api/miniprogram/login
   */
  async login() {
    const { ctx, app } = this;
    const { code, source = 'weapp' } = ctx.request.body;

    if (!code) {
      ctx.body = errorMsg('code参数不能为空', 400);
      return;
    }

    try {
      const url = "https://api.weixin.qq.com/sns/jscode2session";
      
      // 配置化参数 - 需要在config中配置小程序的appid和secret
      const data = {
        appid: baseConfig[source]?.appid || process.env.WEAPP_APPID,
        secret: baseConfig[source]?.secret || process.env.WEAPP_SECRET,
        js_code: code,
        grant_type: "authorization_code",
      };

      // 换openid
      const result = await ctx.curl(url, {
        data,
        dataType: "json",
      });

      if (result.data.errcode) {
        ctx.body = errorMsg(result.data.errmsg || '微信登录失败', 401);
        return;
      }

      const { openid, unionid, session_key } = result.data;

      // 检查或创建用户
      await this.ensureUser(openid, unionid, source);

      // 获取用户信息
      const userInfo = await this.app.mysql.get("user", { openid });
      if (userInfo && userInfo.nickName) {
        userInfo.nickName = decodeURI(userInfo.nickName);
      }

      // 生成登录token
      const token = app.jwt.sign(
        { 
          openid,
          userId: userInfo.id,
          source 
        },
        app.config.jwt.secret
      );

      ctx.set({ authorization: token });
      ctx.body = successMsg({
        userInfo,
        openid,
        unionid,
        token,
        session_key // 注意：实际生产环境中不应该返回session_key
      });

    } catch (error) {
      ctx.logger.error('微信登录失败:', error);
      ctx.body = errorMsg('登录失败，请重试', 500);
    }
  }

  /**
   * 确保用户存在，不存在则创建
   */
  async ensureUser(openid, unionid, source) {
    const existingUser = await this.app.mysql.get("user", { openid });
    if (existingUser) {
      return existingUser;
    }

    // 创建新用户
    const userData = {
      openid,
      unionid,
      source,
      create_time: Date.now(),
      update_time: Date.now(),
    };

    const result = await this.app.mysql.insert("user", userData);
    return result;
  }

  /**
   * 更新用户信息
   * POST /api/miniprogram/updateUserInfo
   */
  async updateUserInfo() {
    const { ctx } = this;
    const userInfo = ctx.request.body;

    if (!ctx.state.user || !ctx.state.user.openid) {
      ctx.body = errorMsg('用户未登录', 401);
      return;
    }

    try {
      const updateData = {
        ...userInfo,
        update_time: Date.now(),
      };

      // 对昵称进行编码
      if (updateData.nickName) {
        updateData.nickName = encodeURI(updateData.nickName);
      }

      const result = await this.app.mysql.update("user", updateData, {
        where: { openid: ctx.state.user.openid }
      });

      if (result.affectedRows === 1) {
        ctx.body = successMsg();
      } else {
        ctx.body = errorMsg('更新失败');
      }
    } catch (error) {
      ctx.logger.error('更新用户信息失败:', error);
      ctx.body = errorMsg('更新失败，请重试');
    }
  }

  /**
   * 获取用户信息
   * GET /api/miniprogram/userInfo
   */
  async getUserInfo() {
    const { ctx } = this;

    if (!ctx.state.user || !ctx.state.user.openid) {
      ctx.body = errorMsg('用户未登录', 401);
      return;
    }

    try {
      const userInfo = await this.app.mysql.get("user", { 
        openid: ctx.state.user.openid 
      });

      if (!userInfo) {
        ctx.body = errorMsg('用户不存在', 404);
        return;
      }

      if (userInfo.nickName) {
        userInfo.nickName = decodeURI(userInfo.nickName);
      }

      ctx.body = successMsg(userInfo);
    } catch (error) {
      ctx.logger.error('获取用户信息失败:', error);
      ctx.body = errorMsg('获取用户信息失败');
    }
  }

  /**
   * 添加收藏
   * POST /api/miniprogram/addFavorite
   */
  async addFavorite() {
    const { ctx } = this;
    const { articleId, articleType } = ctx.request.body;

    if (!ctx.state.user || !ctx.state.user.userId) {
      ctx.body = errorMsg('用户未登录', 401);
      return;
    }

    if (!articleId || !articleType) {
      ctx.body = errorMsg('参数不完整', 400);
      return;
    }

    try {
      // 检查是否已收藏
      const existing = await this.app.mysql.get("user_favorites", {
        user_id: ctx.state.user.userId,
        article_id: articleId
      });

      if (existing) {
        ctx.body = errorMsg('已经收藏过了', 400);
        return;
      }

      // 添加收藏
      const favoriteData = {
        user_id: ctx.state.user.userId,
        article_id: articleId,
        article_type: articleType,
        create_time: Date.now()
      };

      await this.app.mysql.insert("user_favorites", favoriteData);
      ctx.body = successMsg();

    } catch (error) {
      ctx.logger.error('添加收藏失败:', error);
      ctx.body = errorMsg('收藏失败，请重试');
    }
  }

  /**
   * 取消收藏
   * POST /api/miniprogram/removeFavorite
   */
  async removeFavorite() {
    const { ctx } = this;
    const { articleId } = ctx.request.body;

    if (!ctx.state.user || !ctx.state.user.userId) {
      ctx.body = errorMsg('用户未登录', 401);
      return;
    }

    if (!articleId) {
      ctx.body = errorMsg('文章ID不能为空', 400);
      return;
    }

    try {
      const result = await this.app.mysql.delete("user_favorites", {
        user_id: ctx.state.user.userId,
        article_id: articleId
      });

      if (result.affectedRows > 0) {
        ctx.body = successMsg();
      } else {
        ctx.body = errorMsg('取消收藏失败，可能未收藏过该文章');
      }

    } catch (error) {
      ctx.logger.error('取消收藏失败:', error);
      ctx.body = errorMsg('取消收藏失败，请重试');
    }
  }

  /**
   * 获取收藏列表
   * GET /api/miniprogram/favorites
   */
  async getFavorites() {
    const { ctx } = this;
    const { page = 1, pageSize = 10, articleType } = ctx.query;

    if (!ctx.state.user || !ctx.state.user.userId) {
      ctx.body = errorMsg('用户未登录', 401);
      return;
    }

    try {
      const offset = (page - 1) * pageSize;
      let whereClause = `f.user_id = ${ctx.state.user.userId}`;
      
      if (articleType) {
        whereClause += ` AND f.article_type = '${articleType}'`;
      }

      // 查询收藏列表，关联文章表获取详细信息
      const sql = `
        SELECT 
          a.*,
          f.create_time as favorite_time
        FROM user_favorites f
        LEFT JOIN articles a ON f.article_id = a.id
        WHERE ${whereClause}
        ORDER BY f.create_time DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;

      const list = await this.app.mysql.query(sql);

      // 查询总数
      const countSql = `
        SELECT COUNT(*) as total
        FROM user_favorites f
        WHERE ${whereClause}
      `;
      const countResult = await this.app.mysql.query(countSql);
      const total = countResult[0].total;

      ctx.body = successMsg({
        list,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });

    } catch (error) {
      ctx.logger.error('获取收藏列表失败:', error);
      ctx.body = errorMsg('获取收藏列表失败');
    }
  }

  /**
   * 检查是否已收藏
   * GET /api/miniprogram/checkFavorite/:articleId
   */
  async checkFavorite() {
    const { ctx } = this;
    const { articleId } = ctx.params;

    if (!ctx.state.user || !ctx.state.user.userId) {
      ctx.body = successMsg({ isFavorited: false });
      return;
    }

    try {
      const favorite = await this.app.mysql.get("user_favorites", {
        user_id: ctx.state.user.userId,
        article_id: articleId
      });

      ctx.body = successMsg({ 
        isFavorited: !!favorite,
        favoriteTime: favorite ? favorite.create_time : null
      });

    } catch (error) {
      ctx.logger.error('检查收藏状态失败:', error);
      ctx.body = successMsg({ isFavorited: false });
    }
  }
}

module.exports = MiniprogramController;
