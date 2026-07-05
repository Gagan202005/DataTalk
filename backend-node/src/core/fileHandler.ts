/**
 * File upload handler. Parses CSV, Excel, JSON, and TSV into row arrays.
 */
import path from 'path';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { config } from '../config';
import { ParsedRow } from '../types';

const ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls', '.json', '.tsv']);

export function parseBuffer(
  buffer: Buffer,
  filename: string,
): ParsedRow[] {
  const ext = path.extname(filename).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type: ${ext}. Please upload CSV, Excel, JSON, or TSV.`);
  }

  const sizeMb = buffer.length / (1024 * 1024);
  if (sizeMb > config.maxFileSizeMb) {
    throw new Error(`File too large: ${sizeMb.toFixed(1)}MB. Maximum is ${config.maxFileSizeMb}MB.`);
  }

  let rows: ParsedRow[];

  try {
    if (ext === '.csv') {
      rows = parseCsv(buffer.toString('utf-8'), ',');
    } else if (ext === '.tsv') {
      rows = parseCsv(buffer.toString('utf-8'), '\t');
    } else if (ext === '.xlsx' || ext === '.xls') {
      rows = parseExcel(buffer);
    } else if (ext === '.json') {
      const parsed = JSON.parse(buffer.toString('utf-8'));
      if (Array.isArray(parsed)) {
        rows = parsed as ParsedRow[];
      } else {
        throw new Error('JSON must be an array of objects.');
      }
    } else {
      throw new Error(`Unsupported format: ${ext}`);
    }
  } catch (e: any) {
    throw new Error(
      `Failed to parse file: ${e.message}. Make sure the file has headers in the first row.`,
    );
  }

  if (!rows || rows.length === 0) {
    throw new Error('The uploaded file is empty.');
  }

  return cleanColumns(rows);
}

function parseCsv(content: string, delimiter: string): ParsedRow[] {
  const result = Papa.parse<ParsedRow>(content, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(result.errors[0].message);
  }
  return result.data;
}

function parseExcel(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Excel file has no sheets.');
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: null });
}

/** Normalise column names: strip whitespace, lowercase, spaces → underscores. */
function cleanColumns(rows: ParsedRow[]): ParsedRow[] {
  if (rows.length === 0) return rows;
  const oldKeys = Object.keys(rows[0]);
  const newKeys = oldKeys.map((k) =>
    String(k).trim().replace(/\s+/g, '_').toLowerCase(),
  );

  // Drop columns that are entirely null
  const nonEmptyCols = newKeys.filter((_, i) =>
    rows.some((r) => r[oldKeys[i]] !== null && r[oldKeys[i]] !== undefined && r[oldKeys[i]] !== ''),
  );

  return rows.map((row) => {
    const out: ParsedRow = {};
    oldKeys.forEach((ok, i) => {
      const nk = newKeys[i];
      if (nonEmptyCols.includes(nk)) {
        out[nk] = row[ok] as string | number | boolean | null;
      }
    });
    return out;
  });
}

/** Export rows back to CSV bytes. */
export function rowsToCsvBytes(rows: ParsedRow[]): Buffer {
  const csv = Papa.unparse(rows);
  return Buffer.from(csv, 'utf-8');
}
