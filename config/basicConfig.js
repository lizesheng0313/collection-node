module.exports = {
  // 微信小程序配置
  weapp: {
    appid: process.env.WEAPP_APPID || 'wxee8812cef3046b13',
    secret: process.env.WEAPP_SECRET || '974fef81821aed434b59b664619cd2fa',
  },
  
  // 支付宝小程序配置
  alipay: {
    appid: process.env.ALIPAY_APPID || 'your_alipay_appid',
    secret: process.env.ALIPAY_SECRET || 'your_alipay_secret',
  }
};
