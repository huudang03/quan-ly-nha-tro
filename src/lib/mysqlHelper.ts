import mysql from 'mysql2/promise';
import pool from '../config/db';
import cryptoRandomString from 'crypto-random-string';

export function genId() {
  return cryptoRandomString({ length: 20, type: 'alphanumeric' });
}

export class DbService {
  static async transaction(callback: (conn: mysql.PoolConnection) => Promise<any>) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async query(sql: string, params: any[] = []) {
    const [rows] = await pool.execute(sql, params);
    return rows as any[];
  }

  static async execute(sql: string, params: any[] = []) {
    const [result] = await pool.execute(sql, params);
    return result;
  }

  static async getAll(tableName: string, orderByCol?: string, orderDir = 'ASC') {
    let sql = `SELECT * FROM \`${tableName}\``;
    if (orderByCol) sql += ` ORDER BY \`${orderByCol}\` ${orderDir}`;
    const [rows] = await pool.query(sql);
    return rows as any[];
  }

  static async getById(tableName: string, id: string) {
    const [rows] = await pool.execute(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [id]);
    const results = rows as any[];
    return results.length > 0 ? results[0] : null;
  }

  static async create(tableName: string, data: any) {
    if (!data.id) data.id = genId();
    if (!data.createdAt) data.createdAt = new Date();
    if (!data.updatedAt) data.updatedAt = new Date();

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const cleanValues = values.map(v => v === undefined ? null : v) as any[];

    const sql = `INSERT INTO \`${tableName}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`;
    await pool.execute(sql, cleanValues);
    
    return data;
  }

  static async update(tableName: string, id: string, data: any) {
    data.updatedAt = new Date();
    const keys = Object.keys(data).filter(k => k !== 'id');
    const values = keys.map(k => data[k] === undefined ? null : data[k]);
    
    if (keys.length === 0) return data;

    const setStr = keys.map(k => `\`${k}\` = ?`).join(', ');
    
    if (id === 'ALL') {
      const sql = `UPDATE \`${tableName}\` SET ${setStr}`;
      await pool.execute(sql, values);
    } else {
      const sql = `UPDATE \`${tableName}\` SET ${setStr} WHERE id = ?`;
      await pool.execute(sql, [...values, id]);
    }
    return { id, ...data };
  }

  static async set(tableName: string, id: string, data: any) {
    const existing = await this.getById(tableName, id);
    if (!existing) {
      data.id = id;
      return await this.create(tableName, data);
    } else {
      return await this.update(tableName, id, data);
    }
  }

  static async delete(tableName: string, id: string) {
    if (id === 'ALL') {
      await pool.execute(`DELETE FROM \`${tableName}\``);
    } else {
      await pool.execute(`DELETE FROM \`${tableName}\` WHERE id = ?`, [id]);
    }
    return { id, success: true };
  }

  static async findOne(tableName: string, whereClause: string, params: any[]) {
    const sql = `SELECT * FROM \`${tableName}\` WHERE ${whereClause} LIMIT 1`;
    const [rows] = await pool.execute(sql, params);
    const results = rows as any[];
    return results.length > 0 ? results[0] : null;
  }

  static async findMany(tableName: string, whereClause: string, params: any[], orderByStr?: string) {
    let sql = `SELECT * FROM \`${tableName}\``;
    if (whereClause) sql += ` WHERE ${whereClause}`;
    if (orderByStr) sql += ` ORDER BY ${orderByStr}`;
    const [rows] = await pool.execute(sql, params);
    return rows as any[];
  }
}
