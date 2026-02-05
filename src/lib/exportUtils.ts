 import { format } from 'date-fns';
 
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
     'Date',
     'Shift Start',
     'Shift End',
     'Availability (%)',
     'Performance (%)',
     'Quality (%)',
     'OEE (%)',
     'Good Qty',
     'Reject Qty',
     'Run Time (min)',
     'Downtime (min)',
     'Planned Time (min)',
   ];
 
   const csvRows = [
     headers.join(','),
     ...data.map(row => [
       row.date,
       row.shiftStart,
       row.shiftEnd,
       row.availability.toFixed(1),
       row.performance.toFixed(1),
       row.quality.toFixed(1),
       row.oee.toFixed(1),
       row.goodQty,
       row.rejectQty,
       row.runTimeMinutes,
       row.downtimeMinutes,
       row.plannedTimeMinutes,
     ].join(',')),
   ];
 
   const csvContent = csvRows.join('\n');
   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
   downloadBlob(blob, `${filename}.csv`);
 }
 
 /**
  * Convert OEE data to Excel-compatible XML format and trigger download
  * Uses SpreadsheetML format which Excel can open natively
  */
 export function exportToExcel(data: OEEExportRow[], filename: string, sheetName: string = 'OEE Data'): void {
   const headers = [
     'Date',
     'Shift Start',
     'Shift End',
     'Availability (%)',
     'Performance (%)',
     'Quality (%)',
     'OEE (%)',
     'Good Qty',
     'Reject Qty',
     'Run Time (min)',
     'Downtime (min)',
     'Planned Time (min)',
   ];
 
   // Build Excel XML
   const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
 <?mso-application progid="Excel.Sheet"?>
 <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
   xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
   <Styles>
     <Style ss:ID="Header">
       <Font ss:Bold="1"/>
       <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>
     </Style>
     <Style ss:ID="Number">
       <NumberFormat ss:Format="0.0"/>
     </Style>
     <Style ss:ID="Integer">
       <NumberFormat ss:Format="0"/>
     </Style>
     <Style ss:ID="Good">
       <Font ss:Color="#16A34A"/>
     </Style>
     <Style ss:ID="Warning">
       <Font ss:Color="#CA8A04"/>
     </Style>
     <Style ss:ID="Bad">
       <Font ss:Color="#DC2626"/>
     </Style>
   </Styles>
   <Worksheet ss:Name="${escapeXml(sheetName)}">
     <Table>`;
 
   const headerRow = `
       <Row>
         ${headers.map(h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}
       </Row>`;
 
   const dataRows = data.map(row => {
     const oeeStyle = row.oee >= 85 ? 'Good' : row.oee >= 60 ? 'Warning' : 'Bad';
     return `
       <Row>
         <Cell><Data ss:Type="String">${escapeXml(row.date)}</Data></Cell>
         <Cell><Data ss:Type="String">${escapeXml(row.shiftStart)}</Data></Cell>
         <Cell><Data ss:Type="String">${escapeXml(row.shiftEnd)}</Data></Cell>
         <Cell ss:StyleID="Number"><Data ss:Type="Number">${row.availability}</Data></Cell>
         <Cell ss:StyleID="Number"><Data ss:Type="Number">${row.performance}</Data></Cell>
         <Cell ss:StyleID="Number"><Data ss:Type="Number">${row.quality}</Data></Cell>
         <Cell ss:StyleID="${oeeStyle}"><Data ss:Type="Number">${row.oee}</Data></Cell>
         <Cell ss:StyleID="Integer"><Data ss:Type="Number">${row.goodQty}</Data></Cell>
         <Cell ss:StyleID="Integer"><Data ss:Type="Number">${row.rejectQty}</Data></Cell>
         <Cell ss:StyleID="Integer"><Data ss:Type="Number">${row.runTimeMinutes}</Data></Cell>
         <Cell ss:StyleID="Integer"><Data ss:Type="Number">${row.downtimeMinutes}</Data></Cell>
         <Cell ss:StyleID="Integer"><Data ss:Type="Number">${row.plannedTimeMinutes}</Data></Cell>
       </Row>`;
   }).join('');
 
   const xmlFooter = `
     </Table>
   </Worksheet>
 </Workbook>`;
 
   const xmlContent = xmlHeader + headerRow + dataRows + xmlFooter;
   const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
   downloadBlob(blob, `${filename}.xls`);
 }
 
 /**
  * Helper to escape XML special characters
  */
 function escapeXml(str: string): string {
   return str
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&apos;');
 }
 
 /**
  * Helper to trigger file download
  */
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