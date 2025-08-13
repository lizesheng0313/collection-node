# Collection Node - AI驱动的GitHub项目分析平台

> 智能发现GitHub热门项目，AI翻译项目描述，深度分析商业价值

## ✨ 核心功能

### 🔍 项目发现
- **GitHub Trending**: 自动抓取每日/每周/每月热门项目
- **智能搜索**: 支持项目名称、描述、编程语言搜索
- **分类筛选**: 按编程语言、Star数量、评分筛选

### 🤖 AI智能分析
- **智能翻译**: 自动将英文项目描述翻译成中文
- **商业价值评估**: AI分析项目的商业潜力和投资价值
- **技术评分**: 基于多维度的项目技术价值评估
- **翻译缓存**: 避免重复翻译，提升响应速度

### 📚 内容管理
- **统一管理**: 博客文章和GitHub项目统一管理
- **专业内容**: 每个项目生成专业的分析文章
- **数据统计**: 编程语言分布、评分统计等数据洞察

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 数据库配置
复制 `sql/1.0.0/github.sql` 中的SQL语句到你的MySQL数据库执行

### 3. 配置文件
AI模型已配置为你的自定义模型：
```javascript
// config/config.default.js 中已配置
config.ai = {
  currentModel: 'custom',
  models: {
  }
}
```

### 4. 启动服务
```bash
npm run dev
```

### 5. 访问测试
- 服务地址: http://localhost:7001
- GitHub项目列表: http://localhost:7001/api/articles/github
- 热门项目: http://localhost:7001/api/github/trending

## 📡 API 接口文档

### 🔥 GitHub项目接口

#### 热门项目发现
```http
GET /api/github/trending?period=daily&language=javascript&page=1&limit=25
```

#### 项目搜索
```http
GET /api/github/search?q=react&page=1&limit=25&sort=stars&order=desc
```

#### 项目详情获取
```http
GET /api/github/repos/facebook/react
```

#### 搜索建议
```http
GET /api/github/suggestions?q=web
```

### 🧠 AI分析接口

#### 商业价值分析
```http
GET /api/analysis/facebook/react
```

#### 智能翻译
```http
POST /api/analysis/translate
Content-Type: application/json

{
  "text": "A modern web framework for building user interfaces"
}
```

#### 批量翻译
```http
POST /api/analysis/translate/batch
Content-Type: application/json

{
  "texts": ["Hello World", "Machine Learning", "Data Science"]
}
```

#### 分析历史
```http
GET /api/analysis/history?page=1&limit=20&owner=facebook&repo=react
```

### 📚 文章管理接口

#### 统一文章列表
```http
GET /api/articles/list?article_type=github_project&page=1&pageSize=20
```

#### GitHub项目列表
```http
GET /api/articles/github?language=javascript&min_stars=1000&trending_period=daily
```

#### GitHub项目详情
```http
GET /api/articles/github/facebook/react
```

#### 编程语言统计
```http
GET /api/articles/github/languages
```

#### 评分分布统计
```http
GET /api/articles/github/scores
```

### 🔐 认证接口

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

#### 用户信息
```http
GET /api/auth/info
Authorization: Bearer <token>
```

## 配置说明

### AI模型配置

在 `config/config.default.js` 中可以配置多个AI模型：

```javascript
config.ai = {
  currentModel: 'openai', // 当前使用的模型
  models: {
    openai: {
      api_url: 'https://api.openai.com/v1/chat/completions',
      api_key: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
    },
    // 其他模型配置...
  },
};
```

### GitHub配置

```javascript
config.github = {
  token: process.env.GITHUB_TOKEN, // GitHub API Token
};
```

## 数据库表结构

新增的数据库表：

- `github_repositories`: GitHub项目信息
- `github_analysis`: 商业价值分析结果
- `translation_cache`: 翻译缓存
- `github_trending_snapshots`: 热门项目快照
- `ai_model_configs`: AI模型配置

## 部署

```bash
npm start
npm stop
```

## 开发

```bash
npm run dev
```

## 测试

```bash
npm test
```

## 许可证

MIT License

---

⭐ 如果这个项目对你有帮助，请给我们一个 Star！
