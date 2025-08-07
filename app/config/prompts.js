/**
 * AI提示词配置文件 (兼容性入口)
 *
 * ⚠️ 注意：此文件已重构为模块化结构
 * 新的提示词文件位置：
 * - 翻译提示词: ./prompts/translation.js
 * - 商业价值分析: ./prompts/business-analysis.js
 * - 搜索建议: ./prompts/search-suggestions.js
 * - 技术评估: ./prompts/tech-evaluation.js
 *
 * 建议直接使用 require('./prompts') 导入所有配置
 */

// 导入模块化的提示词配置
const prompts = require('./prompts');

// 为了保持向后兼容，重新导出所有配置
module.exports = prompts;