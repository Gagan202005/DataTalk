/**
 * DuckDB persistent database manager.
 * Each session gets its own .duckdb file — survives server restarts.
 */
import path from 'path';
import fs from 'fs';
import duckdb from 'duckdb';
import { config } from '../config';
import { ParsedRow } from '../types';

fs.mkdirSync(config.sessionsDir, { recursive: true });

function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return Number(v);
  return v;
}

function serializeRow(row: Record<string, unknown>): ParsedRow {
  const out: ParsedRow = {};
  for (const [k, val] of Object.entries(row)) {
    out[k] = serializeValue(val) as string | number | boolean | null;
  }
  return out;
}

export class DatabaseManager {
  readonly sessionId: string;
  readonly dbPath: string;
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  tableName: string = 'data';

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.dbPath = path.join(config.sessionsDir, `${sessionId}.duckdb`);
    this.db = new duckdb.Database(this.dbPath);
    this.conn = this.db.connect();
  }

  private static safeIdentifier(name: string): string {
    return '"' + name.replace(/"/g, '""') + '"';
  }

  /** Load rows from a CSV file into a DuckDB table. */
  loadFromCsv(csvPath: string, tableName: string = 'data'): Promise<void> {
    this.tableName = tableName;
    const safe = DatabaseManager.safeIdentifier(tableName);
    const escaped = csvPath.replace(/\\/g, '/').replace(/'/g, "''");
    return new Promise((resolve, reject) => {
      this.conn.exec(
        `DROP TABLE IF EXISTS ${safe}; CREATE TABLE ${safe} AS SELECT * FROM read_csv_auto('${escaped}', header=true, all_varchar=false)`,
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  executeQuery(sql: string): Promise<{
    success: boolean;
    data: ParsedRow[];
    columns: string[];
    row_count: number;
    error?: string;
  }> {
    return new Promise((resolve) => {
      this.conn.all(sql, (err, rows) => {
        if (err) {
          resolve({ success: false, data: [], columns: [], row_count: 0, error: err.message });
          return;
        }
        const data = (rows as Record<string, unknown>[]).map(serializeRow);
        const columns = data.length > 0 ? Object.keys(data[0]) : [];
        resolve({ success: true, data, columns, row_count: data.length });
      });
    });
  }

  getRowCount(): Promise<number> {
    return new Promise((resolve) => {
      const safe = DatabaseManager.safeIdentifier(this.tableName);
      this.conn.all(`SELECT COUNT(*) as n FROM ${safe}`, (err, rows) => {
        if (err) { resolve(0); return; }
        resolve(Number((rows as any[])[0]?.n ?? 0));
      });
    });
  }

  getTableRowCount(tableName: string): Promise<number> {
    return new Promise((resolve) => {
      const safe = DatabaseManager.safeIdentifier(tableName);
      this.conn.all(`SELECT COUNT(*) as n FROM ${safe}`, (err, rows) => {
        if (err) { resolve(0); return; }
        resolve(Number((rows as any[])[0]?.n ?? 0));
      });
    });
  }

  getColumnNames(): Promise<string[]> {
    return new Promise((resolve) => {
      this.conn.all(
        `SELECT column_name FROM information_schema.columns WHERE table_name = ?`,
        [this.tableName],
        (err, rows) => {
          if (err) { resolve([]); return; }
          resolve((rows as any[]).map((r) => r.column_name));
        },
      );
    });
  }

  close(): void {
    try { this.conn.close(); } catch { /* ignore */ }
    try { this.db.close(); } catch { /* ignore */ }
  }

  deleteFile(): void {
    try {
      if (fs.existsSync(this.dbPath)) fs.unlinkSync(this.dbPath);
      const wal = this.dbPath + '.wal';
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
    } catch { /* ignore */ }
  }
}
