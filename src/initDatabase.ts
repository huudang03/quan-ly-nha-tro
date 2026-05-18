import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

export async function initDatabase() {
  try {
    let dbUrl = process.env.DATABASE_URL;

    if (!dbUrl && process.env.DB_HOST) {
      const host = process.env.DB_HOST;
      const port = process.env.DB_PORT || 3306;
      const user = process.env.DB_USER || 'root';
      const pass = process.env.DB_PASSWORD ? `:${process.env.DB_PASSWORD}` : '';
      const dbName = process.env.DB_NAME || 'quanlynhatro';
      dbUrl = `mysql://${user}${pass}@${host}:${port}/${dbName}`;
    }

    if (!dbUrl) {
      dbUrl = 'mysql://root:@localhost:3306/quanlynhatro';
    }

    const connection = await mysql.createConnection({
      uri: dbUrl,
      multipleStatements: true
    });

    const [rows] = await connection.query("SHOW TABLES LIKE 'users'");
    const tables = rows as any[];

    if (tables.length === 0) {
      const sqlPath = path.join(process.cwd(), 'database.sql');
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await connection.query(sql);
        console.log('[DB INIT] Database initialized successfully');
      } else {
        console.log('[DB INIT] Error: database.sql not found at ' + sqlPath);
      }
    } else {
      console.log('[DB INIT] Database already initialized');
    }

    await connection.end();
  } catch (error) {
    console.error('[DB INIT] Error initializing database:', error);
  }
}
