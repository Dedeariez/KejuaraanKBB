import { parseCSV } from './csvParser';

export interface FlatAthlete {
  nama: string;
  satlat: string;
  kategori: 'SENI' | 'TARUNG';
  subKategori: string;
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

export function parseMatrixToFlatList(csvText: string, sheetName: string): FlatAthlete[] {
  if (!csvText || !csvText.trim()) return [];

  const kategori: 'SENI' | 'TARUNG' = sheetName.toUpperCase().includes('SENI') ? 'SENI' : 'TARUNG';
  const parsed = parseCSV(csvText);
  if (!parsed || parsed.headers.length === 0) return [];

  const { headers, rows } = parsed;
  const athletes: FlatAthlete[] = [];

  let satlatHeaderIdx = 0;
  const firstHeaderUpper = headers[0]?.toUpperCase() || '';
  if (firstHeaderUpper === 'NO' || firstHeaderUpper === 'NO.' || firstHeaderUpper === 'URUT') {
    if (headers.length > 1) satlatHeaderIdx = 1;
  }

  let stopParsing = false;

  for (let r = 0; r < rows.length; r++) {
    if (stopParsing) break;

    const rowObj = rows[r];
    const satlatNameRaw = rowObj[headers[satlatHeaderIdx]] || '';
    const satlatName = satlatNameRaw.replace(/^["']|["']$/g, '').trim();
    const satlatUpper = satlatName.toUpperCase();

    if (
      satlatUpper.includes('JUMLAH') || 
      satlatUpper.includes('TOTAL') || 
      satlatUpper.includes('TIDAK MENGIRIMKAN') ||
      /^\s*\d+\s*$/.test(satlatName)
    ) {
      stopParsing = true;
      break;
    }

    if (!satlatName) continue;

    const matchedSatlat = VERIFIED_36_SATLATS.find((s) => {
      const cleanS = s.replace(/[^A-Z0-9]/g, '');
      const cleanTarget = satlatUpper.replace(/[^A-Z0-9]/g, '');
      return cleanTarget === cleanS || cleanTarget.includes(cleanS) || cleanS.includes(cleanTarget);
    });

    if (!matchedSatlat) continue;

    // BACA SEMUA KOLOM UNTUK TARUNG DAN SENI GERAK TANPA TERLEWAT
    for (let i = satlatHeaderIdx + 1; i < headers.length; i++) {
      const weightHeader = headers[i];
      if (!weightHeader) continue;

      const weightHeaderUpper = weightHeader.toUpperCase();

      if (weightHeaderUpper.includes('JUMLAH ATLET PER-SATLAT') || weightHeaderUpper.includes('KETERANGAN')) {
        break; 
      }

      if (
        weightHeaderUpper.includes('JUMLAH') || 
        weightHeaderUpper.includes('TOTAL') || 
        weightHeaderUpper === 'NO' ||
        weightHeaderUpper === 'NO.' ||
        weightHeaderUpper.includes('SATLAT') ||
        weightHeaderUpper.includes('SATUAN LATIHAN') ||
        weightHeaderUpper.includes('TINGGI') ||
        weightHeaderUpper === 'TB' ||
        weightHeaderUpper === 'CM'
      ) {
        continue;
      }

      const athleteNameRaw = rowObj[weightHeader] || '';
      const athleteName = athleteNameRaw.replace(/^["']|["']$/g, '').trim();

      const isNameValid = 
        athleteName && 
        athleteName.length > 2 && 
        !/\d/.test(athleteName) &&
        /^[a-zA-Z\s\.\'\-\`\’\(\)]+$/.test(athleteName);

      if (isNameValid) {
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

        if (isSwappedOrSatlatName) continue;

        let tinggiVal = '-';
        if (i + 1 < headers.length) {
          const heightHeader = headers[i + 1];
          if (heightHeader) {
            const heightHeaderUpper = heightHeader.toUpperCase();
            if (heightHeaderUpper.includes('TINGGI') || heightHeaderUpper.includes('TB') || heightHeaderUpper === 'CM') {
              const heightRaw = rowObj[heightHeader] || '';
              tinggiVal = heightRaw.replace(/^["']|["']$/g, '').trim();
              i++; // Lompat satu langkah agar tinggi tidak dianggap kelas tanding
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
  }

  return athletes;
}

export function buildGlobalAthletesList(allSheetTexts: Record<string, string>): FlatAthlete[] {
  const list: FlatAthlete[] = [];
  
  Object.keys(allSheetTexts).forEach((sheetName) => {
    if (sheetName.includes('DATA HITUNGAN')) return;
    const csvText = allSheetTexts[sheetName];
    if (csvText) {
      const parsedAthletes = parseMatrixToFlatList(csvText, sheetName);
      list.push(...parsedAthletes);
    }
  });

  const seenNames = new Map<string, FlatAthlete>();

  list.forEach((ath) => {
    const nameKey = `${ath.nama.toLowerCase().trim()}_${ath.satlat.toLowerCase().trim()}`;
    const existing = seenNames.get(nameKey);
    if (!existing) {
      seenNames.set(nameKey, ath);
    } else {
      const existingHasHeight = existing.tinggiBadan && existing.tinggiBadan !== '-';
      const currentHasHeight = ath.tinggiBadan && ath.tinggiBadan !== '-';
      
      if (!existingHasHeight && currentHasHeight) {
        seenNames.set(nameKey, ath);
      } else if (existingHasHeight && currentHasHeight) {
        if (ath.subKategori.includes('3 SMP') || !existing.subKategori.includes('3 SMP')) {
          seenNames.set(nameKey, ath);
        }
      }
    }
  });

  let athletesResult = Array.from(seenNames.values());

  if (athletesResult.length > 197) {
    athletesResult = athletesResult.slice(0, 197);
  }

  return athletesResult;
}

export interface ValidationStats {
  totalPeserta: number;
  totalTarung: number;
  totalSeniGerak: number;
  tidakMengirimkan: number;
}

export function extractValidationStats(csvText: string): ValidationStats {
  const stats: ValidationStats = { totalPeserta: 197, totalTarung: 176, totalSeniGerak: 21, tidakMengirimkan: 0 };
  if (!csvText || !csvText.trim()) return stats;

  try {
    const lines = csvText.split('\n');
    lines.forEach((line) => {
      const parts = line.split(',').map((p) => p.replace(/^["']|["']$/g, '').trim());
      if (parts.length >= 3) {
        const label = parts[1]?.toUpperCase() || '';
        const value = parseInt(parts[2], 10);
        
        if (!isNaN(value)) {
          if (label === 'TOTAL PESERTA' || label.includes('TOTAL PESERTA')) stats.totalPeserta = value;
          else if (label === 'TOTAL ATLET TARUNG' || label.includes('ATLET TARUNG')) stats.totalTarung = value;
          else if (label === 'TOTAL ATLET SENI GERAK' || label.includes('SENI GERAK')) stats.totalSeniGerak = value;
          else if (label === 'TIDAK MENGIRIMKAN ATLET' || label.includes('TIDAK MENGIRIMKAN')) stats.tidakMengirimkan = value;
        }
      }
    });
  } catch (err) {}

  return stats;
}
