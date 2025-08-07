#!/usr/bin/env node

/**
 * GitHub相关数据库表初始化脚本
 * 使用方法: node scripts/init-github-tables.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '123456',
  database: 'blog',
  multipleStatements: true, // 允许执行多条SQL语句
};

async function initGitHubTables() {
  let connection;

  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 读取SQL文件
    const sqlFilePath = path.join(__dirname, '../sql/1.0.0/github.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('正在执行GitHub表创建脚本...');
    await connection.execute(sqlContent);
    console.log('GitHub相关表创建成功！');

    // 验证表结构更新和新表创建
    console.log('\n验证数据库结构:');

    // 检查articles表是否添加了新字段
    try {
      const [columns] = await connection.execute(`SHOW COLUMNS FROM articles LIKE 'article_type'`);
      if (columns.length > 0) {
        console.log('✓ articles表已扩展GitHub相关字段');
      } else {
        console.log('✗ articles表扩展失败');
      }
    } catch (error) {
      console.log(`✗ 检查articles表时出错: ${error.message}`);
    }

    // 检查新创建的表
    const newTables = [
      'analysis_history',
      'translation_cache',
      'trending_snapshots',
      'ai_model_configs'
    ];

    for (const table of newTables) {
      try {
        const [rows] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
        if (rows.length > 0) {
          console.log(`✓ 表 ${table} 创建成功`);
        } else {
          console.log(`✗ 表 ${table} 创建失败`);
        }
      } catch (error) {
        console.log(`✗ 检查表 ${table} 时出错: ${error.message}`);
      }
    }

    // 检查AI模型配置是否插入成功
    try {
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM ai_model_configs');
      console.log(`\n✓ AI模型配置表中有 ${rows[0].count} 条记录`);
    } catch (error) {
      console.log(`✗ 检查AI模型配置时出错: ${error.message}`);
    }

    console.log('\n🎉 GitHub博客系统数据库初始化完成！');
    console.log('\n数据库结构说明:');
    console.log('- articles表: 统一存储博客文章和GitHub项目');
    console.log('- analysis_history表: 记录AI分析历史');
    console.log('- translation_cache表: 翻译缓存');
    console.log('- trending_snapshots表: 热门项目快照');
    console.log('- ai_model_configs表: AI模型配置');
    console.log('\n接下来你可以:');
    console.log('1. 配置环境变量 GITHUB_TOKEN (GitHub API Token)');
    console.log('2. 配置环境变量 OPENAI_API_KEY 或其他AI模型的API Key');
    console.log('3. 启动应用: npm run dev');
    console.log('4. 访问GitHub热门项目: http://localhost:7001/api/github/trending');
    console.log('5. 访问博客文章列表: http://localhost:7001/api/articles/list');

  } catch (error) {
    console.error('初始化失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 检查SQL文件是否存在
const sqlFilePath = path.join(__dirname, '../sql/1.0.0/github.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(`错误: SQL文件不存在: ${sqlFilePath}`);
  process.exit(1);
}

// 执行初始化
initGitHubTables().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});