import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  Users, Search, RefreshCw, AlertCircle, ShieldCheck, Lock, Megaphone,
  LogOut, Scale, Award, BookOpen, CheckSquare, Square, Calendar, MapPin, 
  UserPlus, FileSpreadsheet, FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SPREADSHEET_TABS, fetchRawCsv } from './lib/spreadsheetConfig';
import { MOCK_RAW_CSV_MATRICES } from './lib/mockData';
import { buildGlobalAthletesList, FlatAthlete, extractValidationStats, ValidationStats, VERIFIED_36_SATLATS } from './lib/dataParser';

export interface AdminUser { nama: string; pin: string; label: string; }

const DEFAULT_ADMINS: AdminUser[] = [
  { nama: "Ariez", pin: "112233", label: "Ariez" },
  { nama: "Ibad", pin: "445566", label: "Ibad" },
  { nama: "Teguh", pin: "778899", label: "Teguh" }
];

const EVENT_IDENTITY = {
  name: "Panitia Kejuaraan Antar Satlat se Kabupaten Bandung Barat Ke 2 2026",
  theme: "Bertarung dalam kehormatan sebagai wadah generasi Berakhlak",
  motto: "Aku ramah bukan berarti takut, aku tunduk bukan berarti takluk",
  organizer: "Pengcab KODRAT Kabupaten Bandung Barat",
  venue: "Gedung K.H Hilmi Aminudin, Nurul Fikri Boarding School Lembang, KBB"
};

const EXPORT_STRICT_WEIGHT_CLASSES = [
  "30 kg - 34 kg", "38,1 kg - 42 kg", "41 kg - 45 kg", "42,1 kg - 46 kg",
  "45 Kg - 49 kg", "46 Kg - 49 kg", "52 kg - 55 kg", "52,1 kg - 55 kg",
  "53 kg - 57 kg", "55,1 kg - 58 kg", "61 kg - 65 kg", "64,1 kg - 67 kg",
  "64,1 kg - 68 kg", "67,1 kg - 70 kg", "70,1 kg - 75 kg", "74,1 kg - >",
  "GETAR PI", "KELAS 5-1 SMP", "KELAS 5-7 SMP PI",
  "NOMOR TARUNG PELAJAR PUTRA KELAS 2 SMP - 1 SMA 37 kg - 41 kg",
  "NOMOR TARUNG PELAJAR PUTRA KELAS 3 SMP - 2 SMA 49 kg - 53 kg",
  "NOMOR TARUNG PELAJAR PUTRI KELAS 3 SMP - 2 SMA 49 KG - 52 KG",
  "NOMOR TARUNG UMUM PUTRA KELAS 3 SMA - MAX 29 THN 49 kg - 52 kg",
  "NOMOR TARUNG UMUM PUTRI KELAS 3 SMA - MAX 29 THN 46 kg - 50 Kg",
  "NOMOR TARUNG USIA DINI PUTRA KELAS 5 SD - 1 SMP 25 kg - 30 kg",
  "TUNGGAL PI", "UDIN GETAR KELAS 5-7 SMP PA", "UDIN TUNGGAL PI KELAS 1-4 SD"
];

export function getAgeCategory(subKategori: string): string {
  const s = (subKategori || '').toUpperCase();
  if (s.includes('UDIN') || s.includes('DINI') || s.includes('SD')) return 'Usia Dini (SD)';
  if (s.includes('PELAJAR') || s.includes('SMP') || s.includes('SMA')) return 'Pelajar (SMP & SMA)';
  if (s.includes('UMUM') || s.includes('DEWASA') || s.includes('THN') || s.includes('17-25')) return 'UMUM';
  if (s.includes('ULOT') || s.includes('KOLOT') || s.includes('TUA')) return 'ULOT (Usia Kolot)';
  return 'Pelajar (SMP & SMA)';
}

export function getAthleteGender(ath: FlatAthlete): 'PUTRA' | 'PUTRI' {
  const s = (ath.subKategori || '').toUpperCase();
  const c = (ath.kelasTanding || '').toUpperCase();
  if (s.includes(' PI ') || s.includes('PI ') || s.endsWith(' PI') || s.includes('PUTRI') || c.includes('PUTRI') || c.includes('PI')) return 'PUTRI';
  return 'PUTRA';
}

const STANDARD_WEIGHT_CLASSES = [
  "Kelas A (Sub - 43 kg)", "Kelas B (43.1 - 46 kg)", "Kelas C (46.1 - 49 kg)",
  "Kelas D (49.1 - 52 kg)", "Kelas E (52.1 - 55 kg)", "Kelas F (55.1 - 59 kg)",
  "Kelas G (59.1 - 63 kg)", "Kelas H (63.1 - 67 kg)", "Kelas I (67.1 - 71 kg)",
  "Kelas Bebas (Di atas 71 kg)", "Seni Tunggal / Ranger", "Seni Berpasangan", "Seni Kelompok / Getar"
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

  const [validationStats, setValidationStats] = useState<ValidationStats>({
    totalPeserta: 197, totalTarung: 176, totalSeniGerak: 21, tidakMengirimkan: 0
  });

  const [announcement, setAnnouncement] = useState<string>(() => localStorage.getItem('kbb_td_announcement_v3') || "PENTING: Seluruh kontingen wajib merampungkan berkas administrasi fisik di lokasi gedung tanding.");
  const [announcementPublisher, setAnnouncementPublisher] = useState<string>(() => localStorage.getItem('kbb_td_announcement_publisher_v3') || "Ariez");
  const [dateTimeStatus, setDateTimeStatus] = useState<string>(() => localStorage.getItem('kbb_td_datetime_status_v3') || "Menunggu Konfirmasi Resmi / Belum Fixed");
  const [announcementDraft, setAnnouncementDraft] = useState<string>(() => localStorage.getItem('kbb_td_announcement_v3') || "");

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSatlat, setFilterSatlat] = useState<string>('SEMUA');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('SEMUA');
  const [filterCategoryType, setFilterCategoryType] = useState<string>('SEMUA');
  const [filterGender, setFilterGender] = useState<string>('SEMUA');
  const [filterWeightClass, setFilterWeightClass] = useState<string>('SEMUA');

  const [exportSatlat, setExportSatlat] = useState<string>('SEMUA');
  const [exportGender, setExportGender] = useState<string>('SEMUA');
  const [exportAgeGroup, setExportAgeGroup] = useState<string>('SEMUA');
  const [exportCategoryType, setExportCategoryType] = useState<string>('SEMUA');
  const [exportWeightClass, setExportWeightClass] = useState<string>('SEMUA');

  const [selectedAthlete, setSelectedAthlete] = useState<FlatAthlete | null>(null);
  const [verifications, setVerifications] = useState<Record<string, { ktp_kk: boolean; ijazah: boolean; medical: boolean; parents: boolean; photos: boolean; statement: boolean; }>>({});

  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [activeCommitteeName, setActiveCommitteeName] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [administrators, setAdministrators] = useState<AdminUser[]>(DEFAULT_ADMINS);
  
  const [newAdminName, setNewAdminName] = useState<string>('');
  const [newAdminPin, setNewAdminPin] = useState<string>('');
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null);

  const [editingAthlete, setEditingAthlete] = useState<FlatAthlete | null>(null);
  const [editWeight, setEditWeight] = useState<string>('');
  const [editHeight, setEditHeight] = useState<string>('');
  const [editWeightClass, setEditWeightClass] = useState<string>('');
  const [editChecklist, setEditChecklist] = useState<Record<string, boolean>>({ ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false });

  useEffect(() => {
    try {
      const savedCheck = localStorage.getItem('kbb_td_verifications_v3');
      if (savedCheck) setVerifications(JSON.parse(savedCheck));
      const savedAdmins = localStorage.getItem('kbb_td_admins_v3');
      let parsedAdmins = savedAdmins ? JSON.parse(savedAdmins) : null;
      if (!parsedAdmins || !Array.isArray(parsedAdmins)) {
        localStorage.setItem('kbb_td_admins_v3', JSON.stringify(DEFAULT_ADMINS));
      } else {
        setAdministrators(parsedAdmins);
      }
    } catch (e) {}
  }, []);

  const [sysTime, setSysTime] = useState<Date>(new Date());
  useEffect(() => {
    const interval = setInterval(() => setSysTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedWIBClock = useMemo(() => {
    const utcTime = sysTime.getTime() + (sysTime.getTimezoneOffset() * 60000);
    const wibDate = new Date(utcTime + (7 * 3600000));
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const hr = String(wibDate.getHours()).padStart(2, '0');
    const min = String(wibDate.getMinutes()).padStart(2, '0');
    const sec = String(wibDate.getSeconds()).padStart(2, '0');
    return `${dayNames[wibDate.getDay()]}, ${wibDate.getDate()} ${monthNames[wibDate.getMonth()]} ${wibDate.getFullYear()} | ${hr}:${min}:${sec} WIB`;
  }, [sysTime]);

  useEffect(() => {
    let active = true;
    async function loadDataAndParse() {
      setIsLoading(true);
      setErrorText(null);
      const csvContents: Record<string, string> = {};
      try {
        const fetchPromises = SPREADSHEET_TABS.map(async (tab) => {
          try {
            const res = await fetchRawCsv(tab.gid || tab.name);
            return { name: tab.name, content: res };
          } catch (err) {
            return { name: tab.name, content: MOCK_RAW_CSV_MATRICES[tab.name] || '' };
          }
        });
        const outputs = await Promise.all(fetchPromises);
        outputs.forEach(opt => { if (opt.content) csvContents[opt.name] = opt.content; });

        const flatAthletes = buildGlobalAthletesList(csvContents);
        const parsedStats = extractValidationStats(csvContents['DATA HITUNGAN ATLET KEJURKAB'] || '');

        try {
          const storedOverrides = localStorage.getItem('kbb_td_athlete_overrides_v3');
          if (storedOverrides) {
            const parsedOverrides = JSON.parse(storedOverrides);
            Object.keys(parsedOverrides).forEach(name => {
              const targetIndex = flatAthletes.findIndex(a => a.nama.toUpperCase() === name.toUpperCase());
              if (targetIndex !== -1) flatAthletes[targetIndex] = { ...flatAthletes[targetIndex], ...parsedOverrides[name] };
            });
          }
        } catch (err) {}

        if (active) {
          setGlobalAthletes(flatAthletes);
          setValidationStats(parsedStats);
        }
      } catch (err) {
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadDataAndParse();
    return () => { active = false; };
  }, []);

  const computedStats = useMemo(() => {
    let weighedCount = 0;
    globalAthletes.forEach(ath => {
      if (ath.beratBadan && ath.beratBadan !== '-' && parseFloat(ath.beratBadan) > 0) weighedCount++;
    });
    return { weighed: weighedCount };
  }, [globalAthletes]);

  const availableWeightClasses = useMemo(() => {
    const classes = new Set<string>();
    globalAthletes.forEach((ath) => {
      const matchAge = filterAgeGroup === 'SEMUA' || getAgeCategory(ath.subKategori) === filterAgeGroup;
      const matchType = filterCategoryType === 'SEMUA' || ath.kategori === filterCategoryType;
      const matchGender = filterGender === 'SEMUA' || getAthleteGender(ath) === filterGender;
      if (matchAge && matchType && matchGender && ath.kelasTanding.trim()) classes.add(ath.kelasTanding.trim());
    });
    return Array.from(classes).sort();
  }, [globalAthletes, filterAgeGroup, filterCategoryType, filterGender]);

  const filteredAthletes = useMemo(() => {
    return globalAthletes.filter(ath => {
      const matchSearch = !searchQuery.trim() || ath.nama.toLowerCase().includes(searchQuery.toLowerCase().trim()) || ath.satlat.toLowerCase().includes(searchQuery.toLowerCase().trim()) || ath.kelasTanding.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchSatlat = filterSatlat === 'SEMUA' || ath.satlat.toUpperCase() === filterSatlat.toUpperCase();
      const matchAge = filterAgeGroup === 'SEMUA' || getAgeCategory(ath.subKategori) === filterAgeGroup;
      const matchType = filterCategoryType === 'SEMUA' || ath.kategori === filterCategoryType;
      const matchGender = filterGender === 'SEMUA' || getAthleteGender(ath) === filterGender;
      const matchWeightClass = filterWeightClass === 'SEMUA' || ath.kelasTanding.trim() === filterWeightClass.trim();
      return matchSearch && matchSatlat && matchAge && matchType && matchGender && matchWeightClass;
    });
  }, [globalAthletes, searchQuery, filterSatlat, filterAgeGroup, filterCategoryType, filterGender, filterWeightClass]);

  const exportFilteredAthletes = useMemo(() => {
    return globalAthletes.filter(ath => {
      const matchSatlat = exportSatlat === 'SEMUA' || ath.satlat.toUpperCase() === exportSatlat.toUpperCase();
      const matchAge = exportAgeGroup === 'SEMUA' || getAgeCategory(ath.subKategori) === exportAgeGroup;
      const matchType = exportCategoryType === 'SEMUA' || (exportCategoryType === 'TARUNG' ? ath.kategori === 'TARUNG' : ath.kategori === 'SENI');
      const matchGender = exportGender === 'SEMUA' || getAthleteGender(ath) === exportGender;
      const matchWeightClass = exportWeightClass === 'SEMUA' || ath.kelasTanding.trim() === exportWeightClass.trim();
      return matchSatlat && matchAge && matchType && matchGender && matchWeightClass;
    });
  }, [globalAthletes, exportSatlat, exportAgeGroup, exportCategoryType, exportGender, exportWeightClass]);

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    const enteredName = usernameInput.trim().toLowerCase();
    const enteredPin = passwordInput.trim();
    const matchedAdmin = administrators.find(admin => admin.nama.toLowerCase() === enteredName && admin.pin === enteredPin);
    if (matchedAdmin) {
      setIsLoggedIn(true);
      setActiveCommitteeName(matchedAdmin.label);
      setUsernameInput(''); setPasswordInput(''); setLoginError(null);
    } else {
      setLoginError("Kombinasi Nama Panitia atau PIN tidak cocok.");
    }
  };

  const handleAddAdminUser = (e: FormEvent) => {
    e.preventDefault();
    const nameText = newAdminName.trim(); const pinText = newAdminPin.trim();
    if (!nameText || !pinText) { setAdminErrorMsg("Wajib diisi!"); return; }
    if (administrators.some(adm => adm.nama.toLowerCase() === nameText.toLowerCase())) { setAdminErrorMsg(`Nama "${nameText}" sudah ada.`); return; }
    const updated = [...administrators, { nama: nameText, pin: pinText, label: nameText }];
    setAdministrators(updated);
    localStorage.setItem('kbb_td_admins_v3', JSON.stringify(updated));
    setAdminSuccessMsg(`Panitia "${nameText}" berhasil ditambahkan!`);
    setNewAdminName(''); setNewAdminPin(''); setTimeout(() => { setAdminSuccessMsg(null); }, 3000);
  };

  const handleExportExcel = () => {
    if (exportFilteredAthletes.length === 0) return;
    const exportData = exportFilteredAthletes.map((ath, idx) => {
      const verifiedState = verifications[ath.nama] || { ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false };
      const verifiedCount = Object.values(verifiedState).filter(Boolean).length;
      const isWeighed = ath.beratBadan && ath.beratBadan !== '-' && parseFloat(ath.beratBadan) > 0;
      return {
        "No.": idx + 1, "Nama Lengkap Atlet": ath.nama || '—', "Asal Satlat (Kontingen)": ath.satlat || '—',
        "Tinggi Badan (TB)": ath.tinggiBadan ? `${ath.tinggiBadan} cm` : '—',
        "Berat Badan (BB) / Kelas Tanding": `${isWeighed ? `${ath.beratBadan} kg` : ath.beratBadan || '—'} / ${ath.kelasTanding}`,
        "Golongan Umur & Kategori": `[${getAgeCategory(ath.subKategori)}] ${ath.subKategori || ath.kategori || '—'}`,
        "Status Administrasi": verifiedCount === 6 ? 'LENGKAP' : 'BELUM LENGKAP'
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "REKAP ATLET KBB 2026");
    XLSX.writeFile(workbook, `REKAPITULASI_ATLET_KBB_2026_${Date.now()}.xlsx`);
  };

  const handleExportPDF = () => {
    if (exportFilteredAthletes.length === 0) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont("Helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(15, 23, 42);
    doc.text("DATA REKAPITULASI ATLET KEJURKAB KBB 2026", 14, 15);
    doc.setFont("Helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(71, 85, 105);
    doc.text(`Dicetak Oleh Panitia: ${activeCommitteeName} | Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, 21);
    doc.setDrawColor(15, 23, 42); doc.setLineWidth(0.5); doc.line(14, 27, 196, 27);
    const bodyData = exportFilteredAthletes.map((ath, idx) => {
      const verifiedState = verifications[ath.nama] || { ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false };
      const verifiedCount = Object.values(verifiedState).filter(Boolean).length;
      const isWeighed = ath.beratBadan && ath.beratBadan !== '-' && parseFloat(ath.beratBadan) > 0;
      return [
        idx + 1, (ath.nama || '—').toUpperCase(), (ath.satlat || '—').toUpperCase(),
        ath.tinggiBadan ? `${ath.tinggiBadan} cm` : '—', `${isWeighed ? `${ath.beratBadan} kg` : ath.beratBadan || '—'} / ${ath.kelasTanding}`.toUpperCase(),
        `[${getAgeCategory(ath.subKategori)}] ${ath.subKategori || ath.kategori || '—'}`.toUpperCase(), verifiedCount === 6 ? 'LENGKAP' : 'BELUM LENGKAP'
      ];
    });
    autoTable(doc, {
      startY: 31, head: [["No.", "Nama Lengkap Atlet", "Asal Satlat", "Tinggi Badan", "Berat Badan / Kelas", "Golongan Umur", "Status Administrasi"]],
      body: bodyData, theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: [15, 23, 42] }
    });
    doc.save(`REKAPITULASI_ATLET_KBB_2026_${Date.now()}.pdf`);
  };

  const handleOpenWeighModal = (ath: FlatAthlete) => {
    setEditingAthlete(ath); setEditWeight(ath.beratBadan || ''); setEditHeight(ath.tinggiBadan || ''); setEditWeightClass(ath.kelasTanding);
    setEditChecklist({ ...(verifications[ath.nama] || { ktp_kk: false, ijazah: false, medical: false, parents: false, photos: false, statement: false }) });
  };

  const handleSaveWeighResults = (e: FormEvent) => {
    e.preventDefault(); if (!editingAthlete) return;
    const updatedVerifications = { ...verifications, [editingAthlete.nama]: { ...editChecklist } };
    setVerifications(updatedVerifications); localStorage.setItem('kbb_td_verifications_v3', JSON.stringify(updatedVerifications));
    setGlobalAthletes(prev => {
      const updated = prev.map(ath => ath.nama === editingAthlete.nama ? { ...ath, beratBadan: editWeight || undefined, tinggiBadan: editHeight, kelasTanding: editWeightClass } : ath);
      try {
        const parsed = JSON.parse(localStorage.getItem('kbb_td_athlete_overrides_v3') || '{}');
        parsed[editingAthlete.nama] = { beratBadan: editWeight || undefined, tinggiBadan: editHeight, kelasTanding: editWeightClass };
        localStorage.setItem('kbb_td_athlete_overrides_v3', JSON.stringify(parsed));
      } catch (err) {}
      return updated;
    });
    setEditingAthlete(null);
  };

  return (
    <div id="sport_app_wrap" className="min-h-screen bg-slate-50 text-slate-900 pb-20 selection:bg-[#FF6600] selection:text-white">
      <header id="sport_header_banner" className="bg-slate-950 text-white border-b-8 border-[#FF6600] py-8 px-4 md:px-6 shadow-xl relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 text-center md:text-left select-none">
            <span className="inline-block bg-[#FF6600] text-black text-xs font-black px-3 py-1 uppercase rounded font-mono">★ OFFICIAL BOARD PANITIA</span>
            <h1 className="text-2xl md:text-4xl font-black uppercase text-white font-display">{EVENT_IDENTITY.name}</h1>
            <p className="text-[#FF6600] font-extrabold text-base italic">"{EVENT_IDENTITY.motto}"</p>
          </div>
          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 shadow-lg min-w-[240px] text-center">
            <span className="text-xs text-orange-400 font-mono font-black uppercase flex items-center justify-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>WIB LIVE CLOCK</span>
            <p className="text-base font-black text-white font-mono">{formattedWIBClock}</p>
          </div>
        </div>
      </header>

      <nav id="sport_tabs_navigation" className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        <div className="bg-slate-950 border-4 border-slate-950 rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-lg">
          <button onClick={() => setCurrentNavTab('dashboard')} className={`flex-1 py-4 px-6 font-black text-sm uppercase rounded-xl flex justify-center gap-2 ${currentNavTab === 'dashboard' ? 'bg-[#FF6600] text-black' : 'bg-slate-900 text-white'}`}><BookOpen className="w-5 h-5"/> 1. Beranda Utama</button>
          <button onClick={() => setCurrentNavTab('search')} className={`flex-1 py-4 px-6 font-black text-sm uppercase rounded-xl flex justify-center gap-2 ${currentNavTab === 'search' ? 'bg-[#FF6600] text-black' : 'bg-slate-900 text-white'}`}><Search className="w-5 h-5"/> 2. Pencarian Atlet</button>
          <button onClick={() => setCurrentNavTab('admin')} className={`flex-1 py-4 px-6 font-black text-sm uppercase rounded-xl flex justify-center gap-2 ${currentNavTab === 'admin' ? 'border-2 border-[#FF6600] text-[#FF6600]' : 'bg-slate-900 text-white'}`}><ShieldCheck className="w-5 h-5"/> {isLoggedIn ? '3. Panel Panitia' : '3. Login Panitia'}</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        {currentNavTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-white border-l-4 border-orange-500 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="bg-[#FF6600]/10 text-[#FF6600] rounded-xl p-3"><Megaphone className="w-6 h-6 animate-pulse" /></div>
              <div>
                <span className="text-xs font-black bg-[#FF6600] text-black px-2 py-0.5 rounded">Panitia ({announcementPublisher})</span>
                <p className="text-lg font-black text-slate-900 mt-1 uppercase">{announcement}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border-2 border-slate-900 rounded-2xl p-6">
                <div className="flex items-center gap-3 border-b-2 pb-3 mb-4"><Calendar className="w-8 h-8 text-[#FF6600]" /><h3 className="text-lg font-black uppercase">Jadwal & Status</h3></div>
                <div className="bg-slate-100 p-4 rounded-xl mb-4"><span className="text-xs font-black uppercase text-slate-500">STATUS TANGGAL</span><span className="text-2xl font-black text-slate-950 block mt-1 uppercase">{dateTimeStatus}</span></div>
                <div className="grid grid-cols-2 gap-4"><div className="border p-4 rounded-xl"><span className="text-xs font-bold text-slate-500 uppercase">LOKASI</span><p className="font-extrabold text-sm uppercase">{EVENT_IDENTITY.venue}</p></div><div className="border p-4 rounded-xl"><span className="text-xs font-bold text-slate-500 uppercase">TEMA</span><p className="font-extrabold text-sm uppercase">{EVENT_IDENTITY.theme}</p></div></div>
              </div>
              <div className="bg-slate-950 text-white rounded-2xl p-6 border-2 border-slate-950">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-4"><Award className="w-6 h-6 text-[#FF6600]" /><h3 className="text-sm font-black font-mono">DASHBOARD COUNTER</h3></div>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-white/10 pb-1.5"><span className="text-xs font-bold text-slate-400">Total Atlet:</span><span className="text-3xl font-black">{validationStats.totalPeserta}</span></div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5"><span className="text-xs font-bold text-slate-400">Peserta Tarung:</span><span className="text-base font-black">{validationStats.totalTarung}</span></div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5"><span className="text-xs font-bold text-slate-400">Peserta Seni:</span><span className="text-base font-black">{validationStats.totalSeniGerak}</span></div>
                  <div className="flex justify-between pb-1.5"><span className="text-xs font-bold text-slate-400">Selesai Timbang:</span><span className="text-base font-black text-[#FF6600]">{computedStats.weighed}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentNavTab === 'search' && (
          <div className="space-y-6">
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-sm">
              <h2 className="text-xl font-black uppercase text-slate-950 mb-4">Sensus Dan Verifikasi Berkas</h2>
              <div className="relative mb-4"><span className="absolute left-4 top-1/2 -translate-y-1/2"><Search className="w-6 h-6"/></span><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ketik nama lengkap atlet..." className="w-full bg-white text-slate-950 font-black border-4 border-slate-950 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-[#FF6600]" /></div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-100 p-4 rounded-xl">
                <select value={filterSatlat} onChange={(e) => setFilterSatlat(e.target.value)} className="w-full text-xs font-bold p-2 rounded border border-slate-300"><option value="SEMUA">-- Semua Satlat --</option>{VERIFIED_36_SATLATS.map((sat) => (<option key={sat} value={sat}>{sat}</option>))}</select>
                <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} className="w-full text-xs font-bold p-2 rounded border border-slate-300"><option value="SEMUA">-- Semua Kelamin --</option><option value="PUTRA">Putra</option><option value="PUTRI">Putri</option></select>
                <select value={filterAgeGroup} onChange={(e) => setFilterAgeGroup(e.target.value)} className="w-full text-xs font-bold p-2 rounded border border-slate-300"><option value="SEMUA">-- Semua Umur --</option><option value="Usia Dini (SD)">Usia Dini (SD)</option><option value="Pelajar (SMP & SMA)">Pelajar</option><option value="UMUM">UMUM</option></select>
                <select value={filterCategoryType} onChange={(e) => setFilterCategoryType(e.target.value)} className="w-full text-xs font-bold p-2 rounded border border-slate-300"><option value="SEMUA">-- Semua Kategori --</option><option value="TARUNG">Tarung</option><option value="SENI">Seni Gerak</option></select>
                <select value={filterWeightClass} onChange={(e) => setFilterWeightClass(e.target.value)} className="w-full text-xs font-bold p-2 rounded border border-slate-300"><option value="SEMUA">-- Semua Kelas Berat --</option>{availableWeightClasses.map((cl) => (<option key={cl} value={cl}>{cl}</option>))}</select>
              </div>
            </div>
            
            {/* TABEL PUBLIK (BERSIH DARI TOMBOL EDIT) */}
            <div className="bg-white border-2 border-slate-950 rounded-2xl overflow-hidden shadow">
              <div className="bg-slate-950 text-white p-4 font-mono text-xs font-bold text-[#FF6600]">DAFTAR ATLET ({filteredAthletes.length} Ditemukan)</div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-300 font-extrabold text-xs">
                      <th className="p-3 w-14">No</th><th className="p-3">Nama Lengkap</th><th className="p-3">Asal Satlat</th><th className="p-3">TB / BB</th><th className="p-3">Kelas Tanding</th><th className="p-3 text-center">Status Administrasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAthletes.map((ath, i) => {
                      const verifiedCount = Object.values(verifications[ath.nama] || {}).filter(Boolean).length;
                      const isWeighed = ath.beratBadan && ath.beratBadan !== '-' && parseFloat(ath.beratBadan) > 0;
                      return (
                        <tr key={i} onClick={() => setSelectedAthlete(ath)} className="hover:bg-slate-100 cursor-pointer border-b">
                          <td className="p-3 text-center font-bold bg-slate-50">{i + 1}</td>
                          <td className="p-3 font-black uppercase text-lg">{ath.nama}</td>
                          <td className="p-3 font-bold uppercase">{ath.satlat}</td>
                          <td className="p-3 font-bold">{ath.tinggiBadan || '-'} / <span className="text-[#FF6600] font-black">{isWeighed ? `${ath.beratBadan} kg` : 'BLM TIMBANG'}</span></td>
                          <td className="p-3 font-bold uppercase text-sm">{ath.subKategori}<br/><span className="text-[#FF6600]">{ath.kelasTanding}</span></td>
                          <td className="p-3 text-center"><span className={`px-3 py-1 rounded-lg text-xs font-bold ${verifiedCount === 6 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-900 border'}`}>{verifiedCount === 6 ? 'LENGKAP' : 'BELUM LENGKAP'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentNavTab === 'admin' && (
          <div className="space-y-6">
            {!isLoggedIn ? (
              <div className="min-h-[50vh] flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white border-4 border-[#FF6600] rounded-2xl p-6 shadow-2xl space-y-6">
                  <h3 className="text-xl font-black uppercase text-center border-b-2 pb-4">AKREDITASI DEWAN PANITIA</h3>
                  {loginError && <div className="bg-red-50 text-red-900 font-bold p-3 text-center text-sm">{loginError}</div>}
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="Nama Panitia..." className="w-full border-2 border-slate-900 rounded p-3 font-bold" required />
                    <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="PIN Sandi..." className="w-full border-2 border-slate-900 rounded p-3 font-bold" required />
                    <button type="submit" className="w-full bg-slate-950 text-[#FF6600] font-black uppercase py-3 rounded">Masuk Panel</button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-950 text-white p-6 rounded-2xl flex justify-between items-center"><h3 className="text-xl font-black uppercase">Halo, {activeCommitteeName} 👋</h3><button onClick={() => setIsLoggedIn(false)} className="bg-red-700 text-white font-bold px-4 py-2 rounded text-sm">Keluar</button></div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-6 lg:col-span-1">
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-4">
                      <h4 className="font-black text-sm uppercase border-b pb-2">PENGUMUMAN DINDING</h4>
                      <textarea rows={3} value={announcementDraft} onChange={(e) => setAnnouncementDraft(e.target.value)} className="w-full border rounded p-3 text-sm font-bold" />
                      <button onClick={() => { const msg = announcementDraft.trim(); setAnnouncement(msg); setAnnouncementPublisher(activeCommitteeName); localStorage.setItem('kbb_td_announcement_v3', msg); localStorage.setItem('kbb_td_announcement_publisher_v3', activeCommitteeName); alert('Ter-update!'); }} className="w-full bg-[#FF6600] font-black py-2 rounded text-sm">Publish Pengumuman</button>
                    </div>
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-4">
                      <h4 className="font-black text-sm uppercase border-b pb-2">GANTI TANGGAL</h4>
                      <input type="text" value={dateTimeStatus} onChange={(e) => { setDateTimeStatus(e.target.value); localStorage.setItem('kbb_td_datetime_status_v3', e.target.value); }} className="w-full border rounded p-2 text-sm font-bold" />
                    </div>
                  </div>
                  
                  {/* TABEL ADMIN & DROPDOWN EXPORT */}
                  <div className="lg:col-span-2 bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-4">
                    <h4 className="text-lg font-black uppercase border-b-2 pb-3">Manajemen Timbang & Export Data</h4>
                    <div className="bg-slate-100 border-2 border-slate-900 rounded-xl p-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <select value={exportSatlat} onChange={(e) => setExportSatlat(e.target.value)} className="w-full font-bold text-xs p-2 rounded border border-slate-900"><option value="SEMUA">-- Satlat --</option>{VERIFIED_36_SATLATS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                        <select value={exportGender} onChange={(e) => setExportGender(e.target.value)} className="w-full font-bold text-xs p-2 rounded border border-slate-900"><option value="SEMUA">-- Gender --</option><option value="PUTRA">Putra</option><option value="PUTRI">Putri</option></select>
                        <select value={exportAgeGroup} onChange={(e) => setExportAgeGroup(e.target.value)} className="w-full font-bold text-xs p-2 rounded border border-slate-900"><option value="SEMUA">-- Umur --</option><option value="Usia Dini (SD)">Usia Dini</option><option value="Pelajar (SMP & SMA)">Pelajar</option><option value="UMUM">UMUM</option></select>
                        <select value={exportCategoryType} onChange={(e) => setExportCategoryType(e.target.value)} className="w-full font-bold text-xs p-2 rounded border border-slate-900"><option value="SEMUA">-- Tanding --</option><option value="TARUNG">Tarung</option><option value="SENI">Seni</option></select>
                        <select value={exportWeightClass} onChange={(e) => setExportWeightClass(e.target.value)} className="w-full font-bold text-xs p-2 rounded border border-slate-900"><option value="SEMUA">-- Kelas BB --</option>{EXPORT_STRICT_WEIGHT_CLASSES.map(w => <option key={w} value={w}>{w}</option>)}</select>
                      </div>

                      {/* DROPDOWN UNDUH DATA REKAPITULASI (Ubah Mode File) */}
                      <div className="flex justify-end pt-3 border-t border-slate-300">
                        <div className="relative group">
                          <button disabled={exportFilteredAthletes.length === 0} className="flex items-center justify-center gap-2 bg-white text-slate-900 font-black text-xs uppercase px-5 py-2.5 rounded-xl border-2 border-orange-500 cursor-pointer shadow hover:bg-slate-50 transition-all" style={{ minHeight: '44px' }}>
                            <FileDown className="w-4 h-4 text-orange-500 shrink-0" /><span>Unduh Data Rekapitulasi</span>
                          </button>
                          {/* Menu Dropdown */}
                          <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 bg-white border-2 border-slate-900 rounded-xl shadow-xl overflow-hidden z-20">
                            <button onClick={handleExportExcel} className="w-full flex items-center gap-2 text-left px-4 py-3 hover:bg-slate-100 font-bold text-xs uppercase border-b border-slate-200 text-slate-900"><FileSpreadsheet className="w-4 h-4 text-green-700" /> Unduh (.xlsx)</button>
                            <button onClick={handleExportPDF} className="w-full flex items-center gap-2 text-left px-4 py-3 hover:bg-slate-100 font-bold text-xs uppercase text-slate-900"><FileDown className="w-4 h-4 text-red-600" /> Unduh (.pdf)</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <input type="text" placeholder="Cari atlet spesifik..." onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border p-2.5 rounded-lg font-bold text-sm" />
                    
                    <div className="overflow-x-auto border-2 border-slate-950 rounded-xl max-h-[450px]">
                      <table className="w-full text-left font-sans text-slate-950">
                        <thead>
                          <tr className="bg-slate-200 font-black border-b text-xs"><th className="p-3 w-12 text-center">No</th><th className="p-3">Nama Atlet</th><th className="p-3 text-center">Tinggi/Berat</th><th className="p-3">Golongan / Kelas Tanding Resmi</th><th className="p-3 text-center">Aksi Timbang</th></tr>
                        </thead>
                        <tbody className="divide-y bg-white font-bold text-sm">
                          {filteredAthletes.map((ath, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 text-base">
                              <td className="p-3 text-center bg-slate-50">{idx + 1}</td>
                              <td className="p-3 font-black uppercase"><div className="text-lg">{ath.nama}</div><div className="text-xs text-slate-500">{ath.satlat}</div></td>
                              <td className="p-3 text-center font-mono">{ath.tinggiBadan || '—'} / <strong className="text-[#FF6600]">{ath.beratBadan || '—'}</strong></td>
                              <td className="p-3 text-sm uppercase">[{getAgeCategory(ath.subKategori)}] {ath.subKategori}<br/><span className="text-[#FF6600] font-black">{ath.kelasTanding}</span></td>
                              <td className="p-3 text-center"><button onClick={() => handleOpenWeighModal(ath)} className="bg-slate-950 hover:bg-[#FF6600] hover:text-black text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase">Timbang / Edit</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedAthlete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-xl bg-white border-4 border-slate-950 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-5 bg-slate-950 text-white flex justify-between items-center"><h4 className="text-lg font-black uppercase">{selectedAthlete.nama}</h4><button onClick={() => setSelectedAthlete(null)} className="text-xs font-bold font-mono">CLOSE [X]</button></div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-100 p-4 rounded-xl font-bold text-sm uppercase">Satlat: {selectedAthlete.satlat}<br/>Kelas: <span className="text-[#FF6600]">{selectedAthlete.kelasTanding}</span></div>
              {Object.values(verifications[selectedAthlete.nama] || {}).filter(Boolean).length === 6 ? (<div className="bg-green-100 border-2 border-green-700 p-4 rounded-xl text-center text-green-900 font-black">✓ BERKAS LENGKAP</div>) : (<div className="bg-red-50 border-2 border-red-600 p-4 rounded-xl text-center text-red-900 font-black">⚠️ BERKAS BELUM LENGKAP</div>)}
              <div className="space-y-2">{OFFICIAL_DOCUMENTS_LIST.map((doc) => (<div key={doc.key} className="flex justify-between p-2 bg-slate-50 border rounded text-xs font-bold uppercase"><span className="text-slate-900">{doc.label}</span>{(verifications[selectedAthlete.nama] || {} as any)[doc.key] ? <span className="text-green-700 font-black">✓ ADA</span> : <span className="text-slate-500">KOSONG</span>}</div>))}</div>
            </div>
          </motion.div></div>
        )}

        {editingAthlete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md bg-white border-4 border-slate-950 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 text-white flex justify-between"><h4 className="font-black text-lg uppercase">{editingAthlete.nama}</h4><button onClick={() => setEditingAthlete(null)} className="bg-red-500 text-white px-3 text-xs font-black rounded">BATAL</button></div>
            <form onSubmit={handleSaveWeighResults}>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-black uppercase">Berat (KG):</label><input type="text" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} className="w-full border p-2 rounded font-bold" required /></div>
                  <div><label className="block text-xs font-black uppercase">Tinggi (CM):</label><input type="text" value={editHeight} onChange={(e) => setEditHeight(e.target.value)} className="w-full border p-2 rounded font-bold" required /></div>
                </div>
                <div><label className="block text-xs font-black uppercase">Geser Kelas Tanding:</label><select value={editWeightClass} onChange={(e) => setEditWeightClass(e.target.value)} className="w-full border-2 p-2 rounded font-bold text-xs">{STANDARD_WEIGHT_CLASSES.map((wc) => (<option key={wc} value={wc}>{wc}</option>))}</select></div>
                <div className="space-y-2 pt-3 border-t"><h5 className="font-black text-xs uppercase">VERIFIKASI BERKAS:</h5><div className="grid grid-cols-2 gap-2">{OFFICIAL_DOCUMENTS_LIST.map((doc) => { const checked = !!editChecklist[doc.key]; return (<button key={doc.key} type="button" onClick={() => setEditChecklist(prev => ({ ...prev, [doc.key]: !checked }))} className="flex items-center gap-2 p-2 border rounded font-black text-xs uppercase">{checked ? <CheckSquare className="text-green-700"/> : <Square className="text-slate-400"/>} {doc.label}</button>); })}</div></div>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end"><button type="submit" className="bg-[#FF6600] text-black font-black py-2.5 px-4 rounded border-2 border-slate-950">Simpan Data</button></div>
            </form>
          </motion.div></div>
        )}
      </AnimatePresence>
    </div>
  );
}
