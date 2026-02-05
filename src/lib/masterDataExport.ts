/**
 * Master Data Import/Export Utilities
 * Handles Excel export and CSV/Excel import for Downtime and Defect reasons
 */

// ==================== EXPORT ====================

interface ExportColumn {
  header: string;
  key: string;
  type: 'string' | 'number' | 'boolean';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Size="11"/>
      <Interior ss:Color="#1E3A5F" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
    </Style>
    <Style ss:ID="String">
      <NumberFormat ss:Format="@"/>
    </Style>
    <Style ss:ID="Active">
      <Font ss:Color="#16A34A"/>
    </Style>
    <Style ss:ID="Inactive">
      <Font ss:Color="#DC2626"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>`;

  const headerRow = `
      <Row>
        ${columns.map(col => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>`).join('')}
      </Row>`;

  const dataRows = data.map(row => {
    const cells = columns.map(col => {
      const value = row[col.key];
      if (col.type === 'boolean') {
        const boolVal = Boolean(value);
        const style = boolVal ? 'Active' : 'Inactive';
        return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${boolVal ? 'Active' : 'Inactive'}</Data></Cell>`;
      }
      const ssType = col.type === 'number' ? 'Number' : 'String';
      return `<Cell><Data ss:Type="${ssType}">${escapeXml(String(value ?? ''))}</Data></Cell>`;
    });
    return `\n      <Row>${cells.join('')}</Row>`;
  }).join('');

  const xmlFooter = `
    </Table>
  </Worksheet>
</Workbook>`;

  const xmlContent = xmlHeader + headerRow + dataRows + xmlFooter;
  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
  downloadBlob(blob, `${filename}.xls`);
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
