export interface FileSystemNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileSystemNode[];
  description: string;
}

export const NEXTJS_FOLDER_STRUCTURE: FileSystemNode = {
  name: 'root_kejuaraan_kbb',
  type: 'directory',
  description: 'Akar dari proyek Next.js (App Router) + Tailwind CSS',
  children: [
    {
      name: 'app',
      type: 'directory',
      description: 'Directory inti App Router Next.js 14+',
      children: [
        {
          name: 'api',
          type: 'directory',
          description: 'Rute API backend internal',
          children: [
            {
              name: 'spreadsheet',
              type: 'directory',
              description: 'Endpoint sinkronisasi data',
              children: [
                {
                  name: 'route.ts',
                  type: 'file',
                  description: 'Mengambil & mem-proxy data CSV Google Sheets secara aman'
                }
              ]
            }
          ]
        },
        {
          name: 'atlet',
          type: 'directory',
          description: 'Halaman pengelolaan atlet',
          children: [
            {
              name: 'page.tsx',
              type: 'file',
              description: 'Daftar semua atlet se-KBB beserta fitur pencarian'
            },
            {
              name: '[id]',
              type: 'directory',
              description: 'Modul profil atlet dinamis',
              children: [
                {
                  name: 'page.tsx',
                  type: 'file',
                  description: 'Detail statistik, berat badan, kelas, & riwayat tanding atlet'
                }
              ]
            }
          ]
        },
        {
          name: 'pencarian',
          type: 'directory',
          description: 'Halaman Pencarian Atlet & Pengumuman Publik',
          children: [
            {
              name: 'page.js',
              type: 'file',
              description: 'Komponen Publik: Fitur Pencarian Atlet Kontras Tinggi & Manajemen Pengumuman'
            }
          ]
        },
        {
          name: 'login',
          type: 'directory',
          description: 'Halaman Login Panitia Resmi (Sistem Nama + PIN)',
          children: [
            {
              name: 'page.js',
              type: 'file',
              description: 'Komponen Autentikasi Panitia Kejurkab II KBB secara Case-Insensitive'
            }
          ]
        },
        {
          name: 'admin',
          type: 'directory',
          description: 'Akar dari Ruang Administrasi Terproteksi',
          children: [
            {
              name: 'dashboard',
              type: 'directory',
              description: 'Modul Dashboard Manajemen Panitia',
              children: [
                {
                  name: 'page.js',
                  type: 'file',
                  description: 'Dashboard Admin Utama: Sesi Timbang Badan, Rekomendasi Pergeseran Kelas, & Publikasi Pengumuman'
                }
              ]
            }
          ]
        },
        {
          name: 'satlat',
          type: 'directory',
          description: 'Modul Satuan Latihan (Satlat) se-KBB',
          children: [
            {
              name: 'page.tsx',
              type: 'file',
              description: 'Dashboard rekapitulasi jumlah kontingen per Satuan Latihan'
            }
          ]
        },
        {
          name: 'kejuaraan',
          type: 'directory',
          description: 'Manajemen bagan tanding & timbangan',
          children: [
            {
              name: 'timbang',
              type: 'directory',
              description: 'Sistem verifikasi berat badan atlet live',
              children: [
                {
                  name: 'page.tsx',
                  type: 'file',
                  description: 'Pencatatan timbangan atlet sebelum tanding secara presisi'
                }
              ]
            },
            {
              name: 'bagan',
              type: 'directory',
              description: 'Visualisasi bracket/bagan pertandingan',
              children: [
                {
                  name: 'page.tsx',
                  type: 'file',
                  description: 'Grafis bagan turnamen sistem gugur silsilah ganda/tunggal'
                }
              ]
            }
          ]
        },
        {
          name: 'layout.tsx',
          type: 'file',
          description: 'Layout utama (Root Layout) dengan navbar sporty, font Inter, & tracking global'
        },
        {
          name: 'page.tsx',
          type: 'file',
          description: 'Halaman dashboard utama / Beranda SIM Kejuaraan'
        },
        {
          name: 'globals.css',
          type: 'file',
          description: 'Impor Tailwind CSS v4 & variabel warna athletic (Hitam & Oranye)'
        }
      ]
    },
    {
      name: 'components',
      type: 'directory',
      description: 'Komponen UI mandiri & reusable',
      children: [
        {
          name: 'ui',
          type: 'directory',
          description: 'Elemen UI primitif (dapat menggunakan Shadcn standar)',
          children: [
            { name: 'button.tsx', type: 'file', description: 'Tombol interaktif dengan transisi halus' },
            { name: 'card.tsx', type: 'file', description: 'Bentuk kotak petak sporty untuk container' },
            { name: 'table.tsx', type: 'file', description: 'Tabel atlet adaptif dengan scroll horizontal' },
            { name: 'badge.tsx', type: 'file', description: 'Label penanda kelas tanding (PA/PI/UDIN)' }
          ]
        },
        {
          name: 'charts',
          type: 'directory',
          description: 'Komponen visualisasi data (Recharts / D3)',
          children: [
            { name: 'SatlatBarChart.tsx', type: 'file', description: 'Grafik batang komposisi atlet per Satlat KBB' }
          ]
        }
      ]
    },
    {
      name: 'lib',
      type: 'directory',
      description: 'Pustaka bantuan, parser, & konfigurasi',
      children: [
        {
          name: 'spreadsheetConfig.js',
          type: 'file',
          description: 'Daftar nama Tab sheet dan pemetaan GID Google Sheets asli'
        },
        {
          name: 'csvParser.js',
          type: 'file',
          description: 'Fungsi sanitasi & konversi CSV mentah ke format JSON terstruktur'
        }
      ]
    },
    {
      name: '.env.local',
      type: 'file',
      description: 'Penyimpanan aman Google API keys / database credentials (offline)'
    },
    {
      name: 'package.json',
      type: 'file',
      description: 'Definisi dependensi npm proyek'
    },
    {
      name: 'tailwind.config.js',
      type: 'file',
      description: 'Konfigurasi palet warna kustom (Hitam & Oranye Tarung Derajat)'
    }
  ]
};
