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

  const { headers, rows } = parsed;
  const athletes: FlatAthlete[] = [];

  // Tentukan kolom Satlat (Column A).
  // Di mock data kadang ada kolom "No" di paling kiri (index 0), baru kemudian Satuan Latihan (index 1).
  // Di Google Sheets live, kolom paling kiri (Column A, index 0) secara langsung berisi Satlat.
  let satlatHeaderIdx = 0;
  const firstHeaderUpper = headers[0]?.toUpperCase() || '';
  if (firstHeaderUpper === 'NO' || firstHeaderUpper === 'NO.' || firstHeaderUpper === 'URUT') {
    if (headers.length > 1) {
      satlatHeaderIdx = 1;
    }
  }

  // Iterasi semua baris data
  rows.forEach((rowObj) => {
    // Tarik nilai Satlat dari baris ini (pasti diambil dari kolom Satlat / Column A)
    const satlatNameRaw = rowObj[headers[satlatHeaderIdx]] || '';
    const satlatName = satlatNameRaw.replace(/^["']|["']$/g, '').trim();

    // Skip baris jika Satlatnya kosong
    if (!satlatName) return;
    const satlatUpper = satlatName.toUpperCase();

    // STRICT MATCHING against verified 36 Satlats list
    const matchedSatlat = VERIFIED_36_SATLATS.find((s) => {
      const cleanS = s.replace(/[^A-Z0-9]/g, '');
      const cleanTarget = satlatUpper.replace(/[^A-Z0-9]/g, '');
      return cleanTarget === cleanS || cleanTarget.includes(cleanS) || cleanS.includes(cleanTarget);
    });

    if (!matchedSatlat) {
      // It is not a registered Satlat. Skip this row entirely.
      return;
    }

    if (kategori === 'TARUNG') {
      // 1. THE STRICT PAIRING LOOP RULE (Horizontal Scan in Paired Columns)
      // Scan horizontally from Column B onwards strictly in PAIRED COLUMNS
      for (let i = satlatHeaderIdx + 1; i < headers.length; i += 2) {
        const weightHeader = headers[i];
        if (!weightHeader) continue;

        const weightHeaderUpper = weightHeader.toUpperCase();

        // Skip non-weight-class columns
        if (
          weightHeaderUpper.includes('JUMLAH') || 
          weightHeaderUpper.includes('TOTAL') || 
          weightHeaderUpper.includes('KETERANGAN') ||
          weightHeaderUpper === 'NO' ||
          weightHeaderUpper === 'NO.' ||
          weightHeaderUpper.includes('SATLAT') ||
          weightHeaderUpper.includes('SATUAN LATIHAN')
        ) {
          continue;
        }

        // 2. THE "EXISTENCE" CHECK
        const athleteNameRaw = rowObj[weightHeader] || '';
        const athleteName = athleteNameRaw.replace(/^["']|["']$/g, '').trim();

        // ONLY extract if it contains non-empty string value
        if (
          athleteName && 
          athleteName !== '-' && 
          athleteName !== '0' && 
          athleteName.length > 2 && 
          isNaN(Number(athleteName))
        ) {
          const athleteNameUpper = athleteName.toUpperCase();

          // Skip if cell mistakenly contains column headers or labels
          if (
            athleteNameUpper.includes('TINGGI') || 
            athleteNameUpper === 'TB' || 
            athleteNameUpper.includes('BERAT') ||
            athleteNameUpper.includes('SATUAN LATIHAN') ||
            athleteNameUpper.includes('SATLAT') ||
            athleteNameUpper.includes('KETERANGAN') ||
            athleteNameUpper.includes('TOTAL') ||
            athleteNameUpper.includes('JUMLAH')
          ) {
            continue;
          }

          // Anti-swap: A Satlat name can NEVER be treated as athlete name
          const isSwappedOrSatlatName = VERIFIED_36_SATLATS.some((s) => {
            const cleanS = s.replace(/[^A-Z0-9]/g, '');
            const cleanAth = athleteNameUpper.replace(/[^A-Z0-9]/g, '');
            return cleanAth === cleanS;
          });

          if (isSwappedOrSatlatName) {
            continue;
          }

          // Obtain height STRICTLY from exact neighboring cell to the right at i + 1
          let tinggiVal = '-';
          if (i + 1 < headers.length) {
            const heightHeader = headers[i + 1];
            if (heightHeader) {
              const heightHeaderUpper = heightHeader.toUpperCase();
              if (
                heightHeaderUpper.includes('TINGGI') || 
                heightHeaderUpper.includes('TB') || 
                heightHeaderUpper === 'CM'
              ) {
                const heightRaw = rowObj[heightHeader] || '';
                tinggiVal = heightRaw.replace(/^["']|["']$/g, '').trim();
              }
            }
          }

          if (tinggiVal && tinggiVal !== '-') {
            tinggiVal = tinggiVal.toUpperCase();
            if (!tinggiVal.includes('CM') && !isNaN(Number(tinggiVal))) {
              tinggiVal = tinggiVal + ' CM';
            }
          }

          athletes.push({
            nama: athleteName,
            satlat: matchedSatlat,
            kategori,
            subKategori: sheetName,
            kelasTanding: weightHeader,
            tinggiBadan: tinggiVal || '-'
          });
        }
      }
    } else {
      // SENI GERAK: horizontal sequence column by column
      for (let i = satlatHeaderIdx + 1; i < headers.length; i++) {
        const headerName = headers[i];
        if (!headerName) continue;

        const headerUpper = headerName.toUpperCase();

        if (
          headerUpper.includes('JUMLAH') || 
          headerUpper.includes('TOTAL') || 
          headerUpper.includes('KETERANGAN') ||
          headerUpper.includes('NO') ||
          headerUpper.includes('SATUAN LATIHAN') ||
          headerUpper.includes('SATLAT')
        ) {
          continue;
        }

        const athleteNameRaw = rowObj[headerName] || '';
        const athleteName = athleteNameRaw.replace(/^["']|["']$/g, '').trim();

        if (
          athleteName && 
          athleteName !== '-' && 
          athleteName !== '0' && 
          athleteName.length > 2 && 
          isNaN(Number(athleteName))
        ) {
          const athleteNameUpper = athleteName.toUpperCase();

          if (
            athleteNameUpper.includes('TINGGI') || 
            athleteNameUpper === 'TB' || 
            athleteNameUpper.includes('BERAT') ||
            athleteNameUpper.includes('SATUAN LATIHAN') ||
            athleteNameUpper.includes('SATLAT') ||
            athleteNameUpper.includes('KETERANGAN') ||
            athleteNameUpper.includes('TOTAL') ||
            athleteNameUpper.includes('JUMLAH')
          ) {
            continue;
          }

          const isSwappedOrSatlatName = VERIFIED_36_SATLATS.some((s) => {
            const cleanS = s.replace(/[^A-Z0-9]/g, '');
            const cleanAth = athleteNameUpper.replace(/[^A-Z0-9]/g, '');
            return cleanAth === cleanS;
          });

          if (isSwappedOrSatlatName) {
            continue;
          }

          athletes.push({
            nama: athleteName,
            satlat: matchedSatlat,
            kategori,
            subKategori: sheetName,
            kelasTanding: headerName,
            tinggiBadan: '-'
          });
        }
      }
    }
  });

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

  // Reconcile and clean duplicates/leaks to keep it pristine (Name & Satlat unique constraint)
  const seenNames = new Map<string, FlatAthlete>();

  list.forEach((ath) => {
    // Unique key combination based on Athlete Name and Satlat Name
    const nameKey = `${ath.nama.toLowerCase().trim()}_${ath.satlat.toLowerCase().trim()}`;
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

  return Array.from(seenNames.values());
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
    totalPeserta: 193, // Baseline fallback sesuai data sheet resmi
    totalTarung: 145,  // Baseline fallback sesuai data sheet resmi
    totalSeniGerak: 48, // Baseline fallback sesuai data sheet resmi
    tidakMengirimkan: 0
  };

  if (!csvText || !csvText.trim()) {
    return stats;
  }

  try {
    const lines = csvText.split('\n');
    lines.forEach((line) => {
      // Split kolom, bersihkan tanda kutip ganda dan spasi
      const parts = line.split(',').map((p) => p.replace(/^["']|["']$/g, '').trim());
      if (parts.length >= 3) {
        const label = parts[1]?.toUpperCase() || '';
        const value = parseInt(parts[2], 10);
        
        if (!isNaN(value)) {
          if (label === 'TOTAL PESERTA' || label.includes('TOTAL PESERTA')) {
            stats.totalPeserta = value;
          } else if (label === 'TOTAL ATLET TARUNG' || label.includes('ATLET TARUNG')) {
            stats.totalTarung = value;
          } else if (label === 'TOTAL ATLET SENI GERAK' || label.includes('SENI GERAK')) {
            stats.totalSeniGerak = value;
          } else if (label === 'TIDAK MENGIRIMKAN ATLET' || label.includes('TIDAK MENGIRIMKAN')) {
            stats.tidakMengirimkan = value;
          }
        }
      }
    });
  } catch (err) {
    console.warn('Gagal membaca data ringkasan validasi dari tab hitungan:', err);
  }

  return stats;
}
