const { Service } = require('egg');
const jaison = require('jaison');
const { formatTranslationPrompt, formatProjectIntroPrompt } = require('../config/prompts/translation');
const { formatBusinessAnalysisPrompt } = require('../config/prompts/business-analysis');

class AIService extends Service {
  constructor(ctx) {
    super(ctx);
    this.aiConfig = this.config.ai || {};
    this.currentModel = this.aiConfig.currentModel || 'openai';
    this.modelConfig = this.aiConfig.models?.[this.currentModel] || {};
  }

  async translateToChinese(text, projectData = null) {
    if (!text || !text.trim()) return text;
    try {
      const prompt = formatTranslationPrompt(text, projectData);
      const response = await this.callAIModel(prompt);
      const translated = response.trim();
      this.logger.debug(`翻译完成: ${text.substring(0, 30)} -> ${translated.substring(0, 30)}`);
      return translated;
    } catch (error) {
      this.logger.warn('翻译失败，使用原文', error.message);
      return text;
    }
  }

  async generateProjectIntro(projectData) {
    if (!projectData) return '项目信息不完整';
    try {
      const prompt = formatProjectIntroPrompt(projectData);
      const response = await this.callAIModel(prompt);
      const intro = response.trim();
      this.logger.debug(`已生成项目介绍: ${projectData.name || 'unknown'}`);
      return intro;
    } catch (error) {
      this.logger.error('生成项目介绍失败', error.message);
      throw new Error(`项目介绍生成失败: ${error.message}`);
    }
  }

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

  async analyzeBusinessValue(repoData) {
    try {
      // 第一次：严格要求仅返回 JSON
      const basePrompt = formatBusinessAnalysisPrompt(repoData);
      const strictInstruction = '\n\n请仅返回严格的 JSON（UTF-8），不要包含任何解释、Markdown、反引号、前后缀或多余文本。';
      const prompt1 = `${basePrompt}${strictInstruction}`;

      const response1 = await this.callAIModel(prompt1, { forceJson: true });
      let parsed1 = this.parseWithJaison(response1);
      if (parsed1 && parsed1.overall_score) {
        parsed1 = this.applyBusinessHeuristics(repoData, parsed1);
        this.logger.debug(`商业分析完成：${repoData.full_name}`);
        return parsed1;
      }

      // 第二次重试：提供明确结构约束
      const schemaHint = `\n\n仅输出如下结构的 JSON（不要代码块、不要反引号、不要多余字段）：\n{
  "overall_score": number, // 0-10，可带小数
  "analysis": {
    "technical_value": { "score": number, "description": string },
    "market_potential": { "score": number, "description": string },
    "business_model": { "score": number, "description": string },
    "risk_assessment": { "score": number, "description": string },
    "investment_value": { "score": number, "description": string }
  },
  "summary": string
}`;
      const prompt2 = `${basePrompt}${schemaHint}\n\n现在仅输出 JSON。`;

      const response2 = await this.callAIModel(prompt2, { forceJson: true });
      let parsed2 = this.parseWithJaison(response2);
      if (parsed2 && parsed2.overall_score) {
        parsed2 = this.applyBusinessHeuristics(repoData, parsed2);
        this.logger.debug(`商业分析完成（重试成功）：${repoData.full_name}`);
        return parsed2;
      }

      // 仍失败，直接抛出错误，不回退
      this.logger.error('AI 响应JSON解析失败（重试后仍失败）');
      this.logger.error('AI响应1:', response1 ? response1.substring(0, 500) : 'null');
      this.logger.error('AI响应2:', response2 ? response2.substring(0, 500) : 'null');
      throw new Error('AI商业分析失败：无法解析JSON响应，重试后仍失败');
    } catch (error) {
      this.logger.error('商业分析失败，详细错误:', error.message);
      this.logger.error('错误堆栈:', error.stack);
      throw new Error(`AI商业分析失败: ${error.message}`);
    }
  }

  async callAIModel(prompt, options = {}) {
    const { api_url, api_key, model } = this.modelConfig;
    const { forceJson = false, maxRetries = 2 } = options;
    if (!api_url || !api_key || !model) {
      throw new Error('AI 模型配置不完整');
    }

    // 重试逻辑
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const startTime = Date.now();

      try {
        return await this._makeAIRequest(prompt, { api_url, api_key, model, forceJson, startTime, attempt });
      } catch (error) {
        const isLastAttempt = attempt === maxRetries + 1;

        if (isLastAttempt) {
          throw error;
        }

        this.logger.warn(`AI调用失败，第${attempt}次重试: ${error.message}`);
        // 重试前等待 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  async _makeAIRequest(prompt, { api_url, api_key, model, forceJson, startTime, attempt }) {
    try {
      // 直接在这里构建 payload
      let payload;
      switch (this.currentModel) {
        case 'claude':
          payload = { model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] };
          break;
        case 'qwen':
          payload = { model, input: { messages: [{ role: 'user', content: prompt }] }, parameters: { temperature: 0.7, max_tokens: 2000 } };
          break;
        default:
          // OpenAI/DeepSeek 等兼容格式
          payload = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 2000 };
      }

      if (forceJson && this.currentModel !== 'claude' && this.currentModel !== 'qwen') {
        payload.response_format = { type: 'json_object' };
      }

      // 直接在这里构建 headers
      let headers;
      switch (this.currentModel) {
        case 'claude':
          headers = { 'x-api-key': api_key, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
          break;
        case 'ollama':
          headers = { 'Content-Type': 'application/json' };
          break;
        default:
          headers = { Authorization: `Bearer ${api_key}`, 'Content-Type': 'application/json' };
      }

      const response = await this.ctx.curl(api_url, {
        method: 'POST',
        headers,
        data: payload,
        dataType: 'json',
        timeout: 180000, // 3分钟超时
      });
      if (response.status !== 200) {
        this.logger.error(`AI 接口HTTP错误: ${response.status}`);
        this.logger.error('响应内容:', response.data);
        throw new Error(`AI 接口HTTP错误: ${response.status}`);
      }

      const result = this.parseResponse(response.data);
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (duration > 30000) {
        this.logger.warn(`AI调用耗时过长: ${duration}ms, 模型: ${model}, 尝试次数: ${attempt}`);
      } else {
        this.logger.debug(`AI调用成功: ${duration}ms, 模型: ${model}, 尝试次数: ${attempt}`);
      }

      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger.error('AI 接口调用失败：');
      this.logger.error(`  模型: ${model}`);
      this.logger.error(`  API地址: ${api_url}`);
      this.logger.error(`  耗时: ${duration}ms`);
      this.logger.error(`  错误类型: ${error.name || 'Unknown'}`);
      this.logger.error(`  错误信息: ${error.message}`);

      if (error.code) {
        this.logger.error(`  错误代码: ${error.code}`);
      }

      if (error.status) {
        this.logger.error(`  HTTP状态: ${error.status}`);
      }

      throw new Error(`AI接口调用失败: ${error.message}`);
    }
  }

  parseWithJaison(raw) {
    if (!raw) return null;
    try {
      return jaison(String(raw));
    } catch (e) {
      this.logger.warn('jaison 解析失败', e.message);
      return null;
    }
  }

  // 简单启发式：破解/授权码降分；纯技术类弱商业性，略降分并更新 summary
  applyBusinessHeuristics(repoData, analysis) {
    const text = `${repoData.name || ''} ${repoData.full_name || ''} ${repoData.description || ''}`.toLowerCase();
    const cnText = `${repoData.description_cn || ''}`;
    const hitCrack = /crack|license key|serial|activation|破解|授权码|注册码|激活码|补丁/.test(text) || /破解|授权码|注册码|激活码|补丁/.test(cnText);
    const pureTech = /sdk|framework|lib|library|driver|algorithm|算法|内核|驱动|编译器|协议|规范|中间件/.test(text + cnText);

    const result = { ...analysis };
    let score = Number(result.overall_score) || 0;

    if (hitCrack) {
      score = Math.max(0, Math.min(10, score - 3));
      result.summary = `${result.summary || ''}\n注意：该项目疑似涉及破解/授权码相关，商业合规性较差，不建议商用。`;
    }

    if (pureTech) {
      score = Math.max(0, Math.min(10, score - 1));
      result.summary = `${result.summary || ''}\n该项目偏纯技术基础设施，直接商业化难度较高，更适合作为技术组件或内部能力。`;
    }

    result.overall_score = score;
    return result;
  }

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

  // generateBasicAnalysis 方法已删除 - 不再使用回退逻辑

  // 已内联 payload/headers 构建，删除辅助方法
}

module.exports = AIService;
