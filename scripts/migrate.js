const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: '8.140.27.195',
    port: 3306,
    user: 'root',
    password: '@lizesheng123@',
    database: 'blog',
    multipleStatements: true
  });

  try {
    console.log('Connected to database');

    // 读取并执行迁移文件
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Executing migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        try {
          await connection.execute(sql);
          console.log(`✅ Migration ${file} completed successfully`);
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`⚠️  Migration ${file} - Field already exists, skipping`);
          } else if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log(`⚠️  Migration ${file} - Table already exists, skipping`);
          } else {
            console.error(`❌ Migration ${file} failed:`, error.message);
          }
        }
      }
    }

    console.log('All migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

runMigrations();