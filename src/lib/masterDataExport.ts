/**
 * Master Data Import/Export Utilities
 * Handles Excel (.xlsx) export and CSV/Excel import
 */
import readXlsxFile from 'read-excel-file';
import ExcelJS from 'exceljs';

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

export async function exportMasterDataToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  sheetName: string = 'Data'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  // Define columns
  sheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: Math.max(col.header.length + 4, 15),
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add data rows
  data.forEach(row => {
    const rowData: Record<string, any> = {};
    columns.forEach(col => {
      const val = row[col.key];
      if (col.type === 'boolean') {
        rowData[col.key] = Boolean(val) ? 'Active' : 'Inactive';
      } else if (col.type === 'number') {
        rowData[col.key] = Number(val) || 0;
      } else {
        rowData[col.key] = String(val ?? '');
      }
    });
    sheet.addRow(rowData);
  });

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

// ==================== IMPORT ====================

export interface ParsedRow {
  [key: string]: string;
}

export async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  try {
    const rows = await readXlsxFile(file);
    if (rows.length < 2) return [];

    // Normalize headers: lowercase and replace spaces with underscores to match expected keys like 'line_id'
    const headers = rows[0].map(h =>
      String(h ?? '').trim().toLowerCase().replace(/[\s\W]+/g, '_').replace(/^_+|_+$/g, '')
    );

    const result: ParsedRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      if (!values || values.every(v => !v && v !== 0)) continue;

      const row: ParsedRow = {};
      headers.forEach((header, idx) => {
        if (header) {
          row[header] = String(values[idx] ?? '').trim();
        }
      });
      result.push(row);
    }

    return result;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}

export async function parseImportFile(file: File): Promise<ParsedRow[]> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  if (isExcel) {
    return parseExcelFile(file);
  }
  const content = await readFileAsText(file);
  return parseCSV(content);
}

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

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (_e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ==================== COLUMN DEFINITIONS ====================

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

export const HOLIDAY_COLUMNS: ExportColumn[] = [
  { header: 'Date', key: 'holiday_date', type: 'string' },
  { header: 'Name', key: 'name', type: 'string' },
  { header: 'Description', key: 'description', type: 'string' },
  { header: 'Plant', key: 'plant_name', type: 'string' },
  { header: 'Recurring', key: 'is_recurring', type: 'boolean' },
];
