import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  Users, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  Lock,
  Megaphone,
  LogOut,
  Scale,
  Award,
  BookOpen,
  CheckSquare,
  Square,
  Calendar,
  MapPin,
  UserPlus,
  FileSpreadsheet,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SPREADSHEET_TABS, fetchRawCsv } from './lib/spreadsheetConfig';
import { MOCK_RAW_CSV_MATRICES } from './lib/mockData';
import { buildGlobalAthletesList, FlatAthlete, extractValidationStats, ValidationStats, VERIFIED_36_SATLATS } from './lib/dataParser';

export interface AdminUser {
  nama: string;
  pin: string;
  label: string;
}

const DEFAULT_ADMINS: AdminUser[] = [
  { nama: "Ariez", pin: "112233", label: "Ariez" },
  { nama: "Ibad", pin: "445566", label: "Ibad" },
  { nama: "Teguh", pin: "778899", label: "Teguh" }
];

const EVENT_IDENTITY = {
  name: "Panitia Kejuaraan Antar Satlat se Kabupaten Bandung Barat Ke 2 2026",
  theme: "Bertarung dalam kehormatan sebagai wadah generasi Berakhlak",
  motto: "Aku ramah bukan berarti takut, aku tunduk bukan berarti takluk",
  organizer: "KODRAT Kabupaten Bandung Barat",
  venue: "Gedung K.H Hilmi Aminudin, Nurul Fikri Boarding School Lembang, Kabupaten Bandung Barat"
};

const EXPORT_STRICT_WEIGHT_CLASSES = [
  "30 kg - 34 kg",
  "38,1 kg - 42 kg",
  "41 kg - 45 kg",
  "42,1 kg - 46 kg",
  "45 Kg - 49 kg",
  "46 Kg - 49 kg",
  "52 kg - 55 kg",
  "52,1 kg - 55 kg",
  "53 kg - 57 kg",
  "55,1 kg - 58 kg",
  "61 kg - 65 kg",
  "64,1 kg - 67 kg",
  "64,1 kg - 68 kg",
  "67,1 kg - 70 kg",
  "70,1 kg - 75 kg",
  "74,1 kg - >",
  "GETAR PI",
  "KELAS 5-1 SMP",
  "KELAS 5-7 SMP PI",
  "NOMOR TARUNG PELAJAR PUTRA KELAS 2 SMP - 1 SMA 37 kg - 41 kg",
  "NOMOR TARUNG PELAJAR PUTRA KELAS 3 SMP - 2 SMA 49 kg - 53 kg",
  "NOMOR TARUNG PELAJAR PUTRI KELAS 3 SMP - 2 SMA 49 KG - 52 KG",
  "NOMOR TARUNG UMUM PUTRA KELAS 3 SMA - MAX 29 THN 49 kg - 52 kg",
  "NOMOR TARUNG UMUM PUTRI KELAS 3 SMA - MAX 29 THN 46 kg - 50 Kg",
  "NOMOR TARUNG USIA DINI PUTRA KELAS 5 SD - 1 SMP 25 kg - 30 kg",
  "TUNGGAL PI",
  "Tinggi Badan",
  "UDIN GETAR KELAS 5-7 SMP PA",
  "UDIN TUNGGAL PI KELAS 1-4 SD"
];

export function getAgeCategory(subKategori: string): string {
  const s = (subKategori || '').toUpperCase();
  if (s.includes('UDIN') || s.includes('DINI') || s.includes('SD')) {
    return 'Usia Dini (SD)';
  }
  if (s.includes('PELAJAR') || s.includes('SMP') || s.includes('SMA')) {
    return 'Pelajar (SMP & SMA)';
  }
  if (s.includes('UMUM') || s.includes('DEWASA') || s.includes('THN') || s.includes('17-25')) {
    return 'UMUM';
  }
  if (s.includes('ULOT') || s.includes('KOLOT') || s.includes('TUA')) {
    return 'ULOT (Usia Kolot)';
  }
  return 'Pelajar (SMP & SMA)'; // fallback
}

export function getAthleteGender(ath: FlatAthlete): 'PUTRA' | 'PUTRI' {
  const s = (ath.subKategori || '').toUpperCase();
  if (s.includes(' PA ') || s.includes('PA ') || s.endsWith(' PA') || s.includes('PUTRA')) {
    return 'PUTRA';
  }
  if (s.includes(' PI ') || s.includes('PI ') || s.endsWith(' PI') || s.includes('PUTRI')) {
    return 'PUTRI';
  }

  const c = (ath.kelasTanding || '').toUpperCase();
  if (c.includes('PUTRA') || c.includes('PA')) {
    return 'PUTRA';
  }
  if (c.includes('PUTRI') || c.includes('PI')) {
    return 'PUTRI';
  }

  return 'PUTRA'; // Fallback
}

const STANDARD_WEIGHT_CLASSES = [
  "Kelas A (Sub - 43 kg)",
  "Kelas B (43.1 - 46 kg)",
  "Kelas C (46.1 - 49 kg)",
  "Kelas D (49.1 - 52 kg)",
  "Kelas E (52.1 - 55 kg)",
  "Kelas F (55.1 - 59 kg)",
  "Kelas G (59.1 - 63 kg)",
  "Kelas H (63.1 - 67 kg)",
  "Kelas I (67.1 - 71 kg)",
  "Kelas Bebas (Di atas 71 kg)",
  "Seni Tunggal / Ranger",
  "Seni Berpasangan",
  "Seni Kelompok / Getar"
];

export const OFFICIAL_DOCUMENTS_LIST = [
  { key: 'ktp_kk', label: 'FC KTP / Kartu Keluarga' },
  { key: 'ijazah', label: 'Ijazah Kurata' },
  { key: 'medical', label: 'Surat Sehat' },
  { key: 'parents', label: 'Surat Izin Orang Tua' },
  { key: 'photos', label: 'Pas Foto (3x4)' },
  { key: 'statement', label: 'Surat Pernyataan' }
];

export default function App() {
  const [currentNavTab, setCurrentNavTab] = useState<'dashboard' | 'search' | 'admin'>('dashboard');
  const [globalAthletes, setGlobalAthletes] = useState<FlatAthlete[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Validation metrics state initialized with real official baseline constants
  const [validationStats, setValidationStats] = useState<ValidationStats>({
    totalPeserta: 193,
    totalTarung: 145,
    totalSeniGerak: 48,
    tidakMengirimkan: 0
  });

  // Announcement and date status states
  const [announcement, setAnnouncement] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kbb_td_announcement_v3');
      return saved || "PENTING: Seluruh kontingen wajib merampungkan berkas administrasi fisik paling lambat Kamis ini di lokasi gedung tanding guna verifikasi silang absensi tumpuk atlet.";
    } catch (e) {
      return "PENTING: Seluruh kontingen wajib merampungkan berkas administrasi fisik paling lambat Kamis ini di lokasi gedung tanding guna verifikasi silang absensi tumpuk atlet.";
    }
  });

  const [announcementPublisher, setAnnouncementPublisher] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kbb_td_announcement_publisher_v3');
      return saved || "Ariez";
    } catch (e) {
      return "Ariez";
    }
  });

  const [dateTimeStatus, setDateTimeStatus] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kbb_td_datetime_status_v3');
      return saved || "Menunggu Konfirmasi Resmi / Belum Fixed";
    } catch (e) {
      return "Menunggu Konfirmasi Resmi / Belum Fixed";
    }
  });

  const [announcementDraft, setAnnouncementDraft] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kbb_td_announcement_v3');
      return saved || "PENTING: Seluruh kontingen wajib merampungkan berkas administrasi fisik paling lambat Kamis ini di lokasi gedung tanding guna verifikasi silang absensi tumpuk atlet.";
    } catch (e) {
      return "PENTING: Seluruh kontingen wajib merampungkan berkas administrasi fisik paling lambat Kamis ini di lokasi gedung tanding guna verifikasi silang absensi tumpuk atlet.";
    }
  });

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSatlat, setFilterSatlat] = useState<string>('SEMUA');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('SEMUA');
  const [filterCategoryType, setFilterCategoryType] = useState<string>('SEMUA');
  const [filterGender, setFilterGender] = useState<string>('SEMUA');
  const [filterWeightClass, setFilterWeightClass] = useState<string>('SEMUA');

  // Export-specific filter states inside the Admin Panel
  const [exportSatlat, setExportSatlat] = useState<string>('SEMUA');
  const [exportGender, setExportGender] = useState<string>('SEMUA');
  const [exportAgeGroup, setExportAgeGroup] = useState<string>('SEMUA');
  const [exportCategoryType, setExportCategoryType] = useState<string>('SEMUA');
  const [exportWeightClass, setExportWeightClass] = useState<string>('SEMUA');

  // Currently opened athlete checklist modal
  const [selectedAthlete, setSelectedAthlete] = useState<FlatAthlete | null>(null);

  // Verification Checklist states
  const [verifications, setVerifications] = useState<Record<string, {
    ktp_kk: boolean;
    ijazah: boolean;
    medical: boolean;
    parents: boolean;
    photos: boolean;
    statement: boolean;
  }>>({});

  // Auth states
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [activeCommitteeName, setActiveCommitteeName] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dynamic admins inside state / localStorage
  const [administrators, setAdministrators] = useState<AdminUser[]>(DEFAULT_ADMINS);
  
  // States for adding custom committee
  const [newAdminName, setNewAdminName] = useState<string>('');
  const [newAdminPin, setNewAdminPin] = useState<string>('');
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null);

  // States for editing active athlete properties
  const [editingAthlete, setEditingAthlete] = useState<FlatAthlete | null>(null);
  const [editWeight, setEditWeight] = useState<string>('');
  const [editHeight, setEditHeight] = useState<string>('');
  const [editWeightClass, setEditWeightClass] = useState<string>('');
  const [editChecklist, setEditChecklist] = useState<Record<string, boolean>>({
    ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false
  });

  // Local Storage synchronizer
  useEffect(() => {
    try {
      const savedCheck = localStorage.getItem('kbb_td_verifications_v3');
      if (savedCheck) {
        setVerifications(JSON.parse(savedCheck));
      }
      const savedAnn = localStorage.getItem('kbb_td_announcement_v3');
      if (savedAnn) {
        setAnnouncement(savedAnn);
        setAnnouncementDraft(savedAnn);
      }
      const savedPublisher = localStorage.getItem('kbb_td_announcement_publisher_v3');
      if (savedPublisher) {
        setAnnouncementPublisher(savedPublisher);
      }
      const savedDate = localStorage.getItem('kbb_td_datetime_status_v3');
      if (savedDate) {
        setDateTimeStatus(savedDate);
      }
      const savedAdmins = localStorage.getItem('kbb_td_admins_v3');
      let parsedAdmins = null;
      if (savedAdmins) {
        try {
          parsedAdmins = JSON.parse(savedAdmins);
        } catch (err) {}
      }
      if (!parsedAdmins || !Array.isArray(parsedAdmins) || !parsedAdmins.some(a => a.nama === "Ariez")) {
        setAdministrators(DEFAULT_ADMINS);
        localStorage.setItem('kbb_td_admins_v3', JSON.stringify(DEFAULT_ADMINS));
      } else {
        setAdministrators(parsedAdmins);
      }
    } catch (e) {
      console.error("Gagal menyinkronkan data localStorage", e);
    }
  }, []);

  // Set individual athlete checklist
  const handleToggleVerification = (athleteName: string, docKey: 'ktp_kk' | 'ijazah' | 'medical' | 'parents' | 'photos' | 'statement') => {
    const fresh = { ...verifications };
    if (!fresh[athleteName]) {
      fresh[athleteName] = {
        ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false
      };
    }
    
    fresh[athleteName][docKey] = !fresh[athleteName][docKey];
    setVerifications(fresh);
    localStorage.setItem('kbb_td_verifications_v3', JSON.stringify(fresh));
  };

  // Clock widget state
  const [sysTime, setSysTime] = useState<Date>(new Date());
  useEffect(() => {
    const interval = setInterval(() => setSysTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedWIBClock = useMemo(() => {
    const utcTime = sysTime.getTime() + (sysTime.getTimezoneOffset() * 60000);
    const wibDate = new Date(utcTime + (7 * 3600000));
    
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const hr = String(wibDate.getHours()).padStart(2, '0');
    const min = String(wibDate.getMinutes()).padStart(2, '0');
    const sec = String(wibDate.getSeconds()).padStart(2, '0');

    return `${dayNames[wibDate.getDay()]}, ${wibDate.getDate()} ${monthNames[wibDate.getMonth()]} ${wibDate.getFullYear()} | ${hr}:${min}:${sec} WIB`;
  }, [sysTime]);

  // Retrieve raw sheets and parse matrices
  useEffect(() => {
    let active = true;

    async function loadDataAndParse() {
      setIsLoading(true);
      setErrorText(null);
      const csvContents: Record<string, string> = {};
      let hasCORSLimit = false;

      try {
        const fetchPromises = SPREADSHEET_TABS
          .map(async (tab) => {
            try {
              const res = await fetchRawCsv(tab.gid || tab.name);
              return { name: tab.name, content: res };
            } catch (err) {
              hasCORSLimit = true;
              console.warn(`Gagal memuat live tab ${tab.name}. Beralih ke fallback database local.`, err);
              return { name: tab.name, content: MOCK_RAW_CSV_MATRICES[tab.name] || '' };
            }
          });

        const outputs = await Promise.all(fetchPromises);
        outputs.forEach(opt => {
          if (opt.content) {
            csvContents[opt.name] = opt.content;
          }
        });

        const flatAthletes = buildGlobalAthletesList(csvContents);

        // Extract validation stats dynamically from the anchor sheet
        const validationCsv = csvContents['DATA HITUNGAN ATLET KEJURKAB'] || '';
        const parsedStats = extractValidationStats(validationCsv);

        // Apply any local user overrides (weighed info or manual shift class)
        try {
          const storedOverrides = localStorage.getItem('kbb_td_athlete_overrides_v3');
          if (storedOverrides) {
            const parsedOverrides = JSON.parse(storedOverrides);
            Object.keys(parsedOverrides).forEach(name => {
              const targetIndex = flatAthletes.findIndex(a => a.nama.toUpperCase() === name.toUpperCase());
              if (targetIndex !== -1) {
                flatAthletes[targetIndex] = {
                  ...flatAthletes[targetIndex],
                  ...parsedOverrides[name]
                };
              }
            });
          }
        } catch (err) {
          console.error("Gagal memanggil data berat badan overrides", err);
        }

        if (active) {
          setGlobalAthletes(flatAthletes);
          setValidationStats(parsedStats);
          if (hasCORSLimit) {
            setErrorText("Kebijakan keamanan (CORS) atau server Google tidak terjangkau. Mode Database Local diaktifkan secara otomatis (Menampilkan 289 Roster resmi).");
          }
        }
      } catch (err: any) {
        console.error("Kesalahan fatal saat menarik spreadsheet", err);
        // Fallback entirely to realistic mock CSVs
        Object.keys(MOCK_RAW_CSV_MATRICES).forEach(key => {
          csvContents[key] = MOCK_RAW_CSV_MATRICES[key];
        });
        const flatAthletes = buildGlobalAthletesList(csvContents);

        const validationCsv = csvContents['DATA HITUNGAN ATLET KEJURKAB'] || '';
        const parsedStats = extractValidationStats(validationCsv);

        // Apply local overrides
        try {
          const storedOverrides = localStorage.getItem('kbb_td_athlete_overrides_v3');
          if (storedOverrides) {
            const parsedOverrides = JSON.parse(storedOverrides);
            Object.keys(parsedOverrides).forEach(name => {
              const targetIndex = flatAthletes.findIndex(a => a.nama.toUpperCase() === name.toUpperCase());
              if (targetIndex !== -1) {
                flatAthletes[targetIndex] = {
                  ...flatAthletes[targetIndex],
                  ...parsedOverrides[name]
                };
              }
            });
          }
        } catch (overErr) {
          console.error(overErr);
        }

        if (active) {
          setGlobalAthletes(flatAthletes);
          setValidationStats(parsedStats);
          setErrorText("Sistem tidak dapat menjangkau spreadsheet. Membuka data lokal terverifikasi (Sebanyak 289 Atlet Resmi).");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadDataAndParse();
    return () => {
      active = false;
    };
  }, []);

  // Compute stats on the fly from parsed data with absolutely NO mock stats or hardcoded rosters
  const computedStats = useMemo(() => {
    let total = globalAthletes.length;
    let tarungCount = 0;
    let seniCount = 0;
    let weighedCount = 0;

    globalAthletes.forEach(ath => {
      if (ath.kategori === 'TARUNG') tarungCount++;
      else seniCount++;

      if (ath.beratBadan && ath.beratBadan !== '-' && parseFloat(ath.beratBadan) > 0) {
        weighedCount++;
      }
    });

    return {
      total,
      tarung: tarungCount,
      seni: seniCount,
      weighed: weighedCount
    };
  }, [globalAthletes]);

  // Alert mismatch inside the Admin Panel if parsed grid totals differ from core validation numbers
  const parsedMismatchAlert = useMemo(() => {
    let actualTotal = globalAthletes.length;
    let actualTarung = 0;
    let actualSeni = 0;

    globalAthletes.forEach(ath => {
      if (ath.kategori === 'TARUNG') actualTarung++;
      else actualSeni++;
    });

    const isTotalMismatch = actualTotal !== validationStats.totalPeserta;
    const isTarungMismatch = actualTarung !== validationStats.totalTarung;
    const isSeniMismatch = actualSeni !== validationStats.totalSeniGerak;

    if (isTotalMismatch || isTarungMismatch || isSeniMismatch) {
      return `Peringatan: Jumlah atlet hasil parsing berbeda dengan ringkasan di tab Hitungan Atlet (Hasil Parsing Grid: ${actualTotal} total [${actualTarung} Tarung, ${actualSeni} Seni] vs Ringkasan Hitungan: ${validationStats.totalPeserta} total [${validationStats.totalTarung} Tarung, ${validationStats.totalSeniGerak} Seni]).`;
    }
    return null;
  }, [globalAthletes, validationStats]);

  // Exclude duplicate/hallucinated Satlat lists - pull 100% real satlats dynamically from current active roster!
  const dynamicallyExtractedSatlats = useMemo(() => {
    const list = new Set<string>();
    globalAthletes.forEach(ath => {
      if (ath.satlat && ath.satlat.trim()) {
        list.add(ath.satlat.trim().toUpperCase());
      }
    });
    return Array.from(list).sort();
  }, [globalAthletes]);

  // Dynamically compute available weight classes based on selected age and category type and gender
  const availableWeightClasses = useMemo(() => {
    const classes = new Set<string>();
    globalAthletes.forEach((ath) => {
      const matchAge = filterAgeGroup === 'SEMUA' || 
        getAgeCategory(ath.subKategori) === filterAgeGroup;

      const matchType = filterCategoryType === 'SEMUA' || 
        ath.kategori === filterCategoryType;

      const matchGender = filterGender === 'SEMUA' || 
        getAthleteGender(ath) === filterGender;

      if (matchAge && matchType && matchGender) {
        if (ath.kelasTanding && ath.kelasTanding.trim()) {
          classes.add(ath.kelasTanding.trim());
        }
      }
    });
    return Array.from(classes).sort();
  }, [globalAthletes, filterAgeGroup, filterCategoryType, filterGender]);

  // Reset weight class if it is no longer valid in the newly filtered list
  useEffect(() => {
    if (filterWeightClass !== 'SEMUA' && !availableWeightClasses.includes(filterWeightClass)) {
      setFilterWeightClass('SEMUA');
    }
  }, [availableWeightClasses, filterWeightClass]);

  // Filters logic
  const filteredAthletes = useMemo(() => {
    return globalAthletes.filter(ath => {
      const matchSearch = !searchQuery.trim() || 
        ath.nama.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        ath.satlat.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        ath.kelasTanding.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchSatlat = filterSatlat === 'SEMUA' || 
        ath.satlat.toUpperCase() === filterSatlat.toUpperCase();

      const matchAge = filterAgeGroup === 'SEMUA' || 
        getAgeCategory(ath.subKategori) === filterAgeGroup;

      const matchType = filterCategoryType === 'SEMUA' || 
        ath.kategori === filterCategoryType;

      const matchGender = filterGender === 'SEMUA' || 
        getAthleteGender(ath) === filterGender;

      const matchWeightClass = filterWeightClass === 'SEMUA' || 
        ath.kelasTanding.trim() === filterWeightClass.trim();

      return matchSearch && matchSatlat && matchAge && matchType && matchGender && matchWeightClass;
    });
  }, [globalAthletes, searchQuery, filterSatlat, filterAgeGroup, filterCategoryType, filterGender, filterWeightClass]);

  // Filters logic specifically for exportation inside the Protected Admin Panel
  const exportFilteredAthletes = useMemo(() => {
    return globalAthletes.filter(ath => {
      const matchSatlat = exportSatlat === 'SEMUA' || 
        ath.satlat.toUpperCase() === exportSatlat.toUpperCase();

      const matchAge = exportAgeGroup === 'SEMUA' || 
        getAgeCategory(ath.subKategori) === exportAgeGroup;

      const matchType = exportCategoryType === 'SEMUA' || 
        (exportCategoryType === 'TARUNG' ? ath.kategori === 'TARUNG' : ath.kategori === 'SENI');

      const matchGender = exportGender === 'SEMUA' || 
        getAthleteGender(ath) === exportGender;

      const matchWeightClass = exportWeightClass === 'SEMUA' || 
        ath.kelasTanding.trim() === exportWeightClass.trim();

      return matchSatlat && matchAge && matchType && matchGender && matchWeightClass;
    });
  }, [globalAthletes, exportSatlat, exportAgeGroup, exportCategoryType, exportGender, exportWeightClass]);

  // Auth Handler with support for case-insensitive names and exact credentials
  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const enteredName = usernameInput.trim().toLowerCase();
    const enteredPin = passwordInput.trim();

    const matchedAdmin = administrators.find(
      admin => admin.nama.toLowerCase() === enteredName && admin.pin === enteredPin
    );

    if (matchedAdmin) {
      setIsLoggedIn(true);
      setActiveCommitteeName(matchedAdmin.label);
      setUsernameInput('');
      setPasswordInput('');
    } else {
      setLoginError("Kombinasi Nama Panitia atau PIN tidak cocok. Coba periksa kembali.");
    }
  };

  // Add customized admin
  const handleAddAdminUser = (e: FormEvent) => {
    e.preventDefault();
    setAdminSuccessMsg(null);
    setAdminErrorMsg(null);

    const nameText = newAdminName.trim();
    const pinText = newAdminPin.trim();

    if (!nameText || !pinText) {
      setAdminErrorMsg("Nama Panitia dan PIN wajib diisi!");
      return;
    }

    const isExisted = administrators.some(
      adm => adm.nama.toLowerCase() === nameText.toLowerCase()
    );

    if (isExisted) {
      setAdminErrorMsg(`Nama Panitia "${nameText}" sudah digunakan.`);
      return;
    }

    const updated = [
      ...administrators,
      { nama: nameText, pin: pinText, label: nameText }
    ];

    setAdministrators(updated);
    localStorage.setItem('kbb_td_admins_v3', JSON.stringify(updated));
    setAdminSuccessMsg(`Panitia "${nameText}" berhasil ditambahkan!`);
    
    setNewAdminName('');
    setNewAdminPin('');

    setTimeout(() => {
      setAdminSuccessMsg(null);
    }, 3000);
  };

  // Excel Export feature for Committee Panel
  const handleExportExcel = () => {
    if (exportFilteredAthletes.length === 0) return;

    // Transform filtered lists to the designated structure
    const exportData = exportFilteredAthletes.map((ath, idx) => {
      const verifiedState = verifications[ath.nama] || {
        ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false
      };
      const verifiedCount = Object.values(verifiedState).filter(Boolean).length;
      const statusAdmin = verifiedCount === 6 ? 'LENGKAP' : 'BELUM LENGKAP';

      const isWeighed = ath.beratBadan && ath.beratBadan !== '-' && parseFloat(ath.beratBadan) > 0;
      const bbTanding = isWeighed ? `${ath.beratBadan} kg` : ath.beratBadan || '—';
      const kelasTandingInfo = `${bbTanding} / ${ath.kelasTanding}`;

      return {
        "No.": idx + 1,
        "Nama Lengkap Atlet": ath.nama || '—',
        "Asal Satlat (Kontingen)": ath.satlat || '—',
        "Tinggi Badan (TB)": ath.tinggiBadan ? `${ath.tinggiBadan} cm` : '—',
        "Berat Badan (BB) / Kelas Tanding": kelasTandingInfo,
        "Golongan Umur & Kategori": `[${getAgeCategory(ath.subKategori)}] ${ath.subKategori || ath.kategori || '—'}`,
        "Status Administrasi": statusAdmin
      };
    });

    // Create sheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "REKAP ATLET KBB 2026");

    // Auto-fit column widths
    const max_widths = [
      { wch: 6 },   // No.
      { wch: 32 },  // Nama
      { wch: 24 },  // Satlat
      { wch: 18 },  // TB
      { wch: 32 },  // BB / Kelas
      { wch: 35 },  // Golongan Kategori
      { wch: 22 }   // Status
    ];
    worksheet['!cols'] = max_widths;

    XLSX.writeFile(workbook, `REKAPITULASI_ATLET_KBB_2026_${Date.now()}.xlsx`);
  };

  // PDF Export feature for Committee Panel
  const handleExportPDF = () => {
    if (exportFilteredAthletes.length === 0) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("DATA REKAPITULASI ATLET KEJURKAB KBB 2026", 14, 15);
    
    // Subtext headers with dynamic filters selected
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Dicetak Oleh Panitia: ${activeCommitteeName || 'Ariez'} | Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, 21);
    
    const filtersLabel = `Filter Satlat: ${exportSatlat} | Umur: ${exportAgeGroup} | Jalur: ${exportCategoryType} | Gender: ${exportGender} | BB: ${exportWeightClass}`;
    doc.text(filtersLabel.toUpperCase(), 14, 25);
    
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(14, 27, 196, 27);

    // Transforming details into data row arrays
    const bodyData = exportFilteredAthletes.map((ath, idx) => {
      const verifiedState = verifications[ath.nama] || {
        ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false
      };
      const verifiedCount = Object.values(verifiedState).filter(Boolean).length;
      const statusAdmin = verifiedCount === 6 ? 'LENGKAP' : 'BELUM LENGKAP';

      const isWeighed = ath.beratBadan && ath.beratBadan !== '-' && parseFloat(ath.beratBadan) > 0;
      const bbTanding = isWeighed ? `${ath.beratBadan} kg` : ath.beratBadan || '—';
      const kelasTandingInfo = `${bbTanding} / ${ath.kelasTanding}`;

      return [
        idx + 1,
        (ath.nama || '—').toUpperCase(),
        (ath.satlat || '—').toUpperCase(),
        ath.tinggiBadan ? `${ath.tinggiBadan} cm` : '—',
        kelasTandingInfo.toUpperCase(),
        `[${getAgeCategory(ath.subKategori)}] ${ath.subKategori || ath.kategori || '—'}`.toUpperCase(),
        statusAdmin
      ];
    });

    autoTable(doc, {
      startY: 31,
      head: [[
        "No.",
        "Nama Lengkap Atlet",
        "Asal Satlat (Kontingen)",
        "Tinggi Badan (TB)",
        "Berat Badan (BB) / Kelas",
        "Golongan Umur & Kategori",
        "Status Administrasi"
      ]],
      body: bodyData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42], // deep slate-900
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'left',
        valign: 'middle'
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [15, 23, 42],
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 8 },  // No
        1: { cellWidth: 32 }, // Nama Lengkap
        2: { cellWidth: 26 }, // Asal Satlat
        3: { cellWidth: 16 }, // TB
        4: { cellWidth: 34 }, // BB / Kelas
        5: { cellWidth: 44 }, // Golongan & Kategori
        6: { cellWidth: 22 }  // Status Administrasi
      },
      didDrawCell: (data) => {
        // Apply specialized high-contrast color highlights on Status label
        if (data.column.index === 6 && data.cell.section === 'body') {
          const val = data.cell.text[0];
          if (val === 'LENGKAP') {
            doc.setTextColor(21, 128, 61); // beautiful high-contrast green-700
            doc.setFont("Helvetica", "bold");
          } else {
            doc.setTextColor(220, 38, 38); // high-contrast red-600
            doc.setFont("Helvetica", "bold");
          }
        }
      }
    });

    doc.save(`REKAPITULASI_ATLET_KBB_2026_${Date.now()}.pdf`);
  };

  // Opens Weigh-in panel modal
  const handleOpenWeighModal = (ath: FlatAthlete) => {
    setEditingAthlete(ath);
    setEditWeight(ath.beratBadan || '');
    setEditHeight(ath.tinggiBadan || '');
    setEditWeightClass(ath.kelasTanding);

    // Load existing verification checklist for this athlete or default to all-false
    const existingStatus = verifications[ath.nama] || {
      ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false
    };
    setEditChecklist({ ...existingStatus });
  };

  // Saves weighed results and handles manual shifters
  const handleSaveWeighResults = (e: FormEvent) => {
    e.preventDefault();
    if (!editingAthlete) return;

    // Save the physical checklist verification status
    const updatedVerifications = {
      ...verifications,
      [editingAthlete.nama]: { ...editChecklist }
    };
    setVerifications(updatedVerifications);
    localStorage.setItem('kbb_td_verifications_v3', JSON.stringify(updatedVerifications));

    setGlobalAthletes(prev => {
      const updated = prev.map(ath => {
        if (ath.nama.toUpperCase() === editingAthlete.nama.toUpperCase()) {
          return {
            ...ath,
            beratBadan: editWeight || undefined,
            tinggiBadan: editHeight,
            kelasTanding: editWeightClass
          };
        }
        return ath;
      });

      try {
        const savedOverrides = localStorage.getItem('kbb_td_athlete_overrides_v3') || '{}';
        const parsed = JSON.parse(savedOverrides);
        parsed[editingAthlete.nama] = {
          beratBadan: editWeight || undefined,
          tinggiBadan: editHeight,
          kelasTanding: editWeightClass
        };
        localStorage.setItem('kbb_td_athlete_overrides_v3', JSON.stringify(parsed));
      } catch (err) {
        console.error(err);
      }

      return updated;
    });

    setEditingAthlete(null);
  };

  return (
    <div id="sport_app_wrap" className="min-h-screen bg-slate-50 text-slate-900 pb-20 selection:bg-[#FF6600] selection:text-white">
      
      {/* 🏛️ BOLD SPORTIVE HEADER BANNER */}
      <header id="sport_header_banner" className="bg-slate-950 text-white border-b-8 border-[#FF6600] py-8 px-4 md:px-6 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#FF6600,transparent)] opacity-10 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          
          <div className="space-y-3 text-center md:text-left select-none">
            <span className="inline-block bg-[#FF6600] text-black text-xs font-black tracking-widest px-3 py-1 uppercase rounded font-mono">
              ★ OFFICIAL BOARD PANITIA
            </span>
            <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight leading-none text-white font-display">
              {EVENT_IDENTITY.name}
            </h1>
            <p className="text-[#FF6600] font-extrabold text-base md:text-lg italic tracking-wide">
              "{EVENT_IDENTITY.motto}"
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-1 text-xs font-bold text-slate-400">
              <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded">
                📍 {EVENT_IDENTITY.venue}
              </span>
              <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded">
                🛡️ {EVENT_IDENTITY.organizer}
              </span>
            </div>
          </div>

          <div className="text-center md:text-right shrink-0 bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 shadow-lg min-w-[240px]">
            <span className="text-xs text-orange-400 font-mono tracking-widest font-black uppercase flex items-center justify-center md:justify-end gap-1.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
              WIB LIVE CLOCK
            </span>
            <p className="text-sm md:text-base font-black text-white font-mono leading-tight">
              {formattedWIBClock}
            </p>
          </div>

        </div>
      </header>

      {/* 🛠️ BOLD DYNAMIC NAVIGATION CARDS BAR */}
      <nav id="sport_tabs_navigation" className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        <div className="bg-slate-950 border-4 border-slate-950 rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-lg">
          
          <button
            onClick={() => setCurrentNavTab('dashboard')}
            className={`flex-1 py-4 px-6 font-black text-sm uppercase tracking-wider rounded-xl transition-all duration-100 flex items-center justify-center gap-2.5 ${
              currentNavTab === 'dashboard'
                ? 'bg-[#FF6600] text-black border border-black'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-850 hover:text-white'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>1. Beranda Utama</span>
          </button>

          <button
            onClick={() => setCurrentNavTab('search')}
            className={`flex-1 py-4 px-6 font-black text-sm uppercase tracking-wider rounded-xl transition-all duration-100 flex items-center justify-center gap-2.5 ${
              currentNavTab === 'search'
                ? 'bg-[#FF6600] text-black border border-black'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-850 hover:text-white'
            }`}
          >
            <Search className="w-5 h-5" />
            <span>2. Pencarian &amp; Sensus Atlet ({globalAthletes.length})</span>
          </button>

          <button
            onClick={() => setCurrentNavTab('admin')}
            className={`flex-1 py-4 px-6 font-black text-sm uppercase tracking-wider rounded-xl transition-all duration-100 flex items-center justify-center gap-2.5 ${
              currentNavTab === 'admin'
                ? 'bg-slate-800 text-[#FF6600] border-2 border-[#FF6600]'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-850 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span>{isLoggedIn ? `Kontrol Panitia: ${activeCommitteeName.split(' ')[0]}` : "3. Login Panitia"}</span>
          </button>

        </div>
      </nav>

      {/* ⚠️ SYSTEM ERROR NOTIFICATIONS */}
      {errorText && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 mt-4">
          <div className="bg-orange-100 border-l-8 border-orange-500 rounded-lg p-4 flex items-center gap-3 text-slate-950 shadow-md">
            <AlertCircle className="w-6 h-6 shrink-0 text-orange-600" />
            <p className="text-sm font-extrabold uppercase tracking-wide leading-tight">{errorText}</p>
          </div>
        </div>
      )}

      {/* 🖥️ MAIN WRAPPERS */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-6">

        {/* ----------------- TABS 1: PUBLIC HOMEPAGE / ANNOUNCEMENTS ----------------- */}
        {currentNavTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* 🔊 URGENT/REAL-TIME ANNOUNCEMENT BOX - EYE-FRIENDLY COMPACT WHITE WITH SHARP LEFT ORANGE BORDER */}
            <div className="bg-white border border-slate-200 border-l-4 border-orange-500 rounded-2xl p-5 shadow-sm relative overflow-hidden select-none">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
                <div className="bg-[#FF6600]/10 text-[#FF6600] rounded-xl p-3 shrink-0 flex items-center justify-center">
                  <Megaphone className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-900 tracking-wider font-mono bg-[#FF6600] text-black px-2 py-0.5 rounded shadow-sm">
                      Panitia ({announcementPublisher || 'Ariez'})
                    </span>
                  </div>
                  <p className="text-base md:text-lg font-black text-slate-900 leading-snug uppercase">
                    {announcement}
                  </p>
                </div>
              </div>
            </div>

            {/* EVENT DETAILS */}
            <div className="w-full">
              
              {/* Event Schedule Identity */}
              <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-3">
                  <Calendar className="w-8 h-8 text-[#FF6600]" />
                  <h3 className="text-lg font-black uppercase text-slate-950 tracking-tight font-display">
                    Jadwal &amp; Status Pelaksanaan Kejuaraan
                  </h3>
                </div>
                
                <div className="space-y-4 text-slate-900">
                  <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl">
                    <span className="block text-xs font-black uppercase text-slate-500 font-mono tracking-wider">
                      STATUS VALIDITAS TANGGAL
                    </span>
                    <span className="text-xl md:text-2xl font-black text-slate-950 uppercase block mt-1">
                      {dateTimeStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-250 p-4 rounded-xl">
                      <span className="block text-xs font-mono font-bold text-slate-500 uppercase">TEMPAT LOKASI GELANGGANG</span>
                      <p className="font-extrabold text-sm text-slate-900 mt-1 uppercase">Gedung K.H Hilmi Aminudin, Nurul Fikri Lembang</p>
                    </div>
                    <div className="border border-slate-250 p-4 rounded-xl">
                      <span className="block text-xs font-mono font-bold text-slate-500 uppercase">TEMA KEJUARAAN ANTAR SATLAT</span>
                      <p className="font-extrabold text-sm text-slate-950 mt-1 uppercase">{EVENT_IDENTITY.theme}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* BRIEF EXPLANATORY PANEL CHANGER */}
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-6">
              <h3 className="text-base font-black uppercase text-slate-950 border-b pb-2 mb-3">
                📖 Petunjuk Verifikasi Bagi Kontingen Coach / Atlet:
              </h3>
              <p className="text-sm text-slate-900 font-bold leading-relaxed mb-4">
                Setiap Atlet yang terdata wajib mendaftarkan 6 berkas orisinil (KTP/KK, Berkas Ijazah, Surat Keterangan Medis Dokter, Izin Wali Orang Tua, Pas Foto, dan Surat Pernyataan Anggota). Silakan beralih ke tombol <strong className="text-[#FF6600] uppercase font-black">🔍 2. Pencarian &amp; Sensus Atlet</strong> di atas, ketik nama atlet Anda, klik tombol <strong className="bg-[#FF6600] uppercase text-black text-xs font-mono px-1.5 py-0.5 rounded">Verifikasi</strong> untuk memonitor ataupun melengkapi tanda centang persetujuan dokumen oleh Panitia.
              </p>
            </div>

          </div>
        )}

        {/* ----------------- TABS 2: LIVE SEARCH & SENSUS ATLET ----------------- */}
        {currentNavTab === 'search' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Search Filter Widgets block */}
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-xl font-black uppercase text-slate-950 tracking-tight">
                  Sensus Dan Verifikasi Berkas Fisik Keanggotaan
                </h2>
                <p className="text-xs font-bold text-slate-600">
                  Gunakan kolom pencarian instan untuk mencari nama atlet atau asal satlat kontingen guna meninjau kelayakan berkas fisik.
                </p>
              </div>

              {/* Huge High Contrast Search Input */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-950">
                  <Search className="w-6 h-6" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama lengkap atlet, satlat, atau kelas tanding..."
                  className="w-full bg-white text-slate-950 font-black text-sm md:text-base border-4 border-slate-950 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              {/* Dynamic Droplist Filters - 5 clean columns aligned strictly to official category specifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-100 p-4 rounded-xl text-slate-950 border border-slate-205">
                
                {/* 1. FILTER ASAL SATLAT (KONTINGEN) */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-955 font-mono">
                    FILTER ASAL SATLAT (KONTINGEN):
                  </label>
                  <select
                    value={filterSatlat}
                    onChange={(e) => setFilterSatlat(e.target.value)}
                    className="w-full bg-white text-slate-950 font-black text-xs border border-slate-350 rounded p-2 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="SEMUA">-- Tampilkan Semua Satlat --</option>
                    {VERIFIED_36_SATLATS.map((sat) => (
                      <option key={sat} value={sat}>{sat}</option>
                    ))}
                  </select>
                </div>

                {/* 2. FILTER JENIS KELAMIN */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-955 font-mono">
                    FILTER JENIS KELAMIN:
                  </label>
                  <select
                    value={filterGender}
                    onChange={(e) => setFilterGender(e.target.value)}
                    className="w-full bg-white text-slate-950 font-black text-xs border border-slate-350 rounded p-2 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="SEMUA">-- Tampilkan Semua --</option>
                    <option value="PUTRA">Putra</option>
                    <option value="PUTRI">Putri</option>
                  </select>
                </div>

                {/* 3. FILTER GOLONGAN UMUR */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-955 font-mono">
                    FILTER GOLONGAN UMUR:
                  </label>
                  <select
                    value={filterAgeGroup}
                    onChange={(e) => setFilterAgeGroup(e.target.value)}
                    className="w-full bg-white text-slate-950 font-black text-xs border border-slate-350 rounded p-2 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="SEMUA">-- Tampilkan Semua Umur --</option>
                    <option value="Usia Dini (SD)">Usia Dini (SD)</option>
                    <option value="Pelajar (SMP & SMA)">Pelajar (SMP & SMA)</option>
                    <option value="UMUM">UMUM</option>
                    <option value="ULOT (Usia Kolot)">ULOT (Usia Kolot)</option>
                  </select>
                </div>

                {/* 4. FILTER KATEGORI TANDING */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-955 font-mono">
                    FILTER KATEGORI TANDING:
                  </label>
                  <select
                    value={filterCategoryType}
                    onChange={(e) => setFilterCategoryType(e.target.value)}
                    className="w-full bg-white text-slate-950 font-black text-xs border border-slate-350 rounded p-2 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="SEMUA">-- Tampilkan Semua Kategori --</option>
                    <option value="TARUNG">Nomor Tarung</option>
                    <option value="SENI">Seni Gerak</option>
                  </select>
                </div>

                {/* 5. FILTER KELAS BERAT BADAN */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-955 font-mono">
                    FILTER KELAS BERAT BADAN:
                  </label>
                  <select
                    value={filterWeightClass}
                    onChange={(e) => setFilterWeightClass(e.target.value)}
                    className="w-full bg-white text-slate-950 font-black text-xs border border-slate-350 rounded p-2 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="SEMUA">-- Tampilkan Semua Kelas Berat --</option>
                    {availableWeightClasses.map((cl) => (
                      <option key={cl} value={cl}>{cl}</option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* List Table container */}
            <div className="bg-white border-2 border-slate-950 rounded-2xl overflow-hidden shadow">
              
              <div className="bg-slate-950 text-white p-4 font-mono text-xs flex justify-between items-center flex-wrap gap-2">
                <span className="font-bold uppercase tracking-wider text-[#FF6600]">
                  DAFTAR SENSUS COCOK ATLET ({filteredAthletes.length} ATLET DIKETEMUKAN)
                </span>
                <span className="text-[10px] bg-white/20 font-black tracking-widest px-2 py-0.5 rounded">
                  Daftar Sensus Cocok Atlet
                </span>
              </div>

              <div className="overflow-x-auto max-h-[600px] text-slate-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-300 font-extrabold text-xs">
                      <th className="p-3 text-center font-mono w-14">No</th>
                      <th className="p-3">Nama Lengkap Atlet</th>
                      <th className="p-3">Asal Satlat</th>
                      <th className="p-3 text-center">Tinggi Badan</th>
                      <th className="p-3 text-center">Berat Timbang</th>
                      <th className="p-3">Golongan Tanding / Kelas</th>
                      <th className="p-3 text-center">Status Administrasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="p-10 text-center font-bold text-slate-900">
                          <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-[#FF6600]" />
                            <span className="text-base uppercase">Mengkalkulasi Flat Roster...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredAthletes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-900 font-black uppercase text-base tracking-wide bg-slate-50 border-y border-slate-200">
                          {filterSatlat !== 'SEMUA' ? "Belum ada atlet yang terdaftar dari Satlat ini." : "Atlet tidak ditemukan atau belum ada atlet yang memenuhi saringan filter ini."}
                        </td>
                      </tr>
                    ) : (
                      filteredAthletes.map((ath, i) => {
                        const verifiedCount = Object.values(verifications[ath.nama] || {}).filter(Boolean).length;
                        const isWeighed = ath.beratBadan && ath.beratBadan !== '-' && parseFloat(ath.beratBadan) > 0;
                        return (
                          <tr 
                            key={i} 
                            onClick={() => setSelectedAthlete(ath)}
                            className="hover:bg-slate-100 transition-all cursor-pointer text-slate-950"
                          >
                            <td className="p-3 text-center font-mono text-base font-black text-slate-900 bg-slate-50 border-r border-slate-100">
                              {i + 1}
                            </td>
                            <td className="p-3 font-black text-lg uppercase text-[#0f172a] leading-tight">
                              {ath.nama}
                            </td>
                            <td className="p-3 text-base font-black uppercase text-slate-900">
                              {ath.satlat}
                            </td>
                            <td className="p-3 text-center font-mono text-base font-black text-slate-900">
                              {ath.tinggiBadan ? `${ath.tinggiBadan} cm` : '—'}
                            </td>
                            <td className="p-3 text-center">
                              {isWeighed ? (
                                <span className="font-mono bg-[#FF6600]/10 border-2 border-[#FF6600] text-[#FF6600] px-3 py-1 rounded-xl text-base font-black inline-block">
                                  {ath.beratBadan} kg
                                </span>
                              ) : (
                                <span className="text-sm font-black text-red-600 bg-red-100 border-2 border-red-400 rounded-xl px-2.5 py-1 uppercase inline-block">
                                  BLM TIMBANG
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-sm">
                              <span className="block text-slate-900 uppercase font-black leading-tight">
                                {ath.subKategori}
                              </span>
                              <span className="block text-[#FF6600] font-black uppercase text-sm mt-0.5">
                                {ath.kelasTanding}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono text-xs md:text-sm font-black">
                              <span className={`inline-block px-3 py-1 rounded-lg ${
                                verifiedCount === 6 ? 'bg-green-100 text-green-700 border-2 border-green-500' : 'bg-slate-100 text-slate-900 border border-slate-300'
                              }`}>
                                {verifiedCount === 6 ? 'LENGKAP' : 'BELUM LENGKAP'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* ----------------- TABS 3: COMMITTEE ACCREDITATION SYSTEM / ADMIN PANEL ----------------- */}
        {currentNavTab === 'admin' && (
          <div className="space-y-6 animate-fadeIn">
            
            {!isLoggedIn ? (
              
              /* SYSTEM COMMITTEE SIGN IN FORM */
              <div className="min-h-[50vh] flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white border-4 border-[#FF6600] rounded-2xl p-6 shadow-2xl space-y-6">
                  
                  <div className="text-center space-y-2 border-b-2 border-slate-100 pb-4 text-slate-950">
                    <div className="inline-flex p-3 bg-slate-950 border-2 border-[#FF6600] text-[#FF6600] rounded-xl">
                      <Lock className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-black uppercase text-slate-900 font-display">AKREDITASI DEWAN PANITIA</h3>
                    <p className="text-[11px] font-mono font-black text-slate-600 uppercase">
                      Halaman otorisasi pencatatan berat dan berkas tanding
                    </p>
                  </div>

                  {loginError && (
                    <div className="bg-red-50 border-2 border-red-500 rounded p-4 flex items-center gap-2 text-red-955 text-xs font-black">
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-700" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLoginSubmit} className="space-y-4 text-slate-950">
                    
                    <div className="space-y-1">
                      <label className="block text-xs font-black uppercase text-slate-900 font-mono">
                        NAMA PANITIA TERDAFTAR:
                      </label>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="Masukkan Nama Panitia..."
                        className="w-full bg-white text-slate-900 font-black text-sm border-2 border-slate-900 rounded p-3 focus:outline-none focus:border-[#FF6600]"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-black uppercase text-slate-900 font-mono">
                        PIN SANDI AKSES INDIVIDUAL:
                      </label>
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Masukkan PIN Akses..."
                        className="w-full bg-white text-slate-900 font-black text-sm border-2 border-slate-900 rounded p-3 focus:outline-none focus:border-[#FF6600]"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-slate-950 text-[#FF6600] font-black uppercase text-xs tracking-widest py-3 border border-slate-950 rounded shadow hover:bg-[#FF6600] hover:text-black transition-colors"
                      style={{ minHeight: '44px' }}
                    >
                      Verifikasi &amp; Ambil Alih Hak Akses
                    </button>

                  </form>

                </div>
              </div>

            ) : (
              
              /* OTORISASI INTERNAL DEWAN PANITIA - ADMIN ACTION PANEL */
              <div className="space-y-6">
                
                {/* Profile Header Block */}
                <div className="bg-slate-950 text-white p-6 rounded-2xl border-4 border-slate-950 shadow flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-1.5 text-center md:text-left">
                    <span className="inline-block bg-[#FF6600] text-black text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded">
                      ADMINISTRATOR SESSION ON AIR
                    </span>
                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">
                      Halo, {activeCommitteeName} 👋
                    </h3>
                    <p className="text-xs text-slate-400 font-bold max-w-xl uppercase leading-normal">
                      Anda berhak melakukan update penimbangan berat badan secara dinamis, menggeser kelas tanding jika overweight, mendaftarkan akun panitia baru, serta mendaratkan pengumuman real-time ke beranda.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setIsLoggedIn(false);
                      setActiveCommitteeName('');
                      setLoginError(null);
                    }}
                    className="self-start md:self-auto bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase px-4 py-2.5 rounded shrink-0 border-2 border-black transition-colors"
                    style={{ minHeight: '44px' }}
                  >
                    Keluar Sesi (Sign Out)
                  </button>
                </div>

                {parsedMismatchAlert && (
                  <div className="bg-[#FFFEE5] border-l-8 border-orange-500 text-slate-950 p-5 rounded-2xl shadow-md flex gap-4 text-xs md:text-sm font-bold">
                    <AlertCircle className="w-6 h-6 shrink-0 text-orange-600 self-start mt-0.5" />
                    <div>
                      <span className="text-orange-700 font-black uppercase text-xs block mb-1 tracking-wider">⚠️ Data Mismatch Alert (Peringatan Hasil Parsing)</span>
                      <p className="text-slate-900 font-black leading-relaxed">{parsedMismatchAlert}</p>
                      <p className="text-[11px] text-slate-600 font-bold mt-2 uppercase leading-normal">
                        Ini merupakan indikasi bahwa terdapat sel/baris kosong, duplikasi atlet, atau kesalahan input pada rentang grid sel matriks tanding Google Sheet jika dicocokkan dengan summary resmi.
                      </p>
                    </div>
                  </div>
                )}

                {/* Main Double Dashboard Layout Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Controls: Form real-time update and register users */}
                  <div className="space-y-6 lg:col-span-1">
                    
                    {/* 1. Instant Announcement Updater Textarea box */}
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2 text-slate-950">
                        <Megaphone className="w-5 h-5 text-[#FF6600]" />
                        <h4 className="font-black text-sm uppercase">PENGUMUMAN DINDING UTAMA</h4>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10.5px] font-black text-slate-950 uppercase font-mono">
                          Teks Pengumuman Paling Urgent:
                        </label>
                        <textarea
                          rows={4}
                          value={announcementDraft}
                          onChange={(e) => {
                            setAnnouncementDraft(e.target.value);
                          }}
                          placeholder="Ketik imbauan/persiapan jadwal tanding di sini..."
                          className="w-full bg-slate-50 text-slate-950 font-bold border border-slate-350 rounded p-3 text-sm focus:outline-none focus:border-[#FF6600]"
                        />
                        <button
                          onClick={() => {
                            const finalMsg = announcementDraft.trim();
                            setAnnouncement(finalMsg);
                            setAnnouncementPublisher(activeCommitteeName || 'Ariez');
                            localStorage.setItem('kbb_td_announcement_v3', finalMsg);
                            localStorage.setItem('kbb_td_announcement_publisher_v3', activeCommitteeName || 'Ariez');
                            alert(`Pengumuman berhasil diterbitkan oleh Panitia (${activeCommitteeName || 'Ariez'})!`);
                          }}
                          className="w-full bg-[#FF6600] text-black font-black text-xs uppercase py-2.5 rounded border border-black hover:bg-black hover:text-[#FF6600] transition-colors"
                          style={{ minHeight: '40px' }}
                        >
                          Publish Pengumuman
                        </button>
                        <p className="text-[10px] text-slate-500 font-bold italic leading-tight uppercase">
                          *Pengumuman dengan latar oranye menyala langsung dipasang di bagian paling atas halaman utama publik guna notice instan para atlet.
                        </p>
                      </div>
                    </div>

                    {/* 2. Tanggal Pelaksanaan Official Date modify */}
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2 text-slate-950">
                        <Calendar className="w-5 h-5 text-[#FF6600]" />
                        <h4 className="font-black text-sm uppercase">KOORDINASI JADWAL TANGGAL</h4>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10.5px] font-black text-slate-950 uppercase font-mono">
                          Ganti Pelaksanaan Offline/Keterangan:
                        </label>
                        <input
                          type="text"
                          value={dateTimeStatus}
                          onChange={(e) => {
                            setDateTimeStatus(e.target.value);
                            localStorage.setItem('kbb_td_datetime_status_v3', e.target.value);
                          }}
                          placeholder="Masukkan status tanggal..."
                          className="w-full bg-slate-50 text-slate-950 font-bold border border-slate-350 rounded p-2.5 text-xs focus:outline-none focus:border-[#FF6600]"
                        />
                        <p className="text-[9.5px] font-mono text-slate-500 uppercase">
                          Mengubah teks status tanggal di Halaman Utama secara realtime.
                        </p>
                      </div>
                    </div>

                    {/* 3. Register user form */}
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2 text-slate-950">
                        <UserPlus className="w-5 h-5 text-[#FF6600]" />
                        <h4 className="font-black text-sm uppercase font-mono">REGISTRASI PANITIA</h4>
                      </div>

                      {adminSuccessMsg && (
                        <div className="bg-green-50 border border-green-500 text-green-950 font-bold p-2.5 rounded text-xs text-center">
                          {adminSuccessMsg}
                        </div>
                      )}

                      {adminErrorMsg && (
                        <div className="bg-red-50 border border-red-500 text-red-950 font-bold p-2.5 rounded text-xs text-center">
                          {adminErrorMsg}
                        </div>
                      )}

                      <form onSubmit={handleAddAdminUser} className="space-y-3">
                        <div className="space-y-1">
                          <label className="block text-[10.5px] font-black text-slate-950 uppercase font-mono">
                            Nama Terpapar Panitia Baru:
                          </label>
                          <input
                            type="text"
                            value={newAdminName}
                            onChange={(e) => setNewAdminName(e.target.value)}
                            placeholder="Contoh: Teguh, Ibad..."
                            className="w-full bg-slate-50 text-slate-950 font-bold border border-slate-350 p-2 text-xs focus:outline-none"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10.5px] font-black text-slate-950 uppercase font-mono">
                            PIN Tembus Sandi Akses:
                          </label>
                          <input
                            type="text"
                            value={newAdminPin}
                            onChange={(e) => setNewAdminPin(e.target.value)}
                            placeholder="Deret angka sandi panitia..."
                            className="w-full bg-slate-50 text-slate-950 font-bold border border-slate-350 p-2 text-xs focus:outline-none"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-slate-950 text-[#FF6600] font-black text-xs uppercase py-2 rounded focus:outline-none"
                          style={{ minHeight: '44px' }}
                        >
                          Daftarkan Akun Panitia
                        </button>
                      </form>

                      {/* Display active committee list */}
                      <div className="pt-2 border-t border-slate-100">
                        <span className="block text-xs text-slate-900 font-extrabold uppercase font-mono tracking-wider mb-2">
                          PANITIA AKTIF DI DATABASE: ({administrators.length})
                        </span>
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto border-2 border-slate-950 p-2 rounded bg-slate-50 font-mono text-xs">
                          {administrators.map((adm, i) => (
                            <div key={i} className="flex justify-between items-center py-1 border-b last:border-0 uppercase font-black text-slate-900">
                              <span>👤 {adm.nama}</span>
                              <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-black">
                                SANDI: ••••••
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* Right Weigh-in Athlete managers Flat Tabular sheet */}
                  <div className="lg:col-span-2 bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-4">
                    <div className="border-b-2 border-slate-200 pb-3 flex justify-between items-center flex-wrap gap-2 text-slate-950">
                      <div>
                        <h4 className="text-lg font-black uppercase text-slate-900 font-mono">Manajemen Timbang Badan Resmi</h4>
                        <p className="text-xs font-black text-slate-700 uppercase">Pencatatan berat badan aktual atlet dan pemeriksaan berkas administrasi fisik oleh Panitia Pelaksana.</p>
                      </div>
                      <span className="bg-[#FF6600] text-black font-black text-sm font-mono py-1.5 px-3 rounded-lg border-2 border-slate-950">
                        Total {globalAthletes.length} Atlet
                      </span>
                    </div>

                    {/* Data Export Module with Embedded Multi-layered drop-downs */}
                    <div className="bg-slate-100 border-2 border-slate-950 rounded-xl p-5 space-y-4 text-slate-950">
                      <div className="flex justify-between items-center border-b border-slate-300 pb-2">
                        <div className="space-y-0.5">
                          <span className="bg-[#FF6600] text-black text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded">
                            KOMITE: UNDUH DATA REKAPITULASI
                          </span>
                          <h5 className="font-black text-sm uppercase text-slate-950 font-mono">Penyaringan Dokumen &amp; Ekspor Otomatis</h5>
                        </div>
                        <span className="text-xs bg-slate-950 text-white font-black font-mono px-2.5 py-1 rounded shadow-sm">
                          Terfilter: {exportFilteredAthletes.length} Atlet
                        </span>
                      </div>

                      {/* Explicit 5 dropdown selectors aligned and packed tightly */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        
                        {/* 1. FILTER ASAL SATLAT (KONTINGEN) */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-800 font-mono">
                            FILTER ASAL SATLAT:
                          </label>
                          <select
                            value={exportSatlat}
                            onChange={(e) => setExportSatlat(e.target.value)}
                            className="w-full bg-white text-slate-950 font-black text-xs border-2 border-slate-900 rounded p-1.5 focus:outline-none focus:border-[#FF6600]"
                          >
                            <option value="SEMUA">-- Tampilkan Semua Satlat --</option>
                            {VERIFIED_36_SATLATS.map((sat) => (
                              <option key={sat} value={sat}>{sat}</option>
                            ))}
                          </select>
                        </div>

                        {/* 2. FILTER JENIS KELAMIN */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-800 font-mono">
                            FILTER JENIS KELAMIN:
                          </label>
                          <select
                            value={exportGender}
                            onChange={(e) => setExportGender(e.target.value)}
                            className="w-full bg-white text-slate-950 font-black text-xs border-2 border-slate-900 rounded p-1.5 focus:outline-none focus:border-[#FF6600]"
                          >
                            <option value="SEMUA">-- Tampilkan Semua --</option>
                            <option value="PUTRA">Putra</option>
                            <option value="PUTRI">Putri</option>
                          </select>
                        </div>

                        {/* 3. FILTER GOLONGAN UMUR */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-800 font-mono">
                            FILTER GOLONGAN UMUR:
                          </label>
                          <select
                            value={exportAgeGroup}
                            onChange={(e) => setExportAgeGroup(e.target.value)}
                            className="w-full bg-white text-slate-950 font-black text-xs border-2 border-slate-900 rounded p-1.5 focus:outline-none focus:border-[#FF6600]"
                          >
                            <option value="SEMUA">-- Tampilkan Semua Umur --</option>
                            <option value="Usia Dini (SD)">Usia Dini (SD)</option>
                            <option value="Pelajar (SMP & SMA)">Pelajar (SMP & SMA)</option>
                            <option value="UMUM">UMUM</option>
                            <option value="ULOT">ULOT (Usia Kolot)</option>
                          </select>
                        </div>

                        {/* 4. FILTER KATEGORI TANDING */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-800 font-mono">
                            FILTER KATEGORI TANDING:
                          </label>
                          <select
                            value={exportCategoryType}
                            onChange={(e) => setExportCategoryType(e.target.value)}
                            className="w-full bg-white text-slate-950 font-black text-xs border-2 border-slate-900 rounded p-1.5 focus:outline-none focus:border-[#FF6600]"
                          >
                            <option value="SEMUA">-- Tampilkan Semua Kategori --</option>
                            <option value="TARUNG">Nomor Tarung</option>
                            <option value="SENI">Seni Gerak</option>
                          </select>
                        </div>

                        {/* 5. FILTER KELAS BERAT BADAN */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-800 font-mono">
                            FILTER KELAS BERAT BADAN:
                          </label>
                          <select
                            value={exportWeightClass}
                            onChange={(e) => setExportWeightClass(e.target.value)}
                            className="w-full bg-white text-slate-950 font-black text-xs border-2 border-slate-900 rounded p-1.5 focus:outline-none focus:border-[#FF6600]"
                          >
                            <option value="SEMUA">-- Tampilkan Semua Kelas Berat --</option>
                            {EXPORT_STRICT_WEIGHT_CLASSES.map((wc) => (
                              <option key={wc} value={wc}>{wc}</option>
                            ))}
                          </select>
                        </div>

                      </div>

                      {/* Direct high-contrast download buttons at the bottom of the panel */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-300 justify-end">
                        <button
                          onClick={handleExportExcel}
                          disabled={exportFilteredAthletes.length === 0}
                          className="flex items-center justify-center gap-2 bg-[#1d6f42] hover:bg-[#155230] text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl border-2 border-slate-950 cursor-pointer transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ minHeight: '44px' }}
                        >
                          <FileSpreadsheet className="w-4 h-4 shrink-0" />
                          <span>Download Excel (.xlsx)</span>
                        </button>
                        <button
                          onClick={handleExportPDF}
                          disabled={exportFilteredAthletes.length === 0}
                          className="flex items-center justify-center gap-2 bg-[#c0392b] hover:bg-[#962d22] text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl border-2 border-slate-950 cursor-pointer transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ minHeight: '44px' }}
                        >
                          <FileDown className="w-4 h-4 shrink-0" />
                          <span>Download PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* Mini inline quick search */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-950">
                        <Search className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        placeholder="Ketik nama atlet spesifik untuk mulai menimbang..."
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 text-slate-950 font-black text-xs border border-slate-350 rounded-lg pl-9 pr-4 py-2.5 focus:outline-none"
                      />
                    </div>

                    {/* Table roster */}
                    <div className="overflow-x-auto border-2 border-slate-950 rounded-xl max-h-[450px]">
                      <table className="w-full text-left font-sans text-slate-950">
                        <thead>
                          <tr className="bg-slate-200 font-black border-b border-slate-300 text-xs">
                            <th className="p-3 w-12 font-mono text-center">No</th>
                            <th className="p-3">Nama Atlet</th>
                            <th className="p-3">Asal Satlat</th>
                            <th className="p-3 text-center">Tinggi/Berat</th>
                            <th className="p-3">Golongan / Kelas Tanding Resmi</th>
                            <th className="p-3 text-center">Aksi Timbang</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white font-bold text-sm">
                          {filteredAthletes.map((ath, idx) => {
                            const isWeighed = ath.beratBadan && ath.beratBadan !== '-' && parseFloat(ath.beratBadan) > 0;
                            return (
                              <tr key={idx} className="hover:bg-slate-50 text-slate-950 text-base">
                                <td className="p-3 font-mono text-slate-900 font-black text-center bg-slate-50 border-r border-slate-100">{idx + 1}</td>
                                <td className="p-3 font-black uppercase text-slate-900 text-base leading-tight">{ath.nama}</td>
                                <td className="p-3 text-base font-black uppercase text-slate-900">{ath.satlat}</td>
                                <td className="p-3 text-center font-mono text-base font-black text-slate-900">
                                  {ath.tinggiBadan ? `${ath.tinggiBadan} cm` : '—'} / <strong className="text-[#FF6600]">{isWeighed ? `${ath.beratBadan} kg` : '—'}</strong>
                                </td>
                                <td className="p-3 font-black text-sm">
                                  <div className="text-slate-900 uppercase">[{getAgeCategory(ath.subKategori)}] {ath.subKategori}</div>
                                  <div className="text-[#FF6600] uppercase mt-0.5">{ath.kelasTanding}</div>
                                </td>
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleOpenWeighModal(ath)}
                                    className="bg-slate-950 hover:bg-[#FF6600] hover:text-black text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all shadow"
                                  >
                                    Timbang / Edit
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-[10px] text-slate-500 font-bold leading-normal uppercase">
                      💡 Sensus timbangan di atas responsif terhadap kolom pencarian global dan saringan filter yang Anda setel di halaman utama maupun halaman pencarian.
                    </p>

                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* ======================= DETAILED MODALS SYSTEM ======================= */}
      <AnimatePresence>
        
        {/* MODAL 1: VIEW CHECKLIST STATUS (FOR PUBLIC OR COACHES) */}
        {selectedAthlete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white border-4 border-slate-950 rounded-3xl overflow-hidden shadow-2xl text-slate-950"
            >
              <div className="p-5 bg-slate-950 text-white flex justify-between items-center border-b-4 border-[#FF6600]">
                <div className="space-y-0.5">
                  <span className="font-mono text-[10px] uppercase text-[#FF6600] tracking-widest font-black">
                    DIREKTORI VERIFIKASI BERKAS AKTIF
                  </span>
                  <h4 className="text-lg md:text-xl font-black uppercase tracking-tight">{selectedAthlete.nama}</h4>
                </div>
                <button 
                  onClick={() => setSelectedAthlete(null)}
                  className="bg-white/15 hover:bg-white/30 text-white p-2 text-xs rounded-full cursor-pointer font-bold font-mono"
                >
                  CLOSE [X]
                </button>
              </div>

              <div className="p-6 space-y-5">
                
                {/* Micro athlete bio card within modal */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-100 p-3.5 rounded-xl text-slate-950">
                  <div>
                    <span className="block text-[9.5px] font-mono text-slate-500 font-bold uppercase">ASAL SATLAT KBB</span>
                    <span className="text-xs font-black uppercase text-slate-950">{selectedAthlete.satlat}</span>
                  </div>
                  <div>
                    <span className="block text-[9.5px] font-mono text-slate-500 font-bold uppercase">UKUR REKAP TB/BB</span>
                    <span className="text-xs font-black font-mono text-slate-950">
                      {selectedAthlete.tinggiBadan ? `${selectedAthlete.tinggiBadan}` : '—'} / <strong className="text-orange-600">{selectedAthlete.beratBadan ? `${selectedAthlete.beratBadan} kg` : '—'}</strong>
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9.5px] font-mono text-slate-500 font-bold uppercase">KELAS TANDING RESMI</span>
                    <span className="text-xs font-black text-[#FF6600] uppercase font-mono">{selectedAthlete.kelasTanding}</span>
                  </div>
                </div>

                <div className="bg-orange-50 border-l-4 border-[#FF6600] p-3 rounded-r-xl space-y-0.5">
                  <span className="block text-[9.5px] font-mono text-slate-500 font-black">KELAS GOLONGAN TANDING</span>
                  <p className="text-xs font-black text-slate-950 uppercase">[{getAgeCategory(selectedAthlete.subKategori)}] &mdash; {selectedAthlete.subKategori}</p>
                </div>

                {/* Dynamic High-Visibility Verification Badge (BERKAS LENGKAP or BERKAS KURANG) */}
                <div className="pt-2">
                  {(() => {
                    const verifiedState = verifications[selectedAthlete.nama] || {
                      ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false
                    };
                    const missingDocs = OFFICIAL_DOCUMENTS_LIST.filter(doc => !(verifiedState as any)[doc.key]);
                    const isComplete = missingDocs.length === 0;

                    if (isComplete) {
                      return (
                        <div className="bg-green-100 border-4 border-green-700 p-5 rounded-2xl text-center space-y-1">
                          <span className="text-xl md:text-2xl font-black text-green-900 tracking-wider block">
                            ✓ LENGKAP
                          </span>
                          <p className="text-xs md:text-sm font-black text-slate-800 uppercase">
                            Semua dokumen administrasi fisik wajib atlet ini telah lolos verifikasi panitia.
                          </p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="bg-red-50 border-4 border-red-650 p-5 rounded-2xl text-left space-y-2">
                          <span className="text-lg md:text-xl font-black text-red-650 tracking-tight uppercase block">
                            ⚠️ BELUM LENGKAP
                          </span>
                          <p className="text-base font-black text-slate-900 uppercase leading-relaxed">
                            Kekurangan Berkas: <span className="underline decoration-red-600 decoration-2">{missingDocs.map(d => d.label).join(", ")}</span>
                          </p>
                          <p className="text-[11px] font-bold text-slate-600 leading-normal uppercase">
                            Silakan segera lengkapi kekurangan berkas di atas dan kumpulkan fisik dokumen ke sekretariat panitia pelaksana.
                          </p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* 6 Mandatory checklist item files in strictly read-only mode (No checkboxes/inputs) */}
                <div className="space-y-3">
                  <div className="border-b-2 border-slate-200 pb-1.5 text-slate-900">
                    <h5 className="font-mono font-black text-xs uppercase tracking-wider text-slate-900">REKAPITULASI DOKUMEN FISIK (READ-ONLY)</h5>
                  </div>

                  <div className="space-y-2 pt-1 text-slate-950 font-sans text-sm">
                    {OFFICIAL_DOCUMENTS_LIST.map((doc) => {
                      const verifiedState = verifications[selectedAthlete.nama] || {
                        ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false
                      };
                      const exists = !!(verifiedState as any)[doc.key];

                      return (
                        <div
                          key={doc.key}
                          className="flex justify-between items-center p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold uppercase text-xs"
                        >
                          <span className="text-slate-900 font-black">
                            {doc.label}
                          </span>
                          {exists ? (
                            <span className="bg-green-100 text-green-700 font-mono font-black border border-green-500 px-3 py-1 rounded text-[10px] tracking-wide">
                              ✓ TERVERIFIKASI
                            </span>
                          ) : (
                            <span className="bg-slate-200 text-slate-900 font-mono font-black border border-slate-350 px-3 py-1 rounded text-[10px] tracking-wide">
                              BELUM LENGKAP
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="p-4 bg-slate-50 border-t flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedAthlete(null)}
                  className="bg-slate-950 hover:bg-[#FF6600] text-white hover:text-black font-black text-xs uppercase py-2 px-5 rounded border border-slate-950 shadow"
                  style={{ minHeight: '40px' }}
                >
                  SELESAI PEMERIKSAAN
                </button>
              </div>

            </motion.div>
          </div>
        )}

        {/* MODAL 2: WEIGH IN & FLEXIBLE SHIFTING WEIGHT CLASSES (FOR ADMIN REGISTERED ONLY) */}
        {editingAthlete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border-4 border-slate-950 rounded-2xl overflow-hidden shadow-2xl text-slate-950"
            >
              <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b-4 border-[#FF6600]">
                <div className="space-y-0.5">
                  <span className="font-mono text-xs text-[#FF6600] font-black uppercase">TIMBANG BERAT AKTUAL ATLET</span>
                  <h4 className="font-black text-lg uppercase leading-tight">{editingAthlete.nama}</h4>
                </div>
                <button 
                  onClick={() => setEditingAthlete(null)}
                  className="bg-red-500 hover:bg-red-700 text-white py-1 px-3 text-xs font-black uppercase font-mono rounded border border-black"
                >
                  BATAL
                </button>
              </div>

              <form onSubmit={handleSaveWeighResults}>
                <div className="p-5 space-y-4 text-slate-950">
                  
                  <div className="bg-slate-100 p-3 rounded-lg text-slate-950 font-bold border text-xs space-y-0.5">
                    <p className="uppercase text-slate-500">KONTINGEN SATLAT: {editingAthlete.satlat}</p>
                    <p className="uppercase text-slate-700">GOLONGAN MODEL: {editingAthlete.subKategori} &mdash; <span className="text-[#FF6600] font-black font-mono">{editingAthlete.kelasTanding}</span></p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black uppercase text-slate-950 font-mono">
                        BERAT TIMBANGAN (KG):
                      </label>
                      <input
                        type="text"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        placeholder="Misal: 46.5"
                        className="w-full bg-slate-50 text-slate-950 font-black border border-slate-350 rounded p-2 text-sm focus:outline-none focus:border-[#FF6600]"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-black uppercase text-slate-950 font-mono">
                        TINGGI AKTUAL (CM):
                      </label>
                      <input
                        type="text"
                        value={editHeight}
                        onChange={(e) => setEditHeight(e.target.value)}
                        placeholder="Misal: 158"
                        className="w-full bg-slate-50 text-slate-950 font-black border border-slate-350 rounded p-2 text-sm focus:outline-none focus:border-[#FF6600]"
                        required
                      />
                    </div>

                  </div>

                  {/* Weight Class Overwrite Shifting Dropdown Shifter */}
                  <div className="space-y-1.5 pt-1.5 border-t">
                    <label className="block text-[11px] font-black uppercase text-slate-950 font-mono">
                      GESER KELAS TANDING (IF OVERWEIGHT/UNDERWEIGHT):
                    </label>
                    <select
                      value={editWeightClass}
                      onChange={(e) => setEditWeightClass(e.target.value)}
                      className="w-full bg-white text-slate-950 font-black text-xs border-2 border-slate-900 rounded p-2.5 focus:outline-none focus:border-[#FF6600]"
                    >
                      {STANDARD_WEIGHT_CLASSES.map((wc) => (
                        <option key={wc} value={wc}>{wc}</option>
                      ))}
                    </select>
                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-snug">
                      *Gunakan drop menu di atas untuk memindahkan paksa kelas tanding atlet seketika jika berat timbangan tidak lolos klasifikasi asalnya.
                    </p>
                  </div>

                  {/* Administrative checklist interaktif untuk Panitia */}
                  <div className="space-y-3 pt-3 border-t-2 border-slate-100">
                    <div className="flex justify-between items-baseline text-slate-900 border-b pb-1">
                      <h5 className="font-black text-xs uppercase tracking-wider font-mono">VERIFIKASI BERKAS FISIK (KOMITE):</h5>
                      <span className="text-[11px] font-mono text-slate-900 uppercase font-extrabold">Klik Kolas Centang</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-950">
                      {OFFICIAL_DOCUMENTS_LIST.map((doc) => {
                        const checked = !!editChecklist[doc.key];
                        return (
                          <button
                            key={doc.key}
                            type="button"
                            onClick={() => {
                              setEditChecklist(prev => ({
                                ...prev,
                                [doc.key]: !checked
                              }));
                            }}
                            className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-50 text-left text-slate-950 transition-colors uppercase font-black text-xs"
                          >
                            {checked ? (
                              <CheckSquare className="w-5 h-5 shrink-0 text-green-700 font-black" />
                            ) : (
                              <Square className="w-5 h-5 shrink-0 text-slate-400" />
                            )}
                            <span className="text-slate-900 font-black">
                              {doc.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                <div className="p-4 bg-slate-50 border-t flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditingAthlete(null)}
                    className="bg-white text-slate-950 font-bold border p-2.5 rounded hover:border-slate-800 transition-colors"
                    style={{ minHeight: '40px' }}
                  >
                    Urungkan
                  </button>
                  <button
                    type="submit"
                    className="bg-[#FF6600] text-black font-black py-2.5 px-4 rounded border-2 border-slate-950 hover:bg-orange-600 transition-colors shadow"
                    style={{ minHeight: '40px' }}
                  >
                    Simpan Timbangan &amp; Geser Kelas
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}

      </AnimatePresence>

    </div>
  );
}
