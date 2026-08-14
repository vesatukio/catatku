/* =========================================================
   CATATKU
   APP.JS - FINAL 3 SHEET
   BARANG
   PENGELUARAN
   DATA

   Backend:
   Google Apps Script Web App

   ========================================================= */

"use strict";

/* =========================================================
   KONFIGURASI
   ========================================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbxqJ86xAmjCOp_xZ9RHanPKSJ_FlFdkA6f2_8e9LtFuAl570xWAse8AUhKU_Tp6oKSp/exec";

/*
Contoh:
const API_URL =
"https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
*/


/* =========================================================
   STATE APLIKASI
   ========================================================= */

const state = {
  currentPage: "dashboard",
  transactionType: "PEMASUKAN",

  dashboard: {},
  barang: [],
  history: [],
  hutang: [],
  kategori: [],

  offlineQueue: [],

  loading: false,
  syncing: false
};


/* =========================================================
   HELPER
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}


function rupiah(value) {
  value = Number(value || 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(value);
}


function angka(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  return Number(
    String(value)
      .replace(/[^\d.-]/g, "")
  ) || 0;
}


function tanggalHariIni() {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function idBaru(prefix = "ID") {
  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
  );
}


function toast(message, type = "normal") {
  const el = $("toast");

  if (!el) {
    alert(message);
    return;
  }

  el.textContent = message;
  el.className = "toast show " + type;

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 3000);
}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function saveLocal() {
  try {
    localStorage.setItem(
      "catatku_state",
      JSON.stringify({
        barang: state.barang,
        history: state.history,
        hutang: state.hutang,
        kategori: state.kategori,
        dashboard: state.dashboard
      })
    );
  } catch (err) {
    console.warn("Gagal menyimpan local:", err);
  }
}


function loadLocal() {
  try {
    const raw = localStorage.getItem("catatku_state");

    if (!raw) return;

    const data = JSON.parse(raw);

    state.barang = Array.isArray(data.barang)
      ? data.barang
      : [];

    state.history = Array.isArray(data.history)
      ? data.history
      : [];

    state.hutang = Array.isArray(data.hutang)
      ? data.hutang
      : [];

    state.kategori = Array.isArray(data.kategori)
      ? data.kategori
      : [];

    state.dashboard = data.dashboard || {};

  } catch (err) {
    console.warn("Local data rusak:", err);
  }
}


/* =========================================================
   OFFLINE QUEUE
   ========================================================= */

function loadQueue() {
  try {
    state.offlineQueue =
      JSON.parse(
        localStorage.getItem("catatku_queue") || "[]"
      );

    if (!Array.isArray(state.offlineQueue)) {
      state.offlineQueue = [];
    }

  } catch (err) {
    state.offlineQueue = [];
  }

  updateSyncBadge();
}


function saveQueue() {
  localStorage.setItem(
    "catatku_queue",
    JSON.stringify(state.offlineQueue)
  );

  updateSyncBadge();
}


function addQueue(action, data) {

  state.offlineQueue.push({
    id: idBaru("QUEUE"),
    action: action,
    data: data,
    createdAt: new Date().toISOString()
  });

  saveQueue();

  updateSyncText();
}


function updateSyncBadge() {

  const badge = $("syncBadge");

  if (!badge) return;

  const count = state.offlineQueue.length;

  badge.textContent = count;

  if (count > 0) {
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}


function updateSyncText(text) {

  const el = $("syncText");

  if (!el) return;

  if (text) {
    el.textContent = text;
    return;
  }

  if (!navigator.onLine) {
    el.textContent = "Offline — data disimpan di HP";
  } else if (state.offlineQueue.length > 0) {
    el.textContent =
      state.offlineQueue.length +
      " data menunggu sinkronisasi";
  } else {
    el.textContent = "Data tersimpan otomatis";
  }
}


/* =========================================================
   STATUS ONLINE
   ========================================================= */

function updateOnlineStatus() {

  const dot = $("onlineDot");
  const text = $("onlineText");

  if (navigator.onLine) {

    if (dot) {
      dot.classList.add("online");
      dot.classList.remove("offline");
    }

    if (text) {
      text.textContent = "Online";
    }

  } else {

    if (dot) {
      dot.classList.remove("online");
      dot.classList.add("offline");
    }

    if (text) {
      text.textContent = "Offline";
    }
  }

  updateSyncText();
}


window.addEventListener(
  "online",
  () => {
    updateOnlineStatus();

    setTimeout(() => {
      syncOffline();
    }, 500);
  }
);


window.addEventListener(
  "offline",
  updateOnlineStatus
);


/* =========================================================
   API GAS
   ========================================================= */

async function api(action, data = {}) {

  if (
    !API_URL ||
    API_URL.includes("ISI_URL")
  ) {
    throw new Error(
      "API_URL GAS belum diisi di app.js"
    );
  }

  const params = new URLSearchParams();

  params.append("action", action);

  Object.keys(data).forEach(key => {

    let value = data[key];

    if (
      value !== null &&
      typeof value === "object"
    ) {
      value = JSON.stringify(value);
    }

    params.append(
      key,
      value === undefined || value === null
        ? ""
        : value
    );
  });

  const response = await fetch(
    API_URL + "?" + params.toString(),
    {
      method: "GET",
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      "HTTP " + response.status
    );
  }

  const text = await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch (err) {
    console.error(text);

    throw new Error(
      "Response GAS bukan JSON"
    );
  }

  if (
    result &&
    result.success === false
  ) {
    throw new Error(
      result.error ||
      result.message ||
      "GAS gagal memproses data"
    );
  }

  return result;
}


/* =========================================================
   LOAD SEMUA DATA
   ========================================================= */

async function loadAppData() {

  if (state.loading) return;

  state.loading = true;

  try {

    updateSyncText("Mengambil data...");

    const result = await api(
      "appData"
    );

    console.log(
      "APP DATA:",
      result
    );

    /*
      Mendukung beberapa bentuk response GAS
    */

    const data =
      result.data ||
      result;

    if (Array.isArray(data.barang)) {
      state.barang = data.barang;
    }

    if (Array.isArray(data.history)) {
      state.history = data.history;
    }

    if (Array.isArray(data.hutang)) {
      state.hutang = data.hutang;
    }

    if (Array.isArray(data.kategori)) {
      state.kategori = data.kategori;
    }

    if (data.dashboard) {
      state.dashboard =
        data.dashboard;
    }

    saveLocal();

    renderAll();

    updateSyncText();

  } catch (err) {

    console.error(
      "Load GAS gagal:",
      err
    );

    /*
      Kalau internet gagal,
      gunakan data terakhir di HP.
    */

    loadLocal();

    renderAll();

    updateSyncText(
      "Offline — memakai data tersimpan"
    );

  } finally {

    state.loading = false;
  }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {

  try {

    const result = await api(
      "dashboard"
    );

    state.dashboard =
      result.data ||
      result ||
      {};

    renderDashboard();

    saveLocal();

  } catch (err) {

    console.warn(
      "Dashboard gagal:",
      err.message
    );
  }
}


function renderDashboard() {

  const d =
    state.dashboard || {};

  const saldo =
    angka(
      d.saldo ??
      d.saldoSaatIni
    );

  const pemasukan =
    angka(
      d.pemasukan ??
      d.totalPemasukan
    );

  const pengeluaran =
    angka(
      d.pengeluaran ??
      d.totalPengeluaran
    );

  const penjualan =
    angka(
      d.penjualan ??
      d.totalPenjualan
    );

  const hutang =
    angka(
      d.totalHutang ??
      d.hutang
    );

  setText(
    "saldo",
    rupiah(saldo)
  );

  setText(
    "totalPemasukan",
    rupiah(pemasukan)
  );

  setText(
    "totalPengeluaran",
    rupiah(pengeluaran)
  );

  setText(
    "totalPenjualan",
    rupiah(penjualan)
  );

  setText(
    "totalHutang",
    rupiah(hutang)
  );
}


function setText(id, value) {

  const el = $(id);

  if (el) {
    el.textContent = value;
  }
}


/* =========================================================
   PAGE
   ========================================================= */

function showPage(page) {

  state.currentPage = page;

  document
    .querySelectorAll(".page")
    .forEach(el => {
      el.classList.remove("active");
    });

  const target =
    $("page-" + page);

  if (target) {
    target.classList.add("active");
  }

  /*
    bottom nav
  */

  document
    .querySelectorAll(".nav-item")
    .forEach(el => {
      el.classList.remove("active");
    });

  const navMap = {
    dashboard: 0,
    add: 1,
    barang: 2
  };

  if (
    Object.prototype.hasOwnProperty.call(
      navMap,
      page
    )
  ) {

    const nav =
      document.querySelectorAll(
        ".nav-item"
      )[navMap[page]];

    if (nav) {
      nav.classList.add("active");
    }
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  closeQuickAdd();
}


function refreshApp() {
  loadAppData();
}


/* =========================================================
   TRANSACTION TYPE
   ========================================================= */

function setTransactionType(type) {

  state.transactionType = type;

  const income =
    $("tabIncome");

  const expense =
    $("tabExpense");

  if (income) {
    income.classList.toggle(
      "active",
      type === "PEMASUKAN"
    );
  }

  if (expense) {
    expense.classList.toggle(
      "active",
      type === "PENGELUARAN"
    );
  }

  loadKategori(type);
}


/* =========================================================
   KATEGORI
   ========================================================= */

async function loadKategori(type) {

  const select =
    $("trxKategori");

  if (!select) return;

  select.innerHTML =
    '<option value="">Pilih kategori</option>';

  let list =
    state.kategori || [];

  /*
    Jika belum ada kategori lokal,
    coba ambil dari GAS.
  */

  if (!list.length && navigator.onLine) {

    try {

      const result =
        await api("kategori");

      list =
        result.data ||
        result.kategori ||
        [];

      if (Array.isArray(list)) {
        state.kategori = list;
        saveLocal();
      }

    } catch (err) {
      console.warn(
        "Kategori gagal:",
        err.message
      );
    }
  }

  if (!Array.isArray(list)) {
    list = [];
  }

  list.forEach(item => {

    let nama;

    if (typeof item === "string") {
      nama = item;
    } else {
      nama =
        item.nama ||
        item.Kategori ||
        item.kategori ||
        item.name;
    }

    if (!nama) return;

    /*
      Jika kategori memiliki jenis,
      filter berdasarkan PEMASUKAN/PENGELUARAN.
    */

    const jenis =
      String(
        item.jenis ||
        item.Jenis ||
        ""
      ).toUpperCase();

    if (
      jenis &&
      jenis !== type
    ) {
      return;
    }

    const option =
      document.createElement("option");

    option.value = nama;
    option.textContent = nama;

    select.appendChild(option);
  });
}


/* =========================================================
   SIMPAN TRANSAKSI
   SHEET: PENGELUARAN
   ========================================================= */

async function submitTransaction() {

  const tanggal =
    $("trxTanggal")?.value ||
    tanggalHariIni();

  const kategori =
    $("trxKategori")?.value ||
    "";

  const keterangan =
    $("trxKeterangan")?.value.trim() ||
    "";

  const nominal =
    angka(
      $("trxNominal")?.value
    );

  const rekening =
    $("trxRekening")?.value.trim() ||
    "Kas";

  if (!kategori) {
    toast(
      "Pilih kategori terlebih dahulu",
      "error"
    );
    return;
  }

  if (!keterangan) {
    toast(
      "Keterangan belum diisi",
      "error"
    );
    return;
  }

  if (nominal <= 0) {
    toast(
      "Nominal harus lebih dari 0",
      "error"
    );
    return;
  }

  const data = {

    ID: idBaru("TRX"),

    CreatedAt:
      new Date().toISOString(),

    UpdatedAt:
      new Date().toISOString(),

    Tanggal: tanggal,

    Kategori: kategori,

    Keterangan: keterangan,

    Nominal: nominal,

    Jenis:
      state.transactionType,

    Rekening: rekening
  };


  /*
    Optimistic update lokal
  */

  state.history.unshift({
    ...data
  });

  saveLocal();

  renderHistory();
  renderRecent();

  if (!navigator.onLine) {

    addQueue(
      "tambahTransaksi",
      data
    );

    toast(
      "Tersimpan di HP. Akan disinkronkan saat online.",
      "success"
    );

    resetTransactionForm();

    return;
  }


  try {

    await api(
      "tambahTransaksi",
      data
    );

    toast(
      "Transaksi berhasil disimpan",
      "success"
    );

    resetTransactionForm();

    await loadAppData();

  } catch (err) {

    console.error(err);

    /*
      Jika GAS gagal,
      jangan hilangkan data.
    */

    addQueue(
      "tambahTransaksi",
      data
    );

    toast(
      "Internet/GAS bermasalah. Data disimpan sementara.",
      "warning"
    );
  }
}


function resetTransactionForm() {

  const form =
    $("transactionForm");

  if (form) {
    form.reset();
  }

  if ($("trxTanggal")) {
    $("trxTanggal").value =
      tanggalHariIni();
  }

  if ($("trxRekening")) {
    $("trxRekening").value =
      "Kas";
  }

  setTransactionType(
    state.transactionType
  );
}


/* =========================================================
   BARANG
   SHEET: BARANG
   ========================================================= */

async function submitBarang() {

  const nama =
    $("barangNama")?.value.trim();

  const modal =
    angka(
      $("barangModalPrice")?.value
    );

  const jual =
    angka(
      $("barangJualPrice")?.value
    );

  const stok =
    angka(
      $("barangStok")?.value
    );

  if (!nama) {
    toast(
      "Nama barang wajib diisi",
      "error"
    );
    return;
  }

  const now =
    new Date().toISOString();

  const data = {

    ID: idBaru("BRG"),

    "Nama Barang": nama,

    Nama: nama,

    Kategori: "",

    Modal: modal,

    "Harga Modal": modal,

    "Laba%":
      modal > 0
        ? ((jual - modal) / modal) * 100
        : 0,

    "Laba Nominal":
      jual - modal,

    Jual: jual,

    "Harga Jual": jual,

    Stok: stok,

    Minimum: 0,

    Supplier: "",

    createdAt: now,

    updatedAt: now
  };


  /*
    Update lokal
  */

  state.barang.push({
    ...data
  });

  saveLocal();

  renderBarang();
  populateBarangSelect();


  if (!navigator.onLine) {

    addQueue(
      "tambahBarang",
      data
    );

    toast(
      "Barang disimpan di HP. Akan disinkronkan nanti.",
      "success"
    );

    resetBarangForm();

    return;
  }


  try {

    await api(
      "tambahBarang",
      data
    );

    toast(
      "Barang berhasil disimpan",
      "success"
    );

    resetBarangForm();

    closeModal(
      "barangModal"
    );

    await loadAppData();

  } catch (err) {

    console.error(err);

    addQueue(
      "tambahBarang",
      data
    );

    toast(
      "Gagal ke server. Barang disimpan sementara.",
      "warning"
    );

    closeModal(
      "barangModal"
    );
  }
}


function resetBarangForm() {

  const form =
    $("barangForm");

  if (form) {
    form.reset();
  }

  if ($("barangStok")) {
    $("barangStok").value = 0;
  }
}


/* =========================================================
   PENJUALAN
   SHEET: DATA
   ========================================================= */

async function submitPenjualan() {

  const barangID =
    $("jualBarang")?.value;

  const barang =
    state.barang.find(
      b =>
        String(
          b.ID ||
          b.id
        ) === String(barangID)
    );

  if (!barang) {

    toast(
      "Pilih barang",
      "error"
    );

    return;
  }

  const qty =
    angka(
      $("jualQty")?.value
    );

  const harga =
    angka(
      $("jualHarga")?.value
    );

  const pelanggan =
    $("jualPelanggan")?.value.trim();

  if (qty <= 0) {
    toast(
      "Jumlah tidak valid",
      "error"
    );
    return;
  }

  if (harga <= 0) {
    toast(
      "Harga jual tidak valid",
      "error"
    );
    return;
  }


  const data = {

    ID: idBaru("JUAL"),

    CreatedAt:
      new Date().toISOString(),

    UpdatedAt:
      new Date().toISOString(),

    Entity:
      "PENJUALAN",

    Tanggal:
      tanggalHariIni(),

    Jenis:
      "PEMASUKAN",

    Kategori:
      "Penjualan",

    Keterangan:
      "Penjualan " +
      (
        barang["Nama Barang"] ||
        barang.Nama ||
        ""
      ),

    Nominal:
      qty * harga,

    Rekening:
      "Kas",

    BarangID:
      barang.ID ||
      barang.id,

    BarangNama:
      barang["Nama Barang"] ||
      barang.Nama ||
      "",

    Qty: qty,

    Harga: harga,

    Supplier: "",

    Pelanggan:
      pelanggan || "Umum"
  };


  /*
    Kurangi stok lokal
  */

  const stokLama =
    angka(
      barang.Stok ||
      barang.stok
    );

  barang.Stok =
    stokLama - qty;

  saveLocal();

  renderBarang();
  renderDashboard();


  if (!navigator.onLine) {

    addQueue(
      "tambahPenjualan",
      data
    );

    toast(
      "Penjualan tersimpan offline",
      "success"
    );

    resetPenjualanForm();

    return;
  }


  try {

    await api(
      "tambahPenjualan",
      data
    );

    toast(
      "Penjualan berhasil disimpan",
      "success"
    );

    resetPenjualanForm();

    await loadAppData();

  } catch (err) {

    console.error(err);

    addQueue(
      "tambahPenjualan",
      data
    );

    toast(
      "Disimpan sementara. Akan sinkron otomatis.",
      "warning"
    );
  }
}


function resetPenjualanForm() {

  const form =
    $("penjualanForm");

  if (form) {
    form.reset();
  }

  if ($("jualQty")) {
    $("jualQty").value = 1;
  }

  if ($("jualTotalPreview")) {
    $("jualTotalPreview").textContent =
      rupiah(0);
  }
}


/* =========================================================
   BELANJA
   SHEET: DATA
   ========================================================= */

async function submitBelanja() {

  const barangID =
    $("belanjaBarang")?.value;

  const barang =
    state.barang.find(
      b =>
        String(
          b.ID ||
          b.id
        ) === String(barangID)
    );

  if (!barang) {

    toast(
      "Pilih barang",
      "error"
    );

    return;
  }

  const qty =
    angka(
      $("belanjaQty")?.value
    );

  const harga =
    angka(
      $("belanjaHarga")?.value
    );

  const supplier =
    $("belanjaSupplier")?.value.trim();

  if (qty <= 0) {
    toast(
      "Jumlah tidak valid",
      "error"
    );
    return;
  }

  if (harga <= 0) {
    toast(
      "Harga modal tidak valid",
      "error"
    );
    return;
  }


  const data = {

    ID: idBaru("BELI"),

    CreatedAt:
      new Date().toISOString(),

    UpdatedAt:
      new Date().toISOString(),

    Entity:
      "BELANJA",

    Tanggal:
      tanggalHariIni(),

    Jenis:
      "PENGELUARAN",

    Kategori:
      "Belanja Stok",

    Keterangan:
      "Belanja " +
      (
        barang["Nama Barang"] ||
        barang.Nama ||
        ""
      ),

    Nominal:
      qty * harga,

    Rekening:
      "Kas",

    BarangID:
      barang.ID ||
      barang.id,

    BarangNama:
      barang["Nama Barang"] ||
      barang.Nama ||
      "",

    Qty: qty,

    Harga: harga,

    Supplier:
      supplier || ""
  };


  /*
    Tambah stok lokal
  */

  barang.Stok =
    angka(
      barang.Stok ||
      barang.stok
    ) + qty;

  saveLocal();

  renderBarang();


  if (!navigator.onLine) {

    addQueue(
      "tambahBelanja",
      data
    );

    toast(
      "Belanja tersimpan offline",
      "success"
    );

    resetBelanjaForm();

    return;
  }


  try {

    await api(
      "tambahBelanja",
      data
    );

    toast(
      "Belanja berhasil disimpan",
      "success"
    );

    resetBelanjaForm();

    await loadAppData();

  } catch (err) {

    console.error(err);

    addQueue(
      "tambahBelanja",
      data
    );

    toast(
      "Disimpan sementara. Akan sinkron otomatis.",
      "warning"
    );
  }
}


function resetBelanjaForm() {

  const form =
    $("belanjaForm");

  if (form) {
    form.reset();
  }

  if ($("belanjaQty")) {
    $("belanjaQty").value = 1;
  }

  if ($("belanjaTotalPreview")) {
    $("belanjaTotalPreview").textContent =
      rupiah(0);
  }
}


/* =========================================================
   HUTANG
   SHEET: DATA
   ========================================================= */

async function submitHutang() {

  const nama =
    $("hutangNama")?.value.trim();

  const nominal =
    angka(
      $("hutangNominal")?.value
    );

  const jatuhTempo =
    $("hutangTempo")?.value ||
    "";

  const keterangan =
    $("hutangKeterangan")?.value.trim() ||
    "";

  if (!nama) {

    toast(
      "Nama/pihak wajib diisi",
      "error"
    );

    return;
  }

  if (nominal <= 0) {

    toast(
      "Nominal hutang tidak valid",
      "error"
    );

    return;
  }


  const data = {

    ID: idBaru("HUT"),

    CreatedAt:
      new Date().toISOString(),

    UpdatedAt:
      new Date().toISOString(),

    Entity:
      "HUTANG",

    Nama:
      nama,

    JatuhTempo:
      jatuhTempo,

    Nominal:
      nominal,

    Dibayar:
      0,

    Status:
      "BELUM LUNAS",

    status:
      "BELUM LUNAS",

    Keterangan:
      keterangan
  };


  state.hutang.unshift({
    ...data
  });

  saveLocal();

  renderHutang();


  if (!navigator.onLine) {

    addQueue(
      "tambahHutang",
      data
    );

    toast(
      "Hutang tersimpan offline",
      "success"
    );

    resetHutangForm();

    closeModal(
      "hutangModal"
    );

    return;
  }


  try {

    await api(
      "tambahHutang",
      data
    );

    toast(
      "Hutang berhasil disimpan",
      "success"
    );

    resetHutangForm();

    closeModal(
      "hutangModal"
    );

    await loadAppData();

  } catch (err) {

    console.error(err);

    addQueue(
      "tambahHutang",
      data
    );

    toast(
      "Disimpan sementara. Akan sinkron otomatis.",
      "warning"
    );

    closeModal(
      "hutangModal"
    );
  }
}


function resetHutangForm() {

  const form =
    $("hutangForm");

  if (form) {
    form.reset();
  }
}


/* =========================================================
   SINKRONISASI OFFLINE
   ========================================================= */

async function syncOffline() {

  if (state.syncing) {
    return;
  }

  if (!navigator.onLine) {

    toast(
      "Tidak ada internet",
      "warning"
    );

    return;
  }

  if (
    state.offlineQueue.length === 0
  ) {

    updateSyncText(
      "Semua data sudah tersinkron"
    );

    await loadAppData();

    return;
  }


  state.syncing = true;

  updateSyncText(
    "Menyinkronkan data..."
  );


  let berhasil = 0;

  const queue =
    [...state.offlineQueue];


  for (const item of queue) {

    try {

      await api(
        item.action,
        item.data
      );

      state.offlineQueue =
        state.offlineQueue.filter(
          q => q.id !== item.id
        );

      berhasil++;

      saveQueue();

    } catch (err) {

      console.error(
        "Sync gagal:",
        item,
        err
      );

      /*
        Stop sementara.
        Item tetap berada di queue.
      */

      break;
    }
  }


  state.syncing = false;

  saveQueue();

  if (
    state.offlineQueue.length === 0
  ) {

    updateSyncText(
      "Semua data sudah tersinkron"
    );

    toast(
      berhasil +
      " data berhasil disinkronkan",
      "success"
    );

    await loadAppData();

  } else {

    updateSyncText(
      state.offlineQueue.length +
      " data belum tersinkron"
    );
  }
}


/* =========================================================
   RENDER BARANG
   ========================================================= */

function renderBarang(
  keyword = ""
) {

  const container =
    $("barangList");

  if (!container) return;

  keyword =
    String(keyword)
      .toLowerCase()
      .trim();

  const list =
    state.barang.filter(item => {

      const nama =
        String(
          item["Nama Barang"] ||
          item.Nama ||
          item.nama ||
          ""
        ).toLowerCase();

      return !keyword ||
        nama.includes(keyword);
    });


  if (!list.length) {

    container.innerHTML =
      '<div class="empty">Belum ada barang.</div>';

    return;
  }


  container.innerHTML =
    list.map(item => {

      const nama =
        item["Nama Barang"] ||
        item.Nama ||
        item.nama ||
        "-";

      const modal =
        angka(
          item.Modal ||
          item["Harga Modal"]
        );

      const jual =
        angka(
          item.Jual ||
          item["Harga Jual"]
        );

      const stok =
        angka(
          item.Stok ||
          item.stok
        );

      const kategori =
        item.Kategori ||
        item.kategori ||
        "";


      return `
        <div class="product-card">

          <div class="product-main">

            <div class="product-name">
              ${escapeHTML(nama)}
            </div>

            ${
              kategori
                ? `<div class="product-category">
                    ${escapeHTML(kategori)}
                   </div>`
                : ""
            }

          </div>

          <div class="product-info">

            <div>
              <small>Modal</small>
              <strong>${rupiah(modal)}</strong>
            </div>

            <div>
              <small>Jual</small>
              <strong>${rupiah(jual)}</strong>
            </div>

            <div>
              <small>Stok</small>
              <strong>${stok}</strong>
            </div>

          </div>

        </div>
      `;

    }).join("");
}


function filterBarang(value) {
  renderBarang(value);
}


/* =========================================================
   SELECT BARANG
   ========================================================= */

function populateBarangSelect() {

  const jual =
    $("jualBarang");

  const belanja =
    $("belanjaBarang");


  if (jual) {

    jual.innerHTML =
      '<option value="">Pilih barang</option>';

    state.barang.forEach(item => {

      const id =
        item.ID ||
        item.id;

      const nama =
        item["Nama Barang"] ||
        item.Nama ||
        item.nama ||
        "-";

      const option =
        document.createElement("option");

      option.value = id;

      option.textContent =
        nama;

      jual.appendChild(option);
    });
  }


  if (belanja) {

    belanja.innerHTML =
      '<option value="">Pilih barang</option>';

    state.barang.forEach(item => {

      const id =
        item.ID ||
        item.id;

      const nama =
        item["Nama Barang"] ||
        item.Nama ||
        item.nama ||
        "-";

      const option =
        document.createElement("option");

      option.value = id;

      option.textContent =
        nama;

      belanja.appendChild(option);
    });
  }
}


/* =========================================================
   HARGA OTOMATIS PENJUALAN
   ========================================================= */

function updateHargaJual() {

  const id =
    $("jualBarang")?.value;

  const item =
    state.barang.find(
      b =>
        String(
          b.ID ||
          b.id
        ) === String(id)
    );

  if (!item) return;

  const harga =
    angka(
      item.Jual ||
      item["Harga Jual"]
    );

  if ($("jualHarga")) {
    $("jualHarga").value =
      harga;
  }

  updateJualTotal();
}


function updateJualTotal() {

  const qty =
    angka(
      $("jualQty")?.value
    );

  const harga =
    angka(
      $("jualHarga")?.value
    );

  setText(
    "jualTotalPreview",
    rupiah(qty * harga)
  );
}


function updateBelanjaTotal() {

  const qty =
    angka(
      $("belanjaQty")?.value
    );

  const harga =
    angka(
      $("belanjaHarga")?.value
    );

  setText(
    "belanjaTotalPreview",
    rupiah(qty * harga)
  );
}


/* =========================================================
   HISTORY
   ========================================================= */

function renderHistory(
  keyword = ""
) {

  const container =
    $("historyList");

  if (!container) return;

  keyword =
    String(keyword)
      .toLowerCase()
      .trim();


  const list =
    state.history.filter(item => {

      const text =
        [
          item.Tanggal,
          item.Kategori,
          item.Keterangan,
          item.Jenis,
          item.Rekening
        ]
          .join(" ")
          .toLowerCase();

      return !keyword ||
        text.includes(keyword);
    });


  if (!list.length) {

    container.innerHTML =
      '<div class="empty">Belum ada transaksi.</div>';

    return;
  }


  container.innerHTML =
    list
      .slice(0, 100)
      .map(item => {

        const jenis =
          String(
            item.Jenis ||
            ""
          ).toUpperCase();

        const nominal =
          angka(
            item.Nominal
          );

        const positive =
          jenis === "PEMASUKAN";


        return `
          <div class="transaction-item">

            <div class="transaction-icon">
              ${positive ? "↗" : "↘"}
            </div>

            <div class="transaction-content">

              <strong>
                ${escapeHTML(
                  item.Keterangan ||
                  item.Kategori ||
                  "-"
                )}
              </strong>

              <small>
                ${escapeHTML(
                  item.Tanggal || ""
                )}
                ·
                ${escapeHTML(
                  item.Kategori || ""
                )}
              </small>

            </div>

            <div class="transaction-amount ${
              positive
                ? "income-text"
                : "expense-text"
            }">

              ${positive ? "+" : "-"}
              ${rupiah(nominal)}

            </div>

          </div>
        `;

      })
      .join("");
}


function filterHistory(value) {
  renderHistory(value);
}


function renderRecent() {

  const container =
    $("recentTransactions");

  if (!container) return;

  const list =
    state.history.slice(0, 5);

  if (!list.length) {

    container.innerHTML =
      '<div class="empty">Belum ada transaksi</div>';

    return;
  }

  /*
    gunakan render sederhana
  */

  container.innerHTML =
    list.map(item => {

      const jenis =
        String(
          item.Jenis || ""
        ).toUpperCase();

      const nominal =
        angka(
          item.Nominal
        );

      return `
        <div class="transaction-item">

          <div class="transaction-icon">
            ${
              jenis === "PEMASUKAN"
                ? "↗"
                : "↘"
            }
          </div>

          <div class="transaction-content">
            <strong>
              ${escapeHTML(
                item.Keterangan ||
                item.Kategori ||
                "-"
              )}
            </strong>

            <small>
              ${escapeHTML(
                item.Tanggal || ""
              )}
            </small>
          </div>

          <div class="transaction-amount">
            ${rupiah(nominal)}
          </div>

        </div>
      `;

    }).join("");
}


/* =========================================================
   HUTANG
   ========================================================= */

function renderHutang() {

  const container =
    $("hutangList");

  if (!container) return;

  if (!state.hutang.length) {

    container.innerHTML =
      '<div class="empty">Belum ada hutang.</div>';

    return;
  }


  container.innerHTML =
    state.hutang.map(item => {

      const nominal =
        angka(
          item.Nominal
        );

      const dibayar =
        angka(
          item.Dibayar
        );

      const sisa =
        Math.max(
          nominal - dibayar,
          0
        );

      const nama =
        item.Nama ||
        item.nama ||
        "-";

      const status =
        item.Status ||
        item.status ||
        (
          sisa <= 0
            ? "LUNAS"
            : "BELUM LUNAS"
        );


      return `
        <div class="debt-card">

          <div class="debt-head">

            <strong>
              ${escapeHTML(nama)}
            </strong>

            <span>
              ${escapeHTML(status)}
            </span>

          </div>

          <div class="debt-amount">
            ${rupiah(sisa)}
          </div>

          ${
            item.JatuhTempo
              ? `<small>
                  Jatuh tempo:
                  ${escapeHTML(item.JatuhTempo)}
                 </small>`
              : ""
          }

        </div>
      `;

    }).join("");
}


/* =========================================================
   LAPORAN
   ========================================================= */

async function loadReport() {

  const start =
    $("reportStart")?.value;

  const end =
    $("reportEnd")?.value;


  if (!start || !end) {

    toast(
      "Pilih tanggal laporan",
      "error"
    );

    return;
  }


  const result =
    $("reportResult");

  if (result) {
    result.innerHTML =
      "Memuat laporan...";
  }


  try {

    const response =
      await api(
        "laporan",
        {
          start: start,
          end: end
        }
      );


    const data =
      response.data ||
      response ||
      {};


    const pemasukan =
      angka(
        data.pemasukan
      );

    const pengeluaran =
      angka(
        data.pengeluaran
      );

    const saldo =
      pemasukan -
      pengeluaran;


    if (result) {

      result.innerHTML = `
        <div class="report-row">
          <span>Pemasukan</span>
          <strong>${rupiah(pemasukan)}</strong>
        </div>

        <div class="report-row">
          <span>Pengeluaran</span>
          <strong>${rupiah(pengeluaran)}</strong>
        </div>

        <div class="report-row total">
          <span>Selisih</span>
          <strong>${rupiah(saldo)}</strong>
        </div>
      `;
    }

  } catch (err) {

    console.error(err);

    if (result) {
      result.innerHTML =
        "Laporan gagal dimuat.";
    }

    toast(
      err.message,
      "error"
    );
  }
}


/* =========================================================
   QUICK TRANSACTION
   ========================================================= */

function quickTransaction(type) {

  showPage("add");

  setTransactionType(type);

  closeQuickAdd();

  setTimeout(() => {

    const nominal =
      $("trxNominal");

    if (nominal) {
      nominal.focus();
    }

  }, 300);
}


function openQuickAdd() {

  const menu =
    $("quickAddMenu");

  if (menu) {
    menu.classList.toggle("show");
  }
}


function closeQuickAdd() {

  const menu =
    $("quickAddMenu");

  if (menu) {
    menu.classList.remove("show");
  }
}


/* =========================================================
   MORE MENU
   ========================================================= */

function showMoreMenu() {

  const menu =
    $("moreMenu");

  if (menu) {
    menu.classList.remove("hidden");
  }
}


function closeMoreMenu() {

  const menu =
    $("moreMenu");

  if (menu) {
    menu.classList.add("hidden");
  }
}


function openFromMenu(page) {

  closeMoreMenu();

  showPage(page);
}


/* =========================================================
   MODAL
   ========================================================= */

function openModal(id) {

  const modal = $(id);

  if (modal) {
    modal.classList.remove("hidden");
  }
}


function closeModal(id) {

  const modal = $(id);

  if (modal) {
    modal.classList.add("hidden");
  }
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   RENDER SEMUA
   ========================================================= */

function renderAll() {

  renderDashboard();

  renderBarang();

  populateBarangSelect();

  renderHistory();

  renderRecent();

  renderHutang();

  updateSyncBadge();

  updateOnlineStatus();
}


/* =========================================================
   FORM EVENT
   ========================================================= */

function setupForms() {

  const transactionForm =
    $("transactionForm");

  if (transactionForm) {

    transactionForm.addEventListener(
      "submit",
      function(e) {

        e.preventDefault();

        submitTransaction();
      }
    );
  }


  const barangForm =
    $("barangForm");

  if (barangForm) {

    barangForm.addEventListener(
      "submit",
      function(e) {

        e.preventDefault();

        submitBarang();
      }
    );
  }


  const penjualanForm =
    $("penjualanForm");

  if (penjualanForm) {

    penjualanForm.addEventListener(
      "submit",
      function(e) {

        e.preventDefault();

        submitPenjualan();
      }
    );
  }


  const belanjaForm =
    $("belanjaForm");

  if (belanjaForm) {

    belanjaForm.addEventListener(
      "submit",
      function(e) {

        e.preventDefault();

        submitBelanja();
      }
    );
  }


  const hutangForm =
    $("hutangForm");

  if (hutangForm) {

    hutangForm.addEventListener(
      "submit",
      function(e) {

        e.preventDefault();

        submitHutang();
      }
    );
  }


  /*
    tanggal transaksi
  */

  if ($("trxTanggal")) {

    $("trxTanggal").value =
      tanggalHariIni();
  }


  /*
    Penjualan
  */

  if ($("jualBarang")) {

    $("jualBarang").addEventListener(
      "change",
      updateHargaJual
    );
  }

  if ($("jualQty")) {

    $("jualQty").addEventListener(
      "input",
      updateJualTotal
    );
  }

  if ($("jualHarga")) {

    $("jualHarga").addEventListener(
      "input",
      updateJualTotal
    );
  }


  /*
    Belanja
  */

  if ($("belanjaQty")) {

    $("belanjaQty").addEventListener(
      "input",
      updateBelanjaTotal
    );
  }

  if ($("belanjaHarga")) {

    $("belanjaHarga").addEventListener(
      "input",
      updateBelanjaTotal
    );
  }
}


/* =========================================================
   START APPLICATION
   ========================================================= */

async function initApp() {

  console.log(
    "CatatKu starting..."
  );

  loadLocal();

  loadQueue();

  updateOnlineStatus();

  setupForms();

  renderAll();

  /*
    Tampilkan aplikasi dulu.
    Jangan menunggu GAS.
    Ini yang membuat loading tidak terasa lama.
  */

  const loading =
    $("loading");

  if (loading) {

    setTimeout(() => {

      loading.classList.add(
        "hidden"
      );

    }, 300);
  }


  /*
    Sinkron server setelah UI tampil
  */

  if (navigator.onLine) {

    await loadAppData();

    await syncOffline();

  } else {

    updateSyncText(
      "Offline — data tersimpan di HP"
    );
  }


  /*
    kategori
  */

  setTransactionType(
    state.transactionType
  );
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initApp
);


/* =========================================================
   GLOBAL
   Agar onclick dari index.html tetap bekerja
   ========================================================= */

window.showPage = showPage;
window.refreshApp = refreshApp;

window.syncOffline = syncOffline;

window.setTransactionType =
  setTransactionType;

window.quickTransaction =
  quickTransaction;

window.openQuickAdd =
  openQuickAdd;

window.closeQuickAdd =
  closeQuickAdd;

window.showMoreMenu =
  showMoreMenu;

window.closeMoreMenu =
  closeMoreMenu;

window.openFromMenu =
  openFromMenu;

window.openModal =
  openModal;

window.closeModal =
  closeModal;

window.filterBarang =
  filterBarang;

window.filterHistory =
  filterHistory;

window.loadReport =
  loadReport;
