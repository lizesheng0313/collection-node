/**
 * 翻译提示词
 * 用于将英文项目描述翻译成中文
 */

const PROJECT_INTRO_PROMPT = `
你是一个专业的技术项目分析师，请根据以下GitHub项目信息，生成一份完整的中文项目介绍。

项目信息：
项目名称: {name}
描述: {description}
主要语言: {language}
许可证: {license}
创建时间: {created_at}
最后更新: {updated_at}
主题标签: {topics}

请按以下结构生成项目介绍：

## 1. 基础信息
- **项目名称**: {name}（保持英文原名）
- **一句话简介**: [用项目自己的定位描述，说明它是什么、解决什么问题]
- **开发语言/核心技术栈**: [基于项目信息推断的技术栈]

## 2. 核心功能与价值
- **解决的问题**: [分析项目的应用场景和目标用户]
- **核心功能**: [根据描述和标签推断的主要功能点]
- **项目特色**: [与同类项目的可能差异和优势]

## 3. 如何使用
- **安装方式**: [根据语言推断常见的安装方法]
- **快速上手**: [提供基本的使用指导]
- **文档资源**: GitHub仓库及相关文档

## 4. 项目现状与生态
- **当前状态**: [根据Star数、Fork数、更新时间分析项目活跃度]
- **社区支持**: [基于数据分析社区活跃程度]
- **使用建议**: [根据项目成熟度给出使用建议]

## 5. 合规性信息
- **开源许可证**: {license}
- **注意事项**: [根据项目信息提醒可能的使用限制]

要求：
1. 语言专业、准确、自然流畅
2. 基于实际项目信息进行分析，不要编造具体功能
3. 技术术语使用标准中文表达
4. 突出项目的实用价值和应用场景
5. 保持客观中性的介绍风格
`;

/**
 * 格式化项目介绍提示词
 * @param {Object} projectData - 项目数据
 * @return {string} 格式化后的提示词
 */
function formatProjectIntroPrompt(projectData) {
  return PROJECT_INTRO_PROMPT
    .replace('{name}', projectData.name || '未知')
    .replace('{description}', projectData.description || '无描述')
    .replace('{language}', projectData.language || '未知')
    .replace('{stars}', projectData.stars_count || 0)
    .replace('{forks}', projectData.forks_count || 0)
    .replace('{issues}', projectData.open_issues_count || 0)
    .replace('{license}', projectData.license || '未知')
    .replace('{created_at}', projectData.created_at || '未知')
    .replace('{updated_at}', projectData.updated_at || '未知')
    .replace('{topics}', (projectData.topics || []).join(', ') || '无');
}

/**
 * 格式化简单翻译提示词（兼容旧接口）
 * @param {string} text - 要翻译的文本
 * @return {string} 格式化后的提示词
 */
function formatTranslationPrompt(text) {
  return `请将以下英文文本翻译成专业、准确的中文，保持技术术语的准确性：\n\n${text}\n\n要求：语言自然流畅，只返回翻译结果。`;
}

// 兼容性：保持旧的TRANSLATION_PROMPT导出
const TRANSLATION_PROMPT = `请将以下英文文本翻译成专业、准确的中文，保持技术术语的准确性：

{text}

要求：语言自然流畅，只返回翻译结果。`;

module.exports = {
  PROJECT_INTRO_PROMPT,
  TRANSLATION_PROMPT, // 兼容性导出
  formatProjectIntroPrompt,
  formatTranslationPrompt,
};