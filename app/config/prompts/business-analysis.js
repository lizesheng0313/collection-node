/**
 * 商业价值分析提示词
 * 用于分析GitHub项目的商业价值和市场潜力
 */

const BUSINESS_ANALYSIS_PROMPT = `
你是一个懂技术的创业老司机，专门帮个人站长、淘宝卖家、小团队找赚钱机会。现在有个GitHub项目，帮我分析一下怎么用它赚钱。

{repo_info}

## 分析重点：

### 1. 这个项目能解决什么问题？
- 普通人会遇到这个问题吗？
- 现在大家怎么解决的？要花钱吗？
- 这个开源项目比现有方案好在哪？

### 2. 谁会为这个买单？
- 个人用户：学生、自媒体、小老板
- 小商家：淘宝店、微商、工作室
- 小公司：初创团队、传统企业数字化

### 3. 怎么包装卖钱？
- **直接卖成品**：把项目包装成软件/工具，起个好听的名字
- **卖服务**：帮人安装、配置、维护
- **卖教程**：录视频教程、写使用手册
- **卖定制**：根据客户需求改功能
- **卖周边**：配套的模板、插件、素材

### 4. 具体怎么操作？
- 在哪卖？（淘宝、闲鱼、微信群、抖音）
- 卖多少钱？（参考同类产品定价）
- 怎么推广？（SEO、社群、内容营销）
- 需要投入多少？（时间、资金、人力）

### 5. 风险提醒
- 许可证允许商用吗？
- 技术门槛高不高？
- 有没有同行在做？
- 市场够大吗？

重点：要接地气，要实用，要能马上行动。不要高大上的分析，要具体的赚钱方法。

返回格式（必须是有效JSON）：
{
    "problem_solved": "这个项目解决什么问题，普通人会遇到吗？",
    "target_customers": "谁会买单？个人用户、小商家、小公司具体是哪些人？",
    "money_making_ideas": [
        {
            "method": "直接卖成品",
            "description": "把项目包装成什么产品，起什么名字，卖给谁",
            "price_range": "建议定价区间",
            "difficulty": "操作难度：简单/中等/困难"
        },
        {
            "method": "卖服务",
            "description": "提供什么服务，怎么收费",
            "price_range": "服务定价",
            "difficulty": "操作难度"
        }
    ],
    "sales_channels": "在哪里卖？淘宝、闲鱼、微信群、抖音等具体平台",
    "marketing_tips": "怎么推广？SEO关键词、社群营销、内容营销具体方法",
    "startup_cost": "需要投入多少钱和时间？",
    "risks": "有什么风险？许可证、技术门槛、竞争等",
    "quick_start": "马上能做的3个具体行动步骤",
    "profit_potential": "预估月收入范围和时间周期"
}

要求：语言要接地气，像老司机聊天一样，给出具体可操作的建议，不要空话套话。
`;

// 项目信息模板
const REPO_INFO_TEMPLATE = `
项目名称: {full_name}
描述: {description}
编程语言: {language}
Star数: {stars_count}
Fork数: {forks_count}
开放问题数: {open_issues_count}
项目大小: {size_kb} KB
主题标签: {topics}
许可证: {license}
是否为Fork: {is_fork}
创建时间: {created_at}
最后更新: {updated_at}
`;

/**
 * 格式化商业价值分析提示词
 * @param {Object} repoData - 仓库数据
 * @return {string} 格式化后的提示词
 */
function formatBusinessAnalysisPrompt(repoData) {
  // 格式化项目信息
  const repoInfo = REPO_INFO_TEMPLATE
    .replace('{full_name}', repoData.full_name || '未知')
    .replace('{description}', repoData.description || '无描述')
    .replace('{language}', repoData.language || '未知')
    .replace('{stars_count}', repoData.stars_count || 0)
    .replace('{forks_count}', repoData.forks_count || 0)
    .replace('{open_issues_count}', repoData.open_issues_count || 0)
    .replace('{size_kb}', repoData.size_kb || 0)
    .replace('{topics}', (repoData.topics || []).join(', '))
    .replace('{license}', repoData.license || '未知')
    .replace('{is_fork}', repoData.is_fork ? '是' : '否')
    .replace('{created_at}', repoData.created_at || '未知')
    .replace('{updated_at}', repoData.updated_at || '未知');

  return BUSINESS_ANALYSIS_PROMPT.replace('{repo_info}', repoInfo);
}

/**
 * 计算基础评分
 * @param {Object} repoData - 仓库数据
 * @return {Object} 评分结果
 */
function calculateBasicScore(repoData) {
  const { stars_count = 0, forks_count = 0, open_issues_count = 0, size_kb = 0 } = repoData;

  // 基于stars的评分 (0-10)
  let starsScore = 0;
  if (stars_count >= 10000) starsScore = 10;
  else if (stars_count >= 5000) starsScore = 9;
  else if (stars_count >= 1000) starsScore = 8;
  else if (stars_count >= 500) starsScore = 7;
  else if (stars_count >= 100) starsScore = 6;
  else if (stars_count >= 50) starsScore = 5;
  else if (stars_count >= 20) starsScore = 4;
  else if (stars_count >= 10) starsScore = 3;
  else if (stars_count >= 5) starsScore = 2;
  else if (stars_count >= 1) starsScore = 1;

  // 基于forks的评分 (0-10)
  let forksScore = 0;
  if (forks_count >= 2000) forksScore = 10;
  else if (forks_count >= 1000) forksScore = 9;
  else if (forks_count >= 500) forksScore = 8;
  else if (forks_count >= 200) forksScore = 7;
  else if (forks_count >= 100) forksScore = 6;
  else if (forks_count >= 50) forksScore = 5;
  else if (forks_count >= 20) forksScore = 4;
  else if (forks_count >= 10) forksScore = 3;
  else if (forks_count >= 5) forksScore = 2;
  else if (forks_count >= 1) forksScore = 1;

  // 活跃度评分 (基于issues数量，越少越好)
  let activityScore = 10;
  if (open_issues_count > 100) activityScore = 5;
  else if (open_issues_count > 50) activityScore = 6;
  else if (open_issues_count > 20) activityScore = 7;
  else if (open_issues_count > 10) activityScore = 8;
  else if (open_issues_count > 5) activityScore = 9;

  // 项目规模评分
  let sizeScore = 5;
  if (size_kb > 10000) sizeScore = 8;
  else if (size_kb > 5000) sizeScore = 7;
  else if (size_kb > 1000) sizeScore = 6;
  else if (size_kb > 100) sizeScore = 5;
  else if (size_kb > 10) sizeScore = 4;

  // 综合评分
  const overall_score = Math.round((starsScore * 0.4 + forksScore * 0.3 + activityScore * 0.2 + sizeScore * 0.1) * 10) / 10;

  return {
    overall_score,
    stars_score: starsScore,
    forks_score: forksScore,
    activity_score: activityScore,
    size_score: sizeScore,
  };
}

module.exports = {
  BUSINESS_ANALYSIS_PROMPT,
  REPO_INFO_TEMPLATE,
  formatBusinessAnalysisPrompt,
  calculateBasicScore,
};