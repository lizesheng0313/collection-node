/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller, middleware } = app;
  
  // JWT中间件
  const jwt = middleware.jwt();
  
  // 认证相关路由
  router.post('/api/auth/login', controller.auth.login);
  router.get('/api/auth/info', jwt, controller.auth.info);
  router.post('/api/auth/logout', jwt, controller.auth.logout);
  
  // 文章相关路由 - 加入JWT中间件进行认证保护
  router.post('/api/articles/create', jwt, controller.article.create);
  router.post('/api/articles/edit/:id', jwt, controller.article.update);
  router.post('/api/articles/delete/:id', jwt, controller.article.destroy);
  router.get('/api/articles/detail/:id', controller.article.show);
  router.get('/api/articles/list', controller.article.index);

  // GitHub项目相关路由
  router.get('/api/articles/github', controller.article.github);
  router.get('/api/articles/github/languages', controller.article.githubLanguages);
  router.get('/api/articles/github/scores', controller.article.githubScores);
  router.get('/api/articles/github/:owner/:repo', controller.article.githubDetail);

  // GitHub相关路由
  router.get('/api/github/trending', controller.github.trending);
  router.get('/api/github/search', controller.github.search);
  router.get('/api/github/repos/:owner/:repo', controller.github.repository);
  router.get('/api/github/suggestions', controller.github.suggestions);

  // 分析相关路由
  router.get('/api/analysis/:owner/:repo', controller.analysis.analyze);
  router.post('/api/analysis/translate', controller.analysis.translate);
  router.post('/api/analysis/translate/batch', controller.analysis.batchTranslate);
  router.get('/api/analysis/history', controller.analysis.history);

  // 爬虫管理路由
  router.get('/api/crawler/status', controller.crawler.status);
  router.post('/api/crawler/trigger', controller.crawler.trigger);
  router.get('/api/crawler/history', controller.crawler.history);
  router.post('/api/crawler/clear-cache', controller.crawler.clearCache);
  router.get('/api/crawler/languages', controller.crawler.languages);
};
