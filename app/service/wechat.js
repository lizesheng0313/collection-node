'use strict';

const Service = require('egg').Service;

class WechatService extends Service {
  // 获取Access Token
  async getAccessToken() {
    const { app, config } = this;
    const appId = config.miniprogram?.appId;

    if (!appId) {
      throw new Error('微信小程序AppID未配置');
    }

    try {
      // 先从数据库查询是否有有效的token
      const tokenRecord = await app.mysql.get('wechat_access_tokens', { app_id: appId });
      
      if (tokenRecord && new Date(tokenRecord.expires_at) > new Date()) {
        // token还未过期，直接返回
        return tokenRecord.access_token;
      }

      // token不存在或已过期，重新获取
      const newToken = await this.fetchAccessTokenFromWechat();
      
      if (newToken) {
        // 保存到数据库
        await this.saveAccessToken(appId, newToken);
        return newToken.access_token;
      }

      throw new Error('获取Access Token失败');
    } catch (error) {
      this.logger.error('获取Access Token失败:', error);
      throw error;
    }
  }

  // 从微信服务器获取Access Token
  async fetchAccessTokenFromWechat() {
    const { config } = this;
    const { appId, appSecret } = config.miniprogram;

    try {
      const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
      
      const response = await this.ctx.curl(url, {
        method: 'GET',
        dataType: 'json',
        timeout: 10000
      });

      if (response.status === 200 && response.data.access_token) {
        return {
          access_token: response.data.access_token,
          expires_in: response.data.expires_in || 7200
        };
      } else {
        this.logger.error('微信API返回错误:', response.data);
        throw new Error(response.data.errmsg || '获取Access Token失败');
      }
    } catch (error) {
      this.logger.error('请求微信API失败:', error);
      throw error;
    }
  }

  // 保存Access Token到数据库
  async saveAccessToken(appId, tokenData) {
    const { app } = this;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in - 300) * 1000); // 提前5分钟过期

    try {
      // 使用REPLACE INTO或者先删除再插入
      await app.mysql.delete('wechat_access_tokens', { app_id: appId });
      
      await app.mysql.insert('wechat_access_tokens', {
        app_id: appId,
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        expires_at: expiresAt,
        created_at: new Date(),
        updated_at: new Date()
      });

      this.logger.info(`Access Token已保存，过期时间: ${expiresAt}`);
    } catch (error) {
      this.logger.error('保存Access Token失败:', error);
      throw error;
    }
  }

  // 内容安全检查
  async msgSecCheck(content) {
    const { config } = this;

    // 如果没有配置微信小程序信息，跳过安全检查
    if (!config.miniprogram?.appId || !config.miniprogram?.appSecret) {
      this.logger.warn('微信小程序配置不完整，跳过内容安全检查');
      return { pass: true, message: '未配置内容安全检查，内容已放行' };
    }

    try {
      const accessToken = await this.getAccessToken();
      const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`;

      const response = await this.ctx.curl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          content: content,
          version: 2,
          scene: 1, // 1-资料；2-评论；3-论坛；4-社交日志
          openid: 'test_openid' // 可以传入用户的openid
        },
        dataType: 'json',
        timeout: 10000
      });

      if (response.status === 200) {
        const { errcode, errmsg, result } = response.data;
        
        if (errcode === 0) {
          // 检查通过
          if (result && result.suggest === 'pass') {
            return { pass: true, message: '内容检查通过' };
          } else if (result && result.suggest === 'review') {
            return { pass: false, message: '内容需要人工审核', needReview: true };
          } else {
            return { pass: false, message: '内容包含敏感信息' };
          }
        } else {
          this.logger.error('内容安全检查API返回错误:', { errcode, errmsg });
          // API调用失败时，为了不影响用户体验，可以选择放行
          return { pass: true, message: '安全检查服务暂时不可用，内容已放行' };
        }
      } else {
        throw new Error('内容安全检查请求失败');
      }
    } catch (error) {
      this.logger.error('内容安全检查失败:', error);
      // 出错时放行，避免影响用户体验
      return { pass: true, message: '安全检查服务异常，内容已放行' };
    }
  }

  // 刷新Access Token（定时任务用）
  async refreshAccessToken() {
    const { app, config } = this;
    const appId = config.miniprogram.appId;

    try {
      this.logger.info('开始刷新Access Token...');
      
      const newToken = await this.fetchAccessTokenFromWechat();
      if (newToken) {
        await this.saveAccessToken(appId, newToken);
        this.logger.info('Access Token刷新成功');
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('刷新Access Token失败:', error);
      return false;
    }
  }

  // 清理过期的Access Token
  async cleanExpiredTokens() {
    const { app } = this;
    
    try {
      const result = await app.mysql.delete('wechat_access_tokens', {
        expires_at: app.mysql.literals.now
      });
      
      if (result.affectedRows > 0) {
        this.logger.info(`清理了 ${result.affectedRows} 个过期的Access Token`);
      }
      
      return result.affectedRows;
    } catch (error) {
      this.logger.error('清理过期Token失败:', error);
      return 0;
    }
  }
}

module.exports = WechatService;
