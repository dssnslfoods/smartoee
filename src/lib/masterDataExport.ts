/**
 * Master Data Import/Export Utilities
 * Handles Excel export and CSV/Excel import for Downtime and Defect reasons
 */
import * as XLSX from 'xlsx';

// ==================== EXPORT ====================

interface ExportColumn {
  header: string;
  key: string;
  type: 'string' | 'number' | 'boolean';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportMasterDataToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  sheetName: string = 'Data'
): void {
  // Build worksheet data: header row + data rows
  const wsData: any[][] = [columns.map(col => col.header)];

  data.forEach(row => {
    const rowData = columns.map(col => {
      const value = row[col.key];
      if (col.type === 'boolean') return Boolean(value) ? 'Active' : 'Inactive';
      return value ?? '';
    });
    wsData.push(rowData);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = columns.map(() => ({ wch: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate proper .xlsx binary
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${filename}.xlsx`);
}

export function exportMasterDataToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): void {
  const headers = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(col => {
      const val = row[col.key];
      if (col.type === 'boolean') return Boolean(val) ? 'Active' : 'Inactive';
      const str = String(val ?? '');
      // Escape CSV values containing commas or quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  // BOM for Excel to recognize UTF-8
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

// ==================== IMPORT ====================

export interface ParsedRow {
  [key: string]: string;
}

/**
 * Parse an Excel (.xlsx/.xls) file into rows
 */
export async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
  // Normalize headers to lowercase strings
  return raw.map(row => {
    const normalized: ParsedRow = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase()] = String(value ?? '').trim();
    }
    return normalized;
  });
}

/**
 * Parse a file (CSV or Excel) based on extension
 */
export async function parseImportFile(file: File): Promise<ParsedRow[]> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  if (isExcel) {
    return parseExcelFile(file);
  }
  const content = await readFileAsText(file);
  return parseCSV(content);
}

/**
 * Parse a CSV file content into rows
 */
export function parseCSV(content: string): ParsedRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;

    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

/**
 * Read a file and return its text content
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ==================== DOWNTIME REASON COLUMNS ====================

export const DOWNTIME_REASON_COLUMNS: ExportColumn[] = [
  { header: 'Code', key: 'code', type: 'string' },
  { header: 'Name', key: 'name', type: 'string' },
  { header: 'Category', key: 'category', type: 'string' },
  { header: 'Status', key: 'is_active', type: 'boolean' },
];

export const DEFECT_REASON_COLUMNS: ExportColumn[] = [
  { header: 'Code', key: 'code', type: 'string' },
  { header: 'Name', key: 'name', type: 'string' },
  { header: 'Status', key: 'is_active', type: 'boolean' },
];
