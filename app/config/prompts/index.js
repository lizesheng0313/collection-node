/**
 * 提示词配置统一入口
 * 导出所有提示词相关的配置和函数
 */

const translation = require('./translation');
const businessAnalysis = require('./business-analysis');

module.exports = {
  // 项目介绍生成相关
  ...translation,

  // 商业价值分析相关
  ...businessAnalysis,
};