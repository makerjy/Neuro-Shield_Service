import type { DemoDatasetRow } from "../types";

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportToCsv(data: DemoDatasetRow[], filename: string): void {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const lines = [headers.join(",")];

  for (const row of data) {
    lines.push(headers.map((key) => toCsvValue(row[key])).join(","));
  }

  const csvText = `${lines.join("\n")}\n`;
  const blob = new Blob(["\ufeff", csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
