/**
 * Utilitas untuk mem-parsing data CSV mentah (raw .csv) secara aman,
 * termasuk menangani sel yang mengandung tanda koma di dalam tanda kutip ganda ("").
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCSV(rawText: string): ParsedCSV {
  if (!rawText || !rawText.trim()) {
    return { headers: [], rows: [] };
  }

  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  // Split lines manually untuk menangani newline di dalam tanda kutip (jika ada)
  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && rawText[i + 1] === '\n') {
        i++; // skip \n
      }
      lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse baris demi baris menjadi array kolom
  const parseLine = (line: string): string[] => {
    const columns: string[] = [];
    let currentColumn = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
        // Kita simpan tanda kutip atau menghilangkannya tergantung preferensi.
        // Biasanya kita hilangkan untuk data bersih.
      } else if (char === ',' && !inQuotes) {
        columns.push(currentColumn.trim());
        currentColumn = '';
      } else {
        currentColumn += char;
      }
    }
    columns.push(currentColumn.trim());
    return columns;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map((h, index) => {
    const clean = h.replace(/^["']|["']$/g, '').trim();
    return clean || `Kolom_${index + 1}`;
  });

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Lewati baris kosong

    const cols = parseLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      let value = cols[index] || '';
      // Bersihkan tanda kutip pembungkus
      value = value.replace(/^["']|["']$/g, '').trim();
      row[header] = value;
    });

    rows.push(row);
  }

  return { headers, rows };
}
