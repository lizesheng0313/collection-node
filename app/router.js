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
};
