const { Service } = require('egg');

class GitHubService extends Service {
  constructor(ctx) {
    super(ctx);
    this.baseURL = 'https://api.github.com';
    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'StarRank-Collection-Node',
    };

    // 如果配置了GitHub Token，添加到请求头
    if (this.config.github && this.config.github.token) {
      this.headers.Authorization = `token ${this.config.github.token}`;
    }
  }

  /**
   * 获取GitHub Trending项目
   * @param {Object} options - 查询选项
   * @param {string} options.period - 时间周期: daily, weekly, monthly
   * @param {string} options.language - 编程语言
   * @param {number} options.page - 页码
   * @param {number} options.limit - 每页数量
   * @return {Promise<Array>} 项目列表
   */
  async getTrendingRepositories(options = {}) {
    const { period = 'daily', language, page = 1, limit = 25 } = options;

    try {
      // 构建GitHub Trending URL
      let trendingUrl = `https://github.com/trending`;

      if (language) {
        trendingUrl += `/${language}`;
      }

      // 添加时间周期参数
      const params = new URLSearchParams();
      if (period && period !== 'daily') {
        params.append('since', period);
      }

      if (params.toString()) {
        trendingUrl += `?${params.toString()}`;
      }

      this.logger.info(`🔥 Fetching GitHub Trending: ${trendingUrl}`);

      // 爬取GitHub Trending页面
      const response = await this.ctx.curl(trendingUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      });

      if (response.status !== 200) {
        throw new Error(`GitHub Trending page error: ${response.status}`);
      }

      // 解析HTML页面，提取项目信息
      const repositories = this.parseTrendingPage(response.data.toString());

      // 限制返回数量
      const limitedRepos = repositories.slice(0, limit);

      // 获取每个项目的详细信息
      const detailedRepos = [];
      for (const repo of limitedRepos) {
        try {
          const [owner, name] = repo.full_name.split('/');
          const detailRepo = await this.getRepositoryDetails(owner, name);
          if (detailRepo) {
            detailedRepos.push(detailRepo);
          } else {
            // 如果获取详情失败，使用基本信息
            detailedRepos.push(repo);
          }
          // 避免API限制，稍微延迟
          await this.sleep(200);
        } catch (error) {
          this.logger.warn(`Failed to get details for ${repo.full_name}:`, error.message);
          // 如果获取详情失败，使用基本信息
          detailedRepos.push(repo);
        }
      }

      return detailedRepos;

    } catch (error) {
      this.logger.error('Failed to fetch trending repositories:', error);
      throw error;
    }
  }

  /**
   * 获取仓库详细信息
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @return {Promise<Object>} 仓库详细信息
   */
  async getRepositoryDetails(owner, repo) {
    try {
      const url = `${this.baseURL}/repos/${owner}/${repo}`;

      const response = await this.ctx.curl(url, {
        method: 'GET',
        headers: this.headers,
        dataType: 'json',
        timeout: 30000,
      });

      if (response.status !== 200) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const repoData = this.formatRepositoryData(response.data);

      // 获取README中的第一张图片
      try {
        const mainImage = await this.getRepositoryMainImage(owner, repo);
        if (mainImage) {
          repoData.main_image = mainImage;
        }
      } catch (error) {
        this.logger.warn(`Failed to get main image for ${owner}/${repo}:`, error.message);
        // 使用默认图片
        repoData.main_image = this.getDefaultImage(repoData.language);
      }

      return repoData;

    } catch (error) {
      this.logger.error(`Failed to fetch repository details for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * 搜索GitHub仓库
   * @param {string} query - 搜索关键词
   * @param {Object} options - 搜索选项
   * @return {Promise<Array>} 搜索结果
   */
  async searchRepositories(query, options = {}) {
    const { page = 1, limit = 25, sort = 'stars', order = 'desc' } = options;

    try {
      const searchUrl = `${this.baseURL}/search/repositories`;
      const params = {
        q: query,
        sort,
        order,
        page,
        per_page: Math.min(limit, 100),
      };

      const response = await this.ctx.curl(searchUrl, {
        method: 'GET',
        headers: this.headers,
        data: params,
        dataType: 'json',
        timeout: 30000,
      });

      if (response.status !== 200) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const repositories = response.data.items || [];
      return repositories.map(repo => this.formatRepositoryData(repo));

    } catch (error) {
      this.logger.error('Failed to search repositories:', error);
      throw error;
    }
  }

  /**
   * 格式化仓库数据
   * @param {Object} repo - GitHub API返回的仓库数据
   * @return {Object} 格式化后的数据
   */
  formatRepositoryData(repo) {
    return {
      id: repo.id,
      full_name: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      description: repo.description,
      language: repo.language,
      stars_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      watchers_count: repo.watchers_count,
      open_issues_count: repo.open_issues_count,
      size_kb: repo.size,
      topics: repo.topics || [],
      license: repo.license ? repo.license.name : null,
      is_fork: repo.fork,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      homepage: repo.homepage,
      default_branch: repo.default_branch,
    };
  }

  /**
   * 根据时间周期获取起始日期
   * @param {string} period - 时间周期
   * @return {string} ISO日期字符串
   */
  getSinceDate(period) {
    const now = new Date();
    let days = 7; // 默认一周

    switch (period) {
      case 'daily':
        days = 1;
        break;
      case 'weekly':
        days = 7;
        break;
      case 'monthly':
        days = 30;
        break;
      default:
        days = 7;
    }

    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return since.toISOString().split('T')[0];
  }

  /**
   * 解析GitHub Trending页面HTML
   * @param {string} html - HTML内容
   * @return {Array} 项目列表
   */
  parseTrendingPage(html) {
    const repositories = [];

    try {
      // 使用正则表达式提取项目信息
      // GitHub Trending页面的项目链接格式: /owner/repo
      const repoRegex = /<h2[^>]*class="[^"]*h3[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/([^\/]+\/[^"]+)"[^>]*>/g;
      const starRegex = /<span[^>]*class="[^"]*Counter[^"]*"[^>]*>\s*([0-9,]+)\s*<\/span>/g;

      let match;
      let starMatch;
      let index = 0;

      // 提取项目名称
      while ((match = repoRegex.exec(html)) !== null && index < 25) {
        const fullName = match[1];
        const [owner, name] = fullName.split('/');

        if (owner && name) {
          repositories.push({
            id: Date.now() + index, // 临时ID
            full_name: fullName,
            name: name,
            owner: { login: owner },
            html_url: `https://github.com/${fullName}`,
            description: '', // 稍后通过API获取
            language: null,
            stars_count: 0,
            forks_count: 0,
            watchers_count: 0,
            open_issues_count: 0,
            size_kb: 0,
            topics: [],
            license: null,
            is_fork: false,
            created_at: null,
            updated_at: null,
            pushed_at: null,
            clone_url: `https://github.com/${fullName}.git`,
            homepage: null,
            default_branch: 'main'
          });
          index++;
        }
      }

      this.logger.info(`📊 Parsed ${repositories.length} repositories from GitHub Trending`);

    } catch (error) {
      this.logger.error('Failed to parse GitHub Trending page:', error);
    }

    return repositories;
  }

  /**
   * 获取仓库README中的第一张图片
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @return {Promise<string|null>} 图片URL
   */
  async getRepositoryMainImage(owner, repo) {
    try {
      // 获取README内容
      const readmeUrl = `${this.baseURL}/repos/${owner}/${repo}/readme`;

      const response = await this.ctx.curl(readmeUrl, {
        method: 'GET',
        headers: this.headers,
        dataType: 'json',
        timeout: 15000,
      });

      if (response.status !== 200) {
        return null;
      }

      // README内容是base64编码的
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

      // 提取第一张图片URL
      const imageUrl = this.extractFirstImage(content, owner, repo);
      return imageUrl;

    } catch (error) {
      this.logger.warn(`Failed to get README for ${owner}/${repo}:`, error.message);
      return null;
    }
  }

  /**
   * 从README内容中提取第一张图片
   * @param {string} content - README内容
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @return {string|null} 图片URL
   */
  extractFirstImage(content, owner, repo) {
    // 匹配markdown图片语法: ![alt](url) 或 <img src="url">
    const patterns = [
      /!\[.*?\]\((.*?)\)/,  // ![alt](url)
      /<img[^>]+src=["']([^"']+)["']/i,  // <img src="url">
      /!\[.*?\]:\s*(.*?)$/m,  // ![alt]: url
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        let imageUrl = match[1].trim();

        // 处理相对路径
        if (imageUrl.startsWith('./') || imageUrl.startsWith('../') || !imageUrl.includes('://')) {
          // 转换为GitHub raw URL
          imageUrl = imageUrl.replace(/^\.\//, '').replace(/^\.\.\//, '');
          imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${imageUrl}`;
        }

        // 验证是否是图片URL
        if (this.isImageUrl(imageUrl)) {
          return imageUrl;
        }
      }
    }

    return null;
  }

  /**
   * 检查URL是否是图片
   * @param {string} url - URL
   * @return {boolean} 是否是图片
   */
  isImageUrl(url) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext)) ||
           lowerUrl.includes('githubusercontent.com') ||
           lowerUrl.includes('github.com') && lowerUrl.includes('blob');
  }

  /**
   * 根据编程语言获取默认图片
   * @param {string} language - 编程语言
   * @return {string} 默认图片URL
   */
  getDefaultImage(language) {
    const defaultImages = {
      'JavaScript': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/javascript/javascript.png',
      'TypeScript': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/typescript/typescript.png',
      'Python': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/python/python.png',
      'Java': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/java/java.png',
      'Go': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/go/go.png',
      'Rust': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/rust/rust.png',
      'C++': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/cpp/cpp.png',
      'C#': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/csharp/csharp.png',
      'PHP': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/php/php.png',
      'Ruby': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/ruby/ruby.png',
      'Swift': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/swift/swift.png',
      'Kotlin': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/kotlin/kotlin.png',
      'Dart': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/dart/dart.png',
      'Vue': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/vue/vue.png',
      'React': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png',
    };

    return defaultImages[language] || 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/github/github.png';
  }

  /**
   * 延时函数
   * @param {number} ms - 毫秒
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GitHubService;