const { Service } = require('egg');

class GitHubService extends Service {
  constructor(ctx) {
    super(ctx);
    this.baseURL = 'https://api.github.com';
    this.headers = {
      Accept: 'application/vnd.github.v3+json',
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
    const { period = 'daily', language, limit = 25 } = options;

    // 直接使用网页爬取，不使用 GitHub Search API

    try {
      // 构建GitHub Trending URL
      let trendingUrl = 'https://github.com/trending';

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

      this.logger.info(`开始抓取 GitHub 趋势页面: ${trendingUrl}`);

      // 爬取GitHub Trending页面（带重试）
      const response = await this.requestWithRetry(trendingUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
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
          const [ owner, name ] = repo.full_name.split('/');
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
   * 获取仓库详细信息（爬虫方式）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @return {Promise<Object>} 仓库详细信息
   */
  async getRepositoryDetails(owner, repo) {
    try {
      const url = `https://github.com/${owner}/${repo}`;
      this.logger.debug(`抓取仓库页面: ${url}`);

      const response = await this.requestWithRetry(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      });

      if (response.status !== 200) {
        throw new Error(`GitHub page error: ${response.status}`);
      }

      const html = response.data.toString();
      const repoData = this.parseRepositoryPage(html, owner, repo);

      // 获取README内容
      try {
        const readmeContent = await this.getRepositoryReadme(owner, repo);
        if (readmeContent) {
          repoData.readme_content = readmeContent;

          // 从README中提取第一张图片
          const mainImage = this.extractMainImageFromReadme(readmeContent);
          if (mainImage) {
            repoData.main_image = mainImage;
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to get README for ${owner}/${repo}:`, error.message);
        // 使用默认图片
        repoData.main_image = this.getDefaultImage(repoData.language);
      }

      return repoData;

    } catch (error) {
      this.logger.error(`Failed to crawl repository details for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * 解析GitHub仓库页面
   * @param {string} html - 页面HTML内容
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @return {Object} 解析后的仓库数据
   */
  parseRepositoryPage(html, owner, repo) {
    try {
      const repoData = {
        // id: 未从页面解析数字ID，保持为空以便数据库使用 github_url 去重
        full_name: `${owner}/${repo}`,
        name: repo,
        owner: {
          login: owner,
          avatar_url: '',
        },
        description: '',
        description_cn: '',
        language: '',
        stargazers_count: 0,
        forks_count: 0,
        watchers_count: 0,
        size: 0,
        default_branch: 'main',
        open_issues_count: 0,
        topics: [],
        license: null,
        created_at: '',
        updated_at: '',
        pushed_at: '',
        html_url: `https://github.com/${owner}/${repo}`,
        clone_url: `https://github.com/${owner}/${repo}.git`,
        ssh_url: `git@github.com:${owner}/${repo}.git`,
        homepage: '',
        archived: false,
        disabled: false,
        private: false,
        fork: false,
      };

      // 提取描述 - 从About部分提取
      const aboutMatch = html.match(/<h2[^>]*>About<\/h2>[\s\S]*?<p[^>]*class="[^"]*f4[^"]*"[^>]*>\s*([^<]+)\s*<\/p>/i);
      if (aboutMatch && aboutMatch[1]) {
        repoData.description = aboutMatch[1].trim();
      } else {
        // 备用方案：从meta标签提取
        const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"[^>]*>/i);
        if (descMatch && descMatch[1]) {
          repoData.description = descMatch[1].trim();
        }
      }

      // 提取Star数量 - 匹配新的格式 <span id="repo-stars-counter-star" ... class="Counter js-social-count">12.2k</span>
      const starMatch = html.match(/<span[^>]*id="repo-stars-counter-star"[^>]*class="[^"]*Counter[^"]*"[^>]*>([^<]+)<\/span>/i);
      if (starMatch && starMatch[1]) {
        const starStr = starMatch[1].trim();
        if (starStr.includes('k')) {
          repoData.stargazers_count = Math.round(parseFloat(starStr.replace('k', '')) * 1000);
        } else if (starStr.includes('m')) {
          repoData.stargazers_count = Math.round(parseFloat(starStr.replace('m', '')) * 1000000);
        } else {
          repoData.stargazers_count = parseInt(starStr.replace(/,/g, ''), 10);
        }
      } else {
        // 备用方案：匹配旧格式 <strong>12.2k</strong> stars
        const starMatchOld = html.match(/<strong>([^<]+)<\/strong>\s*stars?/i);
        if (starMatchOld && starMatchOld[1]) {
          const starStr = starMatchOld[1].trim();
          if (starStr.includes('k')) {
            repoData.stargazers_count = Math.round(parseFloat(starStr.replace('k', '')) * 1000);
          } else if (starStr.includes('m')) {
            repoData.stargazers_count = Math.round(parseFloat(starStr.replace('m', '')) * 1000000);
          } else {
            repoData.stargazers_count = parseInt(starStr.replace(/,/g, ''), 10);
          }
        }
      }

      // 提取Fork数量 - 匹配 <strong>1.4k</strong> forks 格式
      const forkMatch = html.match(/<strong>([^<]+)<\/strong>\s*forks?/i);
      if (forkMatch && forkMatch[1]) {
        const forkStr = forkMatch[1].trim();
        if (forkStr.includes('k')) {
          repoData.forks_count = Math.round(parseFloat(forkStr.replace('k', '')) * 1000);
        } else if (forkStr.includes('m')) {
          repoData.forks_count = Math.round(parseFloat(forkStr.replace('m', '')) * 1000000);
        } else {
          repoData.forks_count = parseInt(forkStr.replace(/,/g, ''), 10);
        }
      }

      // 提取主要编程语言
      const langMatch = html.match(/<span[^>]*class="[^"]*color-fg-default[^"]*"[^>]*>\s*([^<]+)\s*<\/span>/);
      if (langMatch && langMatch[1]) {
        repoData.language = langMatch[1].trim();
      }

      // 提取Topics - 匹配 <a href="/topics/python" title="Topic: python" data-view-component="true" class="topic-tag topic-tag-link">
      const topicsRegex = /<a[^>]*href="\/topics\/([^"]+)"[^>]*class="[^"]*topic-tag[^"]*"[^>]*>/g;
      const topics = [];
      let topicMatch;
      while ((topicMatch = topicsRegex.exec(html)) !== null) {
        topics.push(topicMatch[1]);
      }
      repoData.topics = topics;

      // 提取头像
      const avatarMatch = html.match(/<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"[^>]*>/);
      if (avatarMatch && avatarMatch[1]) {
        repoData.owner.avatar_url = avatarMatch[1];
      }

      this.logger.debug(`解析仓库: ${repoData.full_name}，Stars: ${repoData.stargazers_count}，语言: ${repoData.language}`);

      return repoData;
    } catch (error) {
      this.logger.error(`Failed to parse repository page for ${owner}/${repo}:`, error);
      // 返回基本数据
      return {
        full_name: `${owner}/${repo}`,
        name: repo,
        owner: { login: owner, avatar_url: '' },
        description: '',
        language: '',
        stargazers_count: 0,
        forks_count: 0,
        html_url: `https://github.com/${owner}/${repo}`,
      };
    }
  }

  /**
   * 获取仓库README内容（爬虫方式）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @return {Promise<string>} README内容
   */
  async getRepositoryReadme(owner, repo) {
    try {
      // 尝试获取README.md
      const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;

      const response = await this.requestWithRetry(readmeUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        timeout: 15000,
      }, 2, 1000); // 2次重试，1秒延迟

      if (response.status === 200) {
        return response.data.toString();
      }

      // 如果main分支没有，尝试master分支
      const masterReadmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`;
      const masterResponse = await this.requestWithRetry(masterReadmeUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        timeout: 15000,
      }, 2, 1000);

      if (masterResponse.status === 200) {
        return masterResponse.data.toString();
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to get README for ${owner}/${repo}:`, error.message);
      return null;
    }
  }

  /**
   * 从README内容中提取主图片
   * @param {string} readmeContent - README内容
   * @return {string|null} 图片URL
   */
  extractMainImageFromReadme(readmeContent) {
    if (!readmeContent) return null;

    // 匹配Markdown图片语法: ![alt](url)
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const match = imgRegex.exec(readmeContent);

    if (match && match[2]) {
      const imageUrl = match[2].trim();

      // 如果是相对路径，转换为绝对路径
      if (imageUrl.startsWith('./') || imageUrl.startsWith('../') || !imageUrl.startsWith('http')) {
        return null; // 暂时不处理相对路径
      }

      return imageUrl;
    }

    return null;
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
      // 查找所有href="/owner/repo"格式的链接
      const allRepoLinks = [];
      const repoLinkRegex = /<a[^>]*href="\/([^\/\s"]+\/[^\/\s"]+)"[^>]*>/g;
      let linkMatch;

      while ((linkMatch = repoLinkRegex.exec(html)) !== null) {
        const fullName = linkMatch[1];
        allRepoLinks.push(fullName);
      }

      // 过滤出真正的trending项目链接
      const trendingProjects = allRepoLinks.filter(link => {
        return !link.startsWith('orgs/') && !link.startsWith('users/') &&
               !link.startsWith('solutions/') && !link.startsWith('resources/') &&
               !link.startsWith('sponsors/') && !link.startsWith('trending/') &&
               !link.startsWith('apps/') && !link.includes('?') && !link.includes('#') &&
               link.split('/').length === 2 &&
               link.split('/')[0].length > 0 &&
               link.split('/')[1].length > 0;
      });

      // 去重并创建项目对象
      const seenRepos = new Set();
      let index = 0;

      trendingProjects.forEach(fullName => {
        if (!seenRepos.has(fullName)) {
          seenRepos.add(fullName);
          const [ owner, name ] = fullName.split('/');

          repositories.push({
            id: Date.now() + index, // 临时ID
            full_name: fullName,
            name,
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
            default_branch: 'main',
          });
          index++;
        }
      });

      this.logger.info(`已解析 ${repositories.length} 个项目（GitHub 趋势）`);

    } catch (error) {
      this.logger.error('Failed to parse GitHub Trending page:', error);
    }

    return repositories;
  }

  // 多语言爬取方法已删除 - 保持简单

  /**
   * 通过网页爬取获取趋势项目（原方法重命名）
   * @param {Object} options - 选项
   * @return {Array} 项目列表
   */
  async getTrendingRepositoriesViaWeb(options = {}) {
    const { period = 'daily', language, limit = 25 } = options;

    try {
      // 构建GitHub Trending URL
      let trendingUrl = 'https://github.com/trending';

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

      this.logger.info(`开始抓取 GitHub 趋势页面: ${trendingUrl}`);

      // 爬取GitHub Trending页面
      const response = await this.ctx.curl(trendingUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
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
          const [ owner, name ] = repo.full_name.split('/');
          const detailRepo = await this.getRepositoryDetails(owner, name);
          if (detailRepo) {
            detailedRepos.push(detailRepo);
          } else {
            detailedRepos.push(repo);
          }
          await this.sleep(200);
        } catch (error) {
          this.logger.warn(`Failed to get details for ${repo.full_name}:`, error.message);
          detailedRepos.push(repo);
        }
      }

      return detailedRepos;

    } catch (error) {
      this.logger.error('Failed to fetch trending repositories via web:', error);
      throw error;
    }
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
      /!\[.*?\]\((.*?)\)/, // ![alt](url)
      /<img[^>]+src=["']([^"']+)["']/i, // <img src="url">
      /!\[.*?\]:\s*(.*?)$/m, // ![alt]: url
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
    const imageExtensions = [ '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp' ];
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
      JavaScript: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/javascript/javascript.png',
      TypeScript: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/typescript/typescript.png',
      Python: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/python/python.png',
      Java: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/java/java.png',
      Go: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/go/go.png',
      Rust: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/rust/rust.png',
      'C++': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/cpp/cpp.png',
      'C#': 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/csharp/csharp.png',
      PHP: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/php/php.png',
      Ruby: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/ruby/ruby.png',
      Swift: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/swift/swift.png',
      Kotlin: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/kotlin/kotlin.png',
      Dart: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/dart/dart.png',
      Vue: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/vue/vue.png',
      React: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png',
    };

    return defaultImages[language] || 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/github/github.png';
  }

  /**
   * 带重试的网络请求
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @param {number} maxRetries - 最大重试次数
   * @param {number} retryDelay - 重试延迟（毫秒）
   * @return {Promise<Object>} 响应结果
   */
  async requestWithRetry(url, options, maxRetries = 3, retryDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.ctx.curl(url, options);
        return response;
      } catch (error) {
        const isNetworkError = error.code === 'ECONNRESET' ||
                              error.code === 'ENOTFOUND' ||
                              error.code === 'ETIMEDOUT' ||
                              error.message.includes('socket hang up');

        if (isNetworkError && attempt < maxRetries) {
          this.logger.warn(`网络请求失败，${retryDelay/1000}秒后重试 (${attempt}/${maxRetries}): ${url} - ${error.message}`);
          await this.sleep(retryDelay);
          continue;
        }

        // 最后一次尝试或非网络错误，抛出错误
        throw error;
      }
    }
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
