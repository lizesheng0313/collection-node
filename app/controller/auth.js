'use strict';

const Controller = require('egg').Controller;

class AuthController extends Controller {
  /**
   * 用户登录
   */
  async login() {
    const { ctx, service } = this;
    const { username, password } = ctx.request.body;

    // 参数校验
    if (!username || !password) {
      ctx.body = {
        code: 400,
        message: '用户名或密码不能为空',
      };
      return;
    }

    // 调用service登录
    const result = await service.user.login({ username, password });
    ctx.body = result;
  }

  /**
   * 获取用户信息
   */
  async info() {
    const { ctx, service } = this;
    const id = ctx.state.user.id;

    const result = await service.user.getUserInfo(id);
    ctx.body = result;
  }

  /**
   * 退出登录
   */
  async logout() {
    const { ctx } = this;
    // JWT认证是无状态的，前端只需要删除token即可
    // 这里只需要返回成功的消息
    ctx.body = {
      code: 200,
      message: '退出成功',
      data: null,
    };
  }
}

module.exports = AuthController; 