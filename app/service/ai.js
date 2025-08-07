const { Service } = require('egg');
const { formatTranslationPrompt, formatProjectIntroPrompt } = require('../config/prompts/translation');
const { formatBusinessAnalysisPrompt, calculateBasicScore } = require('../config/prompts/business-analysis');

class AIService extends Service {
  constructor(ctx) {
    super(ctx);
    this.aiConfig = this.config.ai || {};
    this.currentModel = this.aiConfig.currentModel || 'openai';
    this.modelConfig = this.aiConfig.models?.[this.currentModel] || {};
  }

  /**
   * 翻译英文文本为中文
   * @param {string} text - 要翻译的英文文本
   * @return {Promise<string>} 翻译结果
   */
  async translateToChinese(text) {
    if (!text || !text.trim()) {
      return text;
    }

    try {
      const prompt = formatTranslationPrompt(text);
      const response = await this.callAIModel(prompt);
      const translated = response.trim();

      this.logger.info(`Translated: ${text.substring(0, 50)}... -> ${translated.substring(0, 50)}...`);
      return translated;
    } catch (error) {
      this.logger.error('Translation failed:', error);
      return text; // 翻译失败时返回原文
    }
  }

  /**
   * 生成项目介绍
   * @param {Object} projectData - 项目数据
   * @return {Promise<string>} 项目介绍
   */
  async generateProjectIntro(projectData) {
    if (!projectData) {
      return '项目信息不完整';
    }

    try {
      const prompt = formatProjectIntroPrompt(projectData);
      const response = await this.callAIModel(prompt);
      const intro = response.trim();

      this.logger.info(`Generated project intro for: ${projectData.name || 'unknown'}`);
      return intro;
    } catch (error) {
      this.logger.error('Project intro generation failed:', error);
      // 返回基础介绍
      return this.generateBasicIntro(projectData);
    }
  }

  /**
   * 生成基础项目介绍（AI失败时的备选方案）
   * @param {Object} projectData - 项目数据
   * @return {string} 基础介绍
   */
  generateBasicIntro(projectData) {
    const name = projectData.name || '未知项目';
    const description = projectData.description || '暂无描述';
    const language = projectData.language || '未知';
    const stars = projectData.stars_count || 0;
    const license = projectData.license || '未知';

    return `## ${name}

**项目简介**: ${description}

**技术栈**: ${language}
**社区热度**: ${stars} Stars
**开源许可**: ${license}

这是一个基于${language}开发的开源项目，在GitHub上获得了${stars}个Star，显示出一定的社区关注度。`;
  }

  /**
   * 分析项目的商业价值
   * @param {Object} repoData - 仓库数据
   * @return {Promise<Object>} 分析结果
   */
  async analyzeBusinessValue(repoData) {
    try {
      const prompt = formatBusinessAnalysisPrompt(repoData);
      const response = await this.callAIModel(prompt);

      // 尝试解析JSON响应
      try {
        const analysis = JSON.parse(response);
        this.logger.info(`Business analysis completed for ${repoData.full_name}`);
        return analysis;
      } catch (jsonError) {
        // 如果JSON解析失败，返回基础分析
        this.logger.warn(`Failed to parse AI response as JSON: ${response.substring(0, 200)}...`);
        return this.generateBasicAnalysis(repoData, response);
      }
    } catch (error) {
      this.logger.error('Business analysis failed:', error);
      return this.generateBasicAnalysis(repoData);
    }
  }

  /**
   * 调用AI模型API
   * @param {string} prompt - 提示词
   * @return {Promise<string>} AI响应
   */
  async callAIModel(prompt) {
    const { api_url, api_key, model } = this.modelConfig;

    if (!api_url || !api_key || !model) {
      throw new Error('AI model configuration is incomplete');
    }

    try {
      const payload = this.buildPayload(prompt);
      const headers = this.buildHeaders();

      const response = await this.ctx.curl(api_url, {
        method: 'POST',
        headers,
        data: payload,
        dataType: 'json',
        timeout: 120000, // 2分钟超时，商业分析需要更多时间
      });

      if (response.status !== 200) {
        throw new Error(`AI API error: ${response.status}`);
      }

      return this.parseResponse(response.data);
    } catch (error) {
      this.logger.error('AI model API call failed:', error);
      throw error;
    }
  }

  /**
   * 构建请求载荷
   * @param {string} prompt - 提示词
   * @return {Object} 请求载荷
   */
  buildPayload(prompt) {
    const { model } = this.modelConfig;

    switch (this.currentModel) {
      case 'claude':
        return {
          model,
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        };

      case 'qwen':
        return {
          model,
          input: {
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          },
          parameters: {
            temperature: 0.7,
            max_tokens: 2000,
          },
        };

      default:
        // OpenAI格式 (适用于OpenAI, Ollama, 智谱AI等)
        return {
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        };
    }
  }

  /**
   * 构建请求头
   * @return {Object} 请求头
   */
  buildHeaders() {
    const { api_key } = this.modelConfig;

    switch (this.currentModel) {
      case 'claude':
        return {
          'x-api-key': api_key,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        };

      case 'ollama':
        return {
          'Content-Type': 'application/json',
        };

      default:
        return {
          Authorization: `Bearer ${api_key}`,
          'Content-Type': 'application/json',
        };
    }
  }

  /**
   * 解析AI响应
   * @param {Object} data - 响应数据
   * @return {string} 解析后的内容
   */
  parseResponse(data) {
    switch (this.currentModel) {
      case 'claude':
        return data.content[0].text;

      case 'qwen':
        return data.output.choices[0].message.content;

      default:
        return data.choices[0].message.content;
    }
  }

  /**
   * 生成基础分析（当AI分析失败时的备选方案）
   * @param {Object} repoData - 仓库数据
   * @param {string} aiResponse - AI原始响应（可选）
   * @return {Object} 基础分析结果
   */
  generateBasicAnalysis(repoData, aiResponse = '') {
    const scores = calculateBasicScore(repoData);
    const { stars_count = 0, forks_count = 0 } = repoData;

    return {
      overall_score: scores.overall_score,
      analysis: {
        technical_value: {
          score: scores.tech_score,
          description: `基于${repoData.language || '未知'}语言和项目主题的技术评估`,
        },
        market_potential: {
          score: scores.market_score,
          description: `基于${stars_count}个star和${forks_count}个fork的市场热度评估`,
        },
        business_model: {
          score: 6,
          description: '需要进一步分析具体的商业模式',
        },
        risk_assessment: {
          score: 7,
          description: '开源项目的常规风险评估',
        },
        investment_value: {
          score: Math.round(scores.overall_score),
          description: '基于综合指标的投资价值评估',
        },
      },
      summary: `该项目在GitHub上有${stars_count}个star，显示出一定的技术价值和市场关注度。${aiResponse ? aiResponse.substring(0, 200) : ''}`,
      raw_ai_response: aiResponse || null,
    };
  }
}

module.exports = AIService;