const { Service } = require('egg');

class MigrationService extends Service {
  async runMigrations() {
    try {
      // 检查并添加GitHub相关字段
      await this.addGitHubFields();

      // 创建缺失的表
      await this.createMissingTables();

      this.logger.info('Database migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration failed:', error);
    }
  }

  async addGitHubFields() {
    const fields = [
      'github_id BIGINT NULL',
      'github_full_name VARCHAR(255) NULL',
      'github_url VARCHAR(500) NULL',
      'original_description TEXT NULL',
      'translated_description TEXT NULL',
      'programming_language VARCHAR(100) NULL',
      'stars_count INT DEFAULT 0',
      'forks_count INT DEFAULT 0',
      'open_issues_count INT DEFAULT 0',
      'size_kb INT DEFAULT 0',
      'github_created_at DATETIME NULL',
      'github_updated_at DATETIME NULL',
      'topics TEXT NULL',
      'homepage VARCHAR(500) NULL',
      'license VARCHAR(100) NULL',
      'article_type ENUM("blog", "github_project") DEFAULT "blog"',
      'overall_score DECIMAL(3,1) NULL',
    ];

    for (const field of fields) {
      try {
        const fieldName = field.split(' ')[0];
        await this.app.mysql.query(`ALTER TABLE articles ADD COLUMN ${field}`);
        this.logger.info(`Added field: ${fieldName}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          // 字段已存在，跳过
        } else {
          this.logger.error(`Failed to add field ${field}:`, error.message);
        }
      }
    }
  }

  async createMissingTables() {
    // 创建翻译缓存表
    try {
      await this.app.mysql.query(`
        CREATE TABLE IF NOT EXISTS translation_cache (
          id INT AUTO_INCREMENT PRIMARY KEY,
          original_text TEXT NOT NULL,
          translated_text TEXT NOT NULL,
          source VARCHAR(50) DEFAULT 'ai_model',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_original_text (original_text(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      this.logger.info('Created translation_cache table');
    } catch (error) {
      this.logger.error('Failed to create translation_cache table:', error);
    }

    // 创建分析结果表
    try {
      await this.app.mysql.query(`
        CREATE TABLE IF NOT EXISTS analysis_results (
          id INT AUTO_INCREMENT PRIMARY KEY,
          article_id INT NOT NULL,
          analysis_type VARCHAR(50) NOT NULL,
          analysis_data JSON NULL,
          overall_score DECIMAL(3,1) NULL,
          ai_model VARCHAR(50) NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_article_id (article_id),
          INDEX idx_analysis_type (analysis_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      this.logger.info('Created analysis_results table');
    } catch (error) {
      this.logger.error('Failed to create analysis_results table:', error);
    }
  }
}

module.exports = MigrationService;
