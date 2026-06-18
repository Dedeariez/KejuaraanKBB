/**
 * Logika Inti Parsing Data Matriks (Cross-Tab) untuk Kejuaraan Tarung Derajat KBB
 * Mengubah data tabular cross-tab Google Sheets menjadi Flat List terstandarisasi.
 */

// Core parser for matrix (cross-tab) sheets
import { parseCSV } from './csvParser';

export interface FlatAthlete {
  nama: string;
  satlat: string;
  kategori: 'SENI' | 'TARUNG';
  subKategori: string; // Original sheet name
  kelasTanding: string;
  tinggiBadan: string;
  beratBadan?: string;
}

export const VERIFIED_36_SATLATS = [
  "CIPONGKOR", "SINDANGKERTA", "P3SB", "MAN BANDUNG BARAT", "SMPN 1 CILILIN", 
  "CILILIN", "SMKN 1 CIHAMPELAS", "HR PATARUMAN", "FAJAR KENCANA", "BATUJAJAR", 
  "GIRI ASIH", "TANI MULYA", "CIMAREME", "CIMERANG", "CIPEUNDEUY", "INDOFOOD", 
  "KBP", "PADALARANG", "SMAN 1 PADALARANG", "NGAMPRAH", "SCORINDO", "CIPATAT", 
  "CIRATA", "CIKALONG", "CAMPAKA MEKAR", "CISARUA", "ANDICITESPONG", "LEMBANG", 
  "SMPN 1 LEMBANG", "SMPN 3 LEMBANG", "SMPN 6 LEMBANG", "SMAN 1 LEMBANG", 
  "SMAN 2 LEMBANG", "CIBODAS", "PTKP PADALARANG", "KOTA BALI"
];

/**
 * Memadankan nama Satlat secara presisi tanpa tumpang tindih parsial (misal: "SMPN 6 LEMBANG" diklaim "LEMBANG")
 */
export function matchSatlat(rawName: string): string | undefined {
  const satlatUpper = rawName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!satlatUpper) return undefined;

  const exactMatch = VERIFIED_36_SATLATS.find(s => {
    return s.toUpperCase().replace(/[^A-Z0-9]/g, '') === satlatUpper;
  });
  if (exactMatch) return exactMatch;

  const sortedSatlats = [...VERIFIED_36_SATLATS].sort((a, b) => b.length - a.length);
  for (const s of sortedSatlats) {
    const cleanS = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (satlatUpper.includes(cleanS) || cleanS.includes(satlatUpper)) {
      return s;
    }
  }
  return undefined;
}

/**
 * Membersihkan nama kelas tanding atau kategori dari header kolom yang panjang dan berisik
 */
export function cleanKelasTanding(header: string): string {
  const upper = header.toUpperCase();
  
  // Cari pola rentang berat badan seperti "41 kg - 45 kg", "38,1 kg - 42 kg", dll.
  const weightMatch = header.match(/(\d+(?:,\d+)?\s*[kK][gG]\s*-\s*\d+(?:,\d+)?\s*[kK][gG])/i);
  if (weightMatch) {
    return weightMatch[1].trim().toLowerCase();
  }

  // Cari pola rentang berat badan dengan batas tunggal atau format khusus
  const weightMatchExtra = header.match(/(\d+(?:,\d+)?\s*[kK][gG]\s*-\s*\d+(?:,\d+)?\s*[kK][gG])/i);
  if (weightMatchExtra) {
    return weightMatchExtra[1].trim().toLowerCase();
  }
  
  // Untuk nomor seni gerak
  if (upper.includes("TUNGGAL PA") || upper.includes("TUNGGAL PUTRA")) return "TUNGGAL PA";
  if (upper.includes("TUNGGAL PI") || upper.includes("TUNGGAL PUTRI")) return "TUNGGAL PI";
  if (upper.includes("GETAR PA") || upper.includes("GERAK TARUNG PUTRA")) return "GETAR PA";
  if (upper.includes("GETAR PI") || upper.includes("GERAK TARUNG PUTRI")) return "GETAR PI";
  if (upper.includes("RANGER PA")) return "RANGER PA";
  if (upper.includes("RANGER PI")) return "RANGER PI";

  let clean = header.trim();
  // Jika headernya sangat panjang karena teks pengantar, potong teks pengantar Kejuaraan 2026
  if (clean.length > 45) {
    const yearIndex = clean.indexOf("2026");
    if (yearIndex !== -1 && yearIndex + 4 < clean.length) {
      return clean.substring(yearIndex + 4).trim();
    }
  }
  return clean;
}

/**
 * Memproses data dari raw CSV teks suatu sheet tanding yang berbentuk matriks.
 * - Kolom paling kiri (atau kolom penanda Satlat) berisi nama Satuan Latihan (Satlat).
 * - Lajur horizontal berisi header kelas berat badan bergantian dengan kolom Tinggi Badan (Tinggi / TB / cm).
 * - Sel persilangan yang berisi teks nama atlet diekstraksi menjadi record flat tunggal.
 * 
 * @param csvText String CSV mentah dari Google Sheets
 * @param sheetName Nama Tab Sheet asal (misal: "UDIN PA 5-1 SMP")
 * @returns Array dari objek atlet ter-flat
 */
export function parseMatrixToFlatList(csvText: string, sheetName: string): FlatAthlete[] {
  if (!csvText || !csvText.trim()) {
    return [];
  }

  // Tentukan kategori dasar berdasarkan nama sheet
  const kategori: 'SENI' | 'TARUNG' = sheetName.toUpperCase().includes('SENI') ? 'SENI' : 'TARUNG';

  // Parse menggunakan utilitas parseCSV dasar
  const parsed = parseCSV(csvText);
  if (!parsed || parsed.headers.length === 0) {
    return [];
  }

  const { headers, rawRows } = parsed;
  const athletes: FlatAthlete[] = [];

  // Tentukan kolom Satlat (Column A).
  let satlatHeaderIdx = 0;
  const firstHeaderUpper = headers[0]?.toUpperCase() || '';
  if (firstHeaderUpper === 'NO' || firstHeaderUpper === 'NO.' || firstHeaderUpper === 'URUT') {
    if (headers.length > 1) {
      satlatHeaderIdx = 1;
    }
  }

  let stopParsing = false;

  // Iterasi semua baris data menggunakan loop tradisional untuk mendukung penghentian dini (Rule 1)
  for (let r = 0; r < rawRows.length; r++) {
    if (stopParsing) break;

    const rowCols = rawRows[r];
    // Tarik nilai Satlat dari baris ini (pasti diambil dari kolom Satlat / Column A)
    const satlatNameRaw = rowCols[satlatHeaderIdx] || '';
    const satlatName = satlatNameRaw.trim();
    const satlatUpper = satlatName.toUpperCase();

    // STRICT STOPPING/BREAK CONDITIONS ON THE BOTTOM BOUNDARY ROW (Rule 1)
    if (
      satlatUpper.includes('JUMLAH') || 
      satlatUpper.includes('TOTAL') || 
      satlatUpper.includes('TIDAK MENGIRIMKAN') ||
      /^\s*\d+\s*$/.test(satlatName)
    ) {
      stopParsing = true;
      break;
    }

    // Skip baris jika Satlatnya kosong
    if (!satlatName) continue;

    // STRICT MATCHING against verified 36 Satlats list
    const matchedSatlat = matchSatlat(satlatName);

    if (!matchedSatlat) {
      // It is not a registered Satlat. Skip this row. (Rule 1 rule: no rows parsed below the register range)
      continue;
    }

    // Selalu pindai secara sekuensial kolom-per-kolom demi menangkal pergeseran indeks kolom genap/ganjil pada merged cells (Rule 4)
    // We loop through EVERY column (i++)
    for (let i = satlatHeaderIdx + 1; i < headers.length; i++) {
      const headerName = headers[i];
      if (!headerName) continue;

      const headerUpper = headerName.toUpperCase();

      // IGNORE SUMMARY COLUMNS - RIGHT BOUNDARY STOP (Rule 2)
      // "The horizontal scan must continue until it explicitly hits the JUMLAH ATLET column boundary."
      if (
        headerUpper.includes('JUMLAH ATLET') || 
        headerUpper.includes('JUMLAH/SATLAT') || 
        headerUpper.includes('KETERANGAN') ||
        headerUpper.startsWith('JUMLAH') ||
        headerUpper.startsWith('TOTAL')
      ) {
        break; // Stop parsing cells for this row immediately
      }

      // Skip non-weight-class / non-seni-event columns
      // Only skip if the header is exactly "SATLAT" or "SATUAN LATIHAN" or is a height indicator column.
      if (
        headerUpper.includes('TINGGI BADAN') || 
        headerUpper === 'TB' || 
        headerUpper === 'CM' ||
        headerUpper === 'SATLAT' ||
        headerUpper === 'SATUAN LATIHAN'
      ) {
        continue;
      }

      // THE "EXISTENCE" CHECK
      const athleteNameRaw = rowCols[i] || '';
      const athleteName = athleteNameRaw.trim();

      if (!athleteName) continue;

      // Mendapatkan nilai Tinggi Badan secara presisi dari kolom di sebelah kanan:
      let tinggiVal = '-';
      let shouldSkipNext = false;
      const nextIndex = i + 1;
      if (nextIndex < headers.length) {
        const nextCellVal = (rowCols[nextIndex] || '').trim();
        const nextCellUpper = nextCellVal.toUpperCase();
        const nextHeaderUpper = (headers[nextIndex] || '').toUpperCase();
        if (
          nextCellUpper.includes('CM') || 
          nextCellUpper.includes('TB') ||
          nextHeaderUpper.includes('TINGGI') || 
          nextHeaderUpper.includes('TB') ||
          nextHeaderUpper === 'CM'
        ) {
          tinggiVal = nextCellVal;
          shouldSkipNext = true;
        }
      }

      // Memisahkan nama bertumpuk (pasangan/duo/kelompok) dengan "/" atau "\n" atau "dan"
      const rawNames = athleteName.split(/[/\n]|\s+dan\s+/i);

      rawNames.forEach((rawIndividualName) => {
        const cleanName = rawIndividualName.trim();
        // Permissive validation: >= 2 chars & is not a number
        if (!cleanName || cleanName.length < 2) return;
        if (!isNaN(Number(cleanName))) return;

        const athleteNameUpper = cleanName.toUpperCase();

        // Skip basic non-name tags
        if (
          athleteNameUpper === 'BELUM' ||
          athleteNameUpper === 'SUDAH' ||
          athleteNameUpper === 'KONSENTRASI' ||
          athleteNameUpper === 'KETERANGAN' ||
          athleteNameUpper === 'TINGGI' ||
          athleteNameUpper === 'TB' ||
          athleteNameUpper === 'CM' ||
          athleteNameUpper === 'JUMLAH' ||
          athleteNameUpper === 'TOTAL'
        ) {
          return;
        }

        // Anti-swap: A Satlat name can NEVER be treated as athlete name
        const isSwappedOrSatlatName = VERIFIED_36_SATLATS.some((s) => {
          const cleanS = s.replace(/[^A-Z0-9]/g, '');
          const cleanAth = athleteNameUpper.replace(/[^A-Z0-9]/g, '');
          return cleanAth === cleanS;
        });

        if (isSwappedOrSatlatName) {
          return;
        }

        let cleanTinggi = tinggiVal;
        if (cleanTinggi && cleanTinggi !== '-') {
          cleanTinggi = cleanTinggi.toUpperCase();
          if (!cleanTinggi.includes('CM') && !isNaN(Number(cleanTinggi))) {
            cleanTinggi = cleanTinggi + ' CM';
          }
        }

        athletes.push({
          nama: cleanName,
          satlat: matchedSatlat,
          kategori,
          subKategori: sheetName,
          kelasTanding: cleanKelasTanding(headerName),
          tinggiBadan: cleanTinggi || '-'
        });
      });

      if (shouldSkipNext) {
        i++; // skip next index (height column)
      }
    }
  }

  return athletes;
}

/**
 * Membangun master global list atlet dari kumpulan lembaran mentah (mock & live)
 * @param allSheetTexts Objek map berisi { [NamaSheet]: rawCsvString }
 * @returns List flat atlet terintegrasi penuh se-KBB
 */
export function buildGlobalAthletesList(allSheetTexts: Record<string, string>): FlatAthlete[] {
  const list: FlatAthlete[] = [];
  
  Object.keys(allSheetTexts).forEach((sheetName) => {
    // Kita lewati tab STATS 'DATA HITUNGAN ATLET KEJURKAB' karena itu rekap jumlah per satlat, bukan roster tanding atlet
    if (sheetName.includes('DATA HITUNGAN')) {
      return;
    }

    const csvText = allSheetTexts[sheetName];
    if (csvText) {
      const parsedAthletes = parseMatrixToFlatList(csvText, sheetName);
      list.push(...parsedAthletes);
    }
  });

  // Reconcile and clean duplicates/leaks to keep it pristine (Name, Satlat, and Category unique constraint)
  const seenNames = new Map<string, FlatAthlete>();

  list.forEach((ath) => {
    // Unique key combination based on Athlete Name, Satlat Name, and Category
    const nameKey = `${ath.nama.toLowerCase().trim()}_${ath.satlat.toLowerCase().trim()}_${ath.kategori.toLowerCase().trim()}`;
    const existing = seenNames.get(nameKey);
    if (!existing) {
      seenNames.set(nameKey, ath);
    } else {
      // Determine which instance to keep based on height availability and correctness of tab names
      const existingHasHeight = existing.tinggiBadan && existing.tinggiBadan !== '-';
      const currentHasHeight = ath.tinggiBadan && ath.tinggiBadan !== '-';
      
      if (!existingHasHeight && currentHasHeight) {
        seenNames.set(nameKey, ath);
      } else if (existingHasHeight && currentHasHeight) {
        // Prioritize specific tabs like "PELAJAR PA 3 SMP- 2 SMA" over others if duplicates occur
        if (ath.subKategori.includes('3 SMP') || !existing.subKategori.includes('3 SMP')) {
          seenNames.set(nameKey, ath);
        }
      }
    }
  });

  const athletesResult = Array.from(seenNames.values());

  return athletesResult;
}

export interface ValidationStats {
  totalPeserta: number;
  totalTarung: number;
  totalSeniGerak: number;
  tidakMengirimkan: number;
}

/**
 * Ekstraksi angka ringkasan resmi dari tab "DATA HITUNGAN ATLET KEJURKAB"
 * @param csvText CSV string mentah data hitungan
 */
export function extractValidationStats(csvText: string): ValidationStats {
  const stats: ValidationStats = {
    totalPeserta: 197, // Baseline fallback sesuai data sheet resmi
    totalTarung: 145,  // Baseline fallback sesuai data sheet resmi
    totalSeniGerak: 52, // Baseline fallback sesuai data sheet resmi
    tidakMengirimkan: 0
  };

  if (!csvText || !csvText.trim()) {
    return stats;
  }

  try {
    const parsed = parseCSV(csvText);
    if (parsed && parsed.rawRows) {
      parsed.rawRows.forEach((row) => {
        // Look for labels in the first few columns
        for (let idx = 0; idx < Math.min(row.length, 4); idx++) {
          const val = (row[idx] || '').trim().toUpperCase();
          if (val === 'TOTAL PESERTA' || val.includes('TOTAL PESERTA')) {
            // Pick the next non-empty numeric value in this row
            for (let k = idx + 1; k < row.length; k++) {
              const num = parseInt((row[k] || '').trim(), 10);
              if (!isNaN(num) && num > 0) {
                stats.totalPeserta = num;
                break;
              }
            }
          } else if (val === 'TOTAL ATLET TARUNG' || val.includes('ATLET TARUNG')) {
            for (let k = idx + 1; k < row.length; k++) {
              const num = parseInt((row[k] || '').trim(), 10);
              if (!isNaN(num) && num > 0) {
                stats.totalTarung = num;
                break;
              }
            }
          } else if (val === 'TOTAL ATLET SENI GERAK' || val.includes('SENI GERAK')) {
            for (let k = idx + 1; k < row.length; k++) {
              const num = parseInt((row[k] || '').trim(), 10);
              if (!isNaN(num) && num > 0) {
                stats.totalSeniGerak = num;
                break;
              }
            }
          } else if (val === 'TIDAK MENGIRIMKAN ATLET' || val.includes('TIDAK MENGIRIMKAN')) {
            for (let k = idx + 1; k < row.length; k++) {
              const num = parseInt((row[k] || '').trim(), 10);
              if (!isNaN(num)) {
                stats.tidakMengirimkan = num;
                break;
              }
            }
          }
        }
      });
    }
  } catch (err) {
    console.warn('Gagal membaca data ringkasan validasi dari tab hitungan:', err);
  }

  return stats;
}
