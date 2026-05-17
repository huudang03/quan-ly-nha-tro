import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Create connection pool
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl && process.env.DB_HOST) {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const pass = process.env.DB_PASSWORD ? `:${process.env.DB_PASSWORD}` : '';
  const dbName = process.env.DB_NAME || 'quanlynhatro';
  dbUrl = `mysql://${user}${pass}@${host}:${port}/${dbName}`;
}

// Fallback for local development
if (!dbUrl) {
  dbUrl = 'mysql://root:@localhost:3306/quanlynhatro';
}

const pool = mysql.createPool({
  uri: dbUrl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export default pool;
