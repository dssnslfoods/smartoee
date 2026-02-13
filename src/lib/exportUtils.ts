import { format } from 'date-fns';
import ExcelJS from 'exceljs';

export interface OEEExportRow {
  date: string;
  shiftStart: string;
  shiftEnd: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  goodQty: number;
  rejectQty: number;
  runTimeMinutes: number;
  downtimeMinutes: number;
  plannedTimeMinutes: number;
}

/**
 * Convert OEE data to CSV format and trigger download
 */
export function exportToCSV(data: OEEExportRow[], filename: string): void {
  const headers = [
    'Date', 'Shift Start', 'Shift End',
    'Availability (%)', 'Performance (%)', 'Quality (%)', 'OEE (%)',
    'Good Qty', 'Reject Qty', 'Run Time (min)', 'Downtime (min)', 'Planned Time (min)',
  ];

  const csvRows = [
    headers.join(','),
    ...data.map(row => [
      row.date, row.shiftStart, row.shiftEnd,
      row.availability.toFixed(1), row.performance.toFixed(1),
      row.quality.toFixed(1), row.oee.toFixed(1),
      row.goodQty, row.rejectQty,
      row.runTimeMinutes, row.downtimeMinutes, row.plannedTimeMinutes,
    ].join(',')),
  ];

  const csvContent = csvRows.join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export OEE data to real .xlsx format using ExcelJS
 */
export async function exportToExcel(data: OEEExportRow[], filename: string, sheetName: string = 'OEE Data'): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Shift Start', key: 'shiftStart', width: 12 },
    { header: 'Shift End', key: 'shiftEnd', width: 12 },
    { header: 'Availability (%)', key: 'availability', width: 16 },
    { header: 'Performance (%)', key: 'performance', width: 16 },
    { header: 'Quality (%)', key: 'quality', width: 14 },
    { header: 'OEE (%)', key: 'oee', width: 12 },
    { header: 'Good Qty', key: 'goodQty', width: 12 },
    { header: 'Reject Qty', key: 'rejectQty', width: 12 },
    { header: 'Run Time (min)', key: 'runTimeMinutes', width: 16 },
    { header: 'Downtime (min)', key: 'downtimeMinutes', width: 16 },
    { header: 'Planned Time (min)', key: 'plannedTimeMinutes', width: 18 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add data rows with OEE color coding
  data.forEach(row => {
    const excelRow = sheet.addRow(row);

    // Color-code OEE column (column 7)
    const oeeCell = excelRow.getCell(7);
    if (row.oee >= 85) {
      oeeCell.font = { color: { argb: 'FF16A34A' } }; // green
    } else if (row.oee >= 60) {
      oeeCell.font = { color: { argb: 'FFCA8A04' } }; // yellow
    } else {
      oeeCell.font = { color: { argb: 'FFDC2626' } }; // red
    }
  });

  // Number format for percentage columns
  [4, 5, 6, 7].forEach(colIdx => {
    sheet.getColumn(colIdx).numFmt = '0.0';
  });

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 12 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${filename}.xlsx`);
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

/**
 * Format OEE snapshots for export
 */
export function formatOEEForExport(snapshots: Array<{
  period_start: string;
  period_end: string;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  good_qty: number | null;
  reject_qty: number | null;
  run_time_minutes: number | null;
  downtime_minutes: number | null;
  planned_time_minutes: number | null;
}>): OEEExportRow[] {
  return snapshots.map(snap => ({
    date: format(new Date(snap.period_start), 'yyyy-MM-dd'),
    shiftStart: format(new Date(snap.period_start), 'HH:mm'),
    shiftEnd: format(new Date(snap.period_end), 'HH:mm'),
    availability: Number(snap.availability) || 0,
    performance: Number(snap.performance) || 0,
    quality: Number(snap.quality) || 0,
    oee: Number(snap.oee) || 0,
    goodQty: snap.good_qty || 0,
    rejectQty: snap.reject_qty || 0,
    runTimeMinutes: snap.run_time_minutes || 0,
    downtimeMinutes: snap.downtime_minutes || 0,
    plannedTimeMinutes: snap.planned_time_minutes || 0,
  }));
}
