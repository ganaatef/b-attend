import { createWorkbook, addReportHeaderSheet, addWorksheetFromRows, sendWorkbookResponse, formatMinutesAsHours, safeExcelValue, excelFilename, type ExcelColumn, type ExcelRow } from "../src/lib/excel/exporter";

// Test workbook creation
const wb = createWorkbook();
wb.creator = "Test";

// Test header sheet
addReportHeaderSheet(wb, {
  companyName: "B-Attend Demo Restaurant Group",
  reportTitle: "Daily Attendance Report",
  generatedBy: "owner@b-attend.app",
  generatedAt: new Date(),
  filters: { from: "2026-07-01", to: "2026-07-15", branch: "New Cairo" },
  planNote: "Growth Plan with B-Coach Add-on",
});

// Test data sheet
const columns: ExcelColumn[] = [
  { key: "date", label: "Date", width: 15 },
  { key: "employeeCode", label: "Employee Code", width: 15 },
  { key: "employeeName", label: "Employee Name", width: 25 },
  { key: "branch", label: "Branch", width: 15 },
  { key: "status", label: "Status", width: 15 },
  { key: "workedMinutes", label: "Worked (min)", width: 15 },
  { key: "lateMinutes", label: "Late (min)", width: 15 },
];

const rows: ExcelRow[] = [
  { date: "2026-07-07", employeeCode: "EMP001", employeeName: "Ahmed Mansour", branch: "New Cairo", status: "ON_TIME", workedMinutes: 480, lateMinutes: 0 },
  { date: "2026-07-08", employeeCode: "EMP001", employeeName: "Ahmed Mansour", branch: "New Cairo", status: "LATE", workedMinutes: 405, lateMinutes: 15 },
  { date: "2026-07-09", employeeCode: "EMP001", employeeName: "Ahmed Mansour", branch: "New Cairo", status: "ON_TIME", workedMinutes: 480, lateMinutes: 0 },
];

addWorksheetFromRows(wb, "Daily Attendance", columns, rows);

// Write to file (not response, since this is a script)
const buffer = await wb.xlsx.writeBuffer();
await Bun.write("/home/z/my-project/download/test-excel-export.xlsx", buffer);
console.log("✅ Excel file generated:", "/home/z/my-project/download/test-excel-export.xlsx");
console.log("   Size:", buffer.byteLength, "bytes");
console.log("   Format minutes test:", formatMinutesAsHours(480), "== 8.00h ✓");
console.log("   Safe value test:", safeExcelValue(null), "== null ✓");
console.log("   Safe value test:", safeExcelValue(true), "== Yes ✓");
console.log("   Filename test:", excelFilename("daily-attendance", "2026-07-15"), "== daily-attendance-2026-07-15.xlsx ✓");
