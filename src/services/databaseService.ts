// Database Service for Dependency Management

import { Pool, PoolClient } from 'pg';
import { DatabaseConnection } from '../types';
import { LoggerService } from './loggerService';

export class DatabaseService implements DatabaseConnection {
  private pool: Pool;
  private logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
    
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'htma',
      user: process.env.POSTGRES_USER || 'htma',
      password: process.env.POSTGRES_PASSWORD || 'htma_password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Database pool error', { error: err.message });
    });

    this.pool.on('connect', () => {
      this.logger.debug('New database connection established');
    });
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      this.logger.debug('Database query executed', {
        query: text,
        duration,
        rowCount: result.rowCount
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error('Database query failed', {
        query: text,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction failed and rolled back', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Database connection pool closed');
  }
}
