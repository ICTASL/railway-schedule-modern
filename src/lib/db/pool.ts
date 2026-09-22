import 'server-only';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { getEnv } from '../env';

/** The database is unreachable, slow, or answered unexpectedly. Details go to the log, never to users. */
export class DatabaseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DatabaseError';
  }
}

// Survive Next.js hot reloads in development without leaking a pool per reload.
const globalForPool = globalThis as unknown as { __slrPool?: Pool };

function getPool(): Pool {
  if (!globalForPool.__slrPool) {
    const { DATABASE_URL, DATABASE_POOL_SIZE } = getEnv();
    const pool = mysql.createPool({
      uri: DATABASE_URL,
      connectionLimit: DATABASE_POOL_SIZE,
      connectTimeout: 5_000,
      charset: 'utf8mb4', // Sinhala and Tamil names
      dateStrings: true,
      multipleStatements: false,
      decimalNumbers: true,
    });
    // Defence in depth: even if the account has write rights, this app's sessions cannot write.
    pool.pool.on('connection', (connection) => {
      connection.query('SET SESSION TRANSACTION READ ONLY');
    });
    globalForPool.__slrPool = pool;
  }
  return globalForPool.__slrPool;
}

/**
 * Runs a parameterised query. Values are always passed separately from the SQL text; the only
 * dynamic SQL in this app is column names picked from a fixed allow-list (see `lang.ts`).
 */
export async function query<T extends RowDataPacket>(sql: string, values: unknown[] = []): Promise<T[]> {
  try {
    const [rows] = await getPool().query<T[]>({
      sql,
      values,
      timeout: getEnv().DATABASE_QUERY_TIMEOUT_MS,
    });
    return rows;
  } catch (error) {
    throw new DatabaseError('Database query failed', { cause: error });
  }
}
