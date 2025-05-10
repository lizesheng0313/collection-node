'use strict';

const Service = require('egg').Service;

class UserService extends Service {
  /**
   * 根据用户名查找用户
   * @param {string} username - 用户名
   * @return {Promise<Object>} 用户信息
   */
  async findByUsername(username) {
    return await this.app.mysql.get('users', { username });
  }

  /**
   * 生成JWT Token
   * @param {Object} user - 用户信息
   * @return {string} JWT Token
   */
  generateToken(user) {
    const { app } = this;
    const token = app.jwt.sign({
      id: user.id,
      username: user.username,
    }, app.config.jwt.secret, {
      expiresIn: app.config.jwt.expiresIn,
    });
    return token;
  }

  /**
   * 用户登录
   * @param {Object} loginInfo - 登录信息
   * @return {Promise<Object>} 登录结果
   */
  async login(loginInfo) {
    const { ctx, app } = this;
    const { username, password } = loginInfo;

    // 查找用户
    const user = await this.findByUsername(username);
    if (!user) {
      ctx.status = 401;
      return {
        code: 401,
        message: '用户名或密码错误',
      };
    }

    // 验证密码 - 前端已经对密码进行了MD5加密，直接比对即可
    if (password !== user.password) {
      ctx.status = 401;
      return {
        code: 401,
        message: '用户名或密码错误',
      };
    }

    // 生成token
    const token = this.generateToken(user);

    // 返回登录成功信息
    return {
      code: 200,
      message: '登录成功',
      data: {
        token,
        userInfo: {
          id: user.id,
          username: user.username,
          avatar: user.avatar || '',
          nickname: user.nickname || user.username,
          email: user.email || '',
        },
      },
    };
  }

  /**
   * 获取用户信息
   * @param {number} id - 用户ID
   * @return {Promise<Object>} 用户信息
   */
  async getUserInfo(id) {
    const user = await this.app.mysql.get('users', { id });
    if (!user) {
      return {
        code: 404,
        message: '用户不存在',
      };
    }

    return {
      code: 200,
      message: '获取成功',
      data: {
        id: user.id,
        username: user.username,
        avatar: user.avatar || '',
        nickname: user.nickname || user.username,
        email: user.email || '',
        roles: user.roles ? user.roles.split(',') : ['user'],
      },
    };
  }
}

module.exports = UserService; 