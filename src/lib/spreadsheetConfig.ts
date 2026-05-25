/**
 * Konfigurasi Spreadsheet untuk Sistem Informasi Kejuaraan KBB 2026
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
    gid: '', // KANG DEDE: ISI ANGKA GID DI SINI (Contoh: '123456789')
    category: 'udin',
    gender: 'PA',
    description: 'Usia Dini Putra'
  },
  {
    name: 'UDIN PI 5-1 SMP',
    gid: '', // ISI ANGKA GID DI SINI
    category: 'udin',
    gender: 'PI',
    description: 'Usia Dini Putri'
  },
  {
    name: 'PELAJAR PA 2 SMP- 1 SMA',
    gid: '', // ISI ANGKA GID DI SINI
    category: 'pelajar',
    gender: 'PA',
    description: 'Pelajar Putra'
  },
  {
    name: 'PELAJAR PI 2 SMP- 1 SMA',
    gid: '', // ISI ANGKA GID DI SINI
    category: 'pelajar',
    gender: 'PI',
    description: 'Pelajar Putri'
  },
  {
    name: 'PELAJAR PA 3 SMP- 2 SMA',
    gid: '', // ISI ANGKA GID DI SINI
    category: 'pelajar',
    gender: 'PA',
    description: 'Pelajar Putra Senior'
  },
  {
    name: 'PELAJAR PI 3 SMP- 2 SMA',
    gid: '', // ISI ANGKA GID DI SINI
    category: 'pelajar',
    gender: 'PI',
    description: 'Pelajar Putri Senior'
  },
  {
    name: 'UMUM PA KELAS 3 SMA - 29 THN',
    gid: '', // ISI ANGKA GID DI SINI
    category: 'umum',
    gender: 'PA',
    description: 'Umum Putra'
  },
  {
    name: 'UMUM PI KELAS 3 SMA - 29 THN',
    gid: '', // ISI ANGKA GID DI SINI
    category: 'umum',
    gender: 'PI',
    description: 'Umum Putri'
  },
  {
    name: 'ULOT',
    gid: '', // ISI ANGKA GID DI SINI
    category: 'ulot',
    gender: 'campuran',
    description: 'Kategori Usia Kolot'
  },
  {
    name: 'SENI GERAK UDIN,PELAJAR',
    gid: '', // ISI ANGKA GID DI SINI
    category: 'seni_gerak',
    gender: 'campuran',
    description: 'Seni Gerak'
  },
  
  // =======================================================
  // ⚠️ JIKA ADA TAB LAIN DI EXCEL, TAMBAHKAN DI BAWAH INI:
  // =======================================================
  /*
  {
    name: 'NAMA TAB BARU AKANG',
    gid: 'ANGKANYA',
    category: 'seni_gerak',
    gender: 'campuran',
    description: 'Tab Tambahan'
  },
  */
  
  {
    name: 'DATA HITUNGAN ATLET KEJURKAB',
    gid: '', 
    category: 'data',
    description: 'Data Rekap Manual'
  }
];

export async function fetchRawCsv(gidOrName: string): Promise<string> {
  let url = '';
  // Jika angka GID terisi, paksa gunakan GID agar tembus dari typo nama tab
  const isNumericGid = /^\d+$/.test(gidOrName);
  
  if (isNumericGid) {
    url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gidOrName}`;
  } else {
    url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(gidOrName)}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error status ${response.status}`);
    }
    return await response.text();
  } catch (err: any) {
    console.error(`Gagal menarik Sheet tab "${gidOrName}": Pastikan nama tab atau GID benar.`, err);
    return ""; // Kembalikan string kosong agar tab lain tetap jalan
  }
}
