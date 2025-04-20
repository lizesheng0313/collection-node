/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  
  // 文章相关路由
  router.post('/api/articles', controller.article.create);
  router.put('/api/articles/:id', controller.article.update);
  router.delete('/api/articles/:id', controller.article.destroy);
  router.get('/api/articles/:id', controller.article.show);
  router.get('/api/articles', controller.article.index);
};
