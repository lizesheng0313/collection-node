/**
 * 文章相关SQL语句
 */
module.exports = {
  // 增加阅读量
  increaseReadCount: `
    UPDATE articles 
    SET read_count = read_count + 1 
    WHERE id = ?
  `,

  // 按状态统计文章数量
  countByStatus: `
    SELECT 
      status, 
      COUNT(*) as count 
    FROM articles 
    GROUP BY status
  `,

  // 获取指定类型的文章列表
  findByType: `
    SELECT
      id,
      title,
      article_type,
      collect_time,
      update_time,
      read_count,
      status,
      publish_time
    FROM articles
    WHERE article_type = ?
    ORDER BY collect_time DESC
    LIMIT ?, ?
  `,

  // 按时间段获取文章
  findByDateRange: `
    SELECT
      id,
      title,
      article_type,
      collect_time,
      update_time,
      read_count,
      status,
      publish_time
    FROM articles
    WHERE collect_time BETWEEN ? AND ?
    ORDER BY collect_time DESC
  `,

  // 获取热门文章
  findHotArticles: `
    SELECT
      id,
      title,
      article_type,
      read_count
    FROM articles
    WHERE status = 'published'
    ORDER BY read_count DESC
    LIMIT ?
  `,

  // 搜索文章
  searchArticles: `
    SELECT 
      id, 
      title, 
      source, 
      collect_time, 
      read_count 
    FROM articles 
    WHERE 
      title LIKE ? AND 
      status = 'published' 
    ORDER BY publish_time DESC 
    LIMIT ?, ?
  `,
};
