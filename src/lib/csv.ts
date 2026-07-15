/**
 * B-Attend CSV export utility — UTF-8 BOM + proper escaping.
 */

export interface CsvColumn {
  key: string;
  label: string;
}

export interface CsvRow {
  [key: string]: string | number | null | undefined;
}

export function toCsv(rows: CsvRow[], columns: CsvColumn[]): string {
  const escape = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(",")).join("\r\n");
  // UTF-8 BOM so Arabic and special chars render in Excel
  return "\uFEFF" + header + "\r\n" + body;
}

export function csvFilename(prefix: string, filters: Record<string, string | undefined>): string {
  const parts = [prefix];
  if (filters.from) parts.push(filters.from);
  if (filters.to) parts.push(filters.to);
  if (filters.branch) parts.push("branch");
  return `${parts.join("-")}.csv`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().split("T")[0];
}

export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString();
}
