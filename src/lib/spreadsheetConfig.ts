/**
 * Konfigurasi Spreadsheet untuk Sistem Informasi & Manajemen Kejuaraan
 * Antar Satlat Tarung Derajat Kabupaten Bandung Barat (KBB)
 */

export const SPREADSHEET_ID = '1H2dRqsZqS4bPV7DyZwhTn-ebjhZbURnGAswUlBaEgfc';

export interface SpreadsheetTab {
  name: string;
  gid?: string;
  category: 'udin' | 'pelajar' | 'umum' | 'ulot' | 'seni_gerak' | 'data';
  gender?: 'PA' | 'PI' | 'campuran';
  description: string;
}

export const SPREADSHEET_TABS: SpreadsheetTab[] = [
  {
    name: 'UDIN PA 5-1 SMP',
    gid: '',
    category: 'udin',
    gender: 'PA',
    description: 'Kategori Usia Dini (Putra) Tingkat SD Kelas 5 sampai SMP Kelas 1'
  },
  {
    name: 'UDIN PI 5-1 SMP',
    gid: '',
    category: 'udin',
    gender: 'PI',
    description: 'Kategori Usia Dini (Putri) Tingkat SD Kelas 5 sampai SMP Kelas 1'
  },
  {
    name: 'PELAJAR PA 2 SMP- 1 SMA',
    gid: '',
    category: 'pelajar',
    gender: 'PA',
    description: 'Kategori Pelajar (Putra) Tingkat SMP Kelas 2 sampai SMA Kelas 1'
  },
  {
    name: 'PELAJAR PI 2 SMP- 1 SMA',
    gid: '',
    category: 'pelajar',
    gender: 'PI',
    description: 'Kategori Pelajar (Putri) Tingkat SMP Kelas 2 sampai SMA Kelas 1'
  },
  {
    name: 'PELAJAR PA 3 SMP- 2 SMA',
    gid: '',
    category: 'pelajar',
    gender: 'PA',
    description: 'Kategori Pelajar (Putra) Tingkat SMP Kelas 3 sampai SMA Kelas 2'
  },
  {
    name: 'PELAJAR PI 3 SMP- 2 SMA',
    gid: '',
    category: 'pelajar',
    gender: 'PI',
    description: 'Kategori Pelajar (Putri) Tingkat SMP Kelas 3 sampai SMA Kelas 2'
  },
  {
    name: 'UMUM PA KELAS 3 SMA - 29 THN',
    gid: '',
    category: 'umum',
    gender: 'PA',
    description: 'Kategori Umum (Putra) Tingkat SMA Kelas 3 sampai Usia 29 Tahun'
  },
  {
    name: 'UMUM PI KELAS 3 SMA - 29 THN',
    gid: '',
    category: 'umum',
    gender: 'PI',
    description: 'Kategori Umum (Putri) Tingkat SMA Kelas 3 sampai Usia 29 Tahun'
  },
  {
    name: 'ULOT',
    gid: '',
    category: 'ulot',
    gender: 'campuran',
    description: 'Kategori Tarung Bebas Usia Lanjut (Ulot)'
  },
  {
    name: 'SENI GERAK UDIN,PELAJAR',
    gid: '',
    category: 'seni_gerak',
    gender: 'campuran',
    description: 'Nomor Seni Gerak Kategori Usia Dini & Pelajar'
  },
  {
    name: 'SENI GERAK UMUM,ULOT',
    gid: '',
    category: 'seni_gerak',
    gender: 'campuran',
    description: 'Nomor Seni Gerak Kategori Umum & Ulot'
  },
  {
    name: 'DATA HITUNGAN ATLET KEJURKAB',
    gid: '1561323063',
    category: 'data',
    description: 'Rekapitulasi dan Analisis Hitungan Jumlah Atlet Kejurkab KBB'
  }
];

/**
 * Membuat URL ekspor CSV dari Google Sheets secara live.
 * Jika GID tersedia, gunakan format ekspor langsung.
 * Jika tidak tersedia, gunakan visualisasi query berdasarkan nama sheet.
 * 
 * @param tab Objek SpreadsheetTab yang ingin ditarik
 * @returns String URL Fetch
 */
export function getCSVUrl(tab: SpreadsheetTab): string {
  const cacheBuster = `&t=${Date.now()}`;
  if (tab.gid) {
    return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${tab.gid}${cacheBuster}`;
  }
  // Alternatif handal jika GID tidak dideklarasikan: ekspor tab berdasarkan nama sheet aslinya
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab.name)}${cacheBuster}`;
}

/**
 * Kerangka fungsi dasar fetchRawCsv menggunakan Fetch API live sesuai petunjuk
 * @param gid GID tab spreadsheet, atau nama dari sheet jika string biasa
 */
export async function fetchRawCsv(gidOrName: string): Promise<string> {
  let url = '';
  // Cek apakah input berupa GID murni (numeric) or Nama Sheet
  const isNumericGid = /^\d+$/.test(gidOrName);
  const cacheBuster = `&t=${Date.now()}`;
  
  if (isNumericGid) {
    url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gidOrName}${cacheBuster}`;
  } else {
    url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(gidOrName)}${cacheBuster}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error status ${response.status}`);
    }
    return await response.text();
  } catch (err: any) {
    console.error(`CORS / Network Error fetching Google Sheet tab "${gidOrName}":`, err);
    
    // Check if it's a typical network or CORS block
    let isCorsOrNetwork = false;
    if (err instanceof TypeError || (err.message && err.message.toLowerCase().includes('failed to fetch'))) {
      isCorsOrNetwork = true;
    }

    const errorDetails = isCorsOrNetwork 
      ? "Koneksi terhambat kebijakan keamanan browser (CORS) atau server Google Sheets tidak dapat dijangkau (Offline)."
      : (err.message || String(err));

    throw new Error(`[Spreadsheet Unreachable] Gagal memuat tab "${gidOrName}". ${errorDetails}`);
  }
}
