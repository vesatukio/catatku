/* =========================================================
   CATATKU
   APP.JS FINAL
   Cocok dengan:
   - BARANG
   - PENGELUARAN
   - DATA

   Fitur:
   - Dashboard
   - Pemasukan
   - Pengeluaran
   - Barang
   - Penjualan
   - Belanja Stok
   - Hutang
   - Riwayat
   - Laporan
   - Refresh
   - Sinkronisasi
   - Offline queue sederhana
   ========================================================= */

"use strict";


/* =========================================================
   CONFIG
   ========================================================= */

const CONFIG = {

  // GANTI dengan URL Web App GAS Anda
  GAS_URL:
    "https://script.google.com/macros/s/AKfycbxrgQIppwaphvBIQjMbV6e5EO18C6O066k0jbBvRWPCKKV1rp9A7TQhZfM9_I01lL6a/exec",

  // Jika GAS Anda membutuhkan API KEY,
  // isi di sini.
  // Jika tidak digunakan, biarkan kosong.
  API_KEY: "",

  REQUEST_TIMEOUT: 20000,

  STORAGE_KEY:
    "catatku_app_data_v3",

  QUEUE_KEY:
    "catatku_offline_queue_v3"

};


/* =========================================================
   STATE
   ========================================================= */

const state = {

  currentPage: "dashboard",

  transactionType: "PEMASUKAN",

  data: {

    dashboard: {
      saldo: 0,
      pemasukan: 0,
      pengeluaran: 0,
      penjualan: 0,
      saldoPribadi: 0,
      saldoToko: 0,
      pemasukanPribadi: 0,
      pengeluaranPribadi: 0,
      pemasukanToko: 0,
      pengeluaranToko: 0,
      pemasukanHariIni: 0,
      pengeluaranHariIni: 0,
      totalHutang: 0,
      nilaiStok: 0,
      jumlahBarang: 0
    },

    kategori: [],

    barang: [],

    history: [],

    hutang: [],

    serverTime: null

  },

  filteredBarang: [],

  filteredHistory: [],

  loading: false

};


/* =========================================================
   SHORTCUT
   ========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  console.log("CatatKu app.js mulai...");

  initDateFields();

  initForms();

  initInputs();

  loadLocalData();

  updateOnlineStatus();

  updateSyncBadge();

  setTransactionType("PEMASUKAN");

  showPage("dashboard");

  loadAppData();

});


/* =========================================================
   DATE
   ========================================================= */

function todayString() {

  const d = new Date();

  const year =
    d.getFullYear();

  const month =
    String(d.getMonth() + 1)
      .padStart(2, "0");

  const day =
    String(d.getDate())
      .padStart(2, "0");

  return `${year}-${month}-${day}`;

}


function initDateFields() {

  const today =
    todayString();

  const trxTanggal =
    $("trxTanggal");

  if (trxTanggal && !trxTanggal.value) {
    trxTanggal.value = today;
  }

  const reportStart =
    $("reportStart");

  const reportEnd =
    $("reportEnd");

  if (reportEnd && !reportEnd.value) {
    reportEnd.value = today;
  }

  if (reportStart && !reportStart.value) {

    const d = new Date();

    d.setDate(
      d.getDate() - 30
    );

    reportStart.value =
      dateToInput(d);

  }

}


function dateToInput(date) {

  const y =
    date.getFullYear();

  const m =
    String(date.getMonth() + 1)
      .padStart(2, "0");

  const d =
    String(date.getDate())
      .padStart(2, "0");

  return `${y}-${m}-${d}`;

}


/* =========================================================
   FORMS
   ========================================================= */

function initForms() {

  const transactionForm =
    $("transactionForm");

  if (transactionForm) {

    transactionForm.addEventListener(
      "submit",
      saveTransaction
    );

  }


  const barangForm =
    $("barangForm");

  if (barangForm) {

    barangForm.addEventListener(
      "submit",
      saveBarang
    );

  }


  const penjualanForm =
    $("penjualanForm");

  if (penjualanForm) {

    penjualanForm.addEventListener(
      "submit",
      savePenjualan
    );

  }


  const belanjaForm =
    $("belanjaForm");

  if (belanjaForm) {

    belanjaForm.addEventListener(
      "submit",
      saveBelanja
    );

  }


  const hutangForm =
    $("hutangForm");

  if (hutangForm) {

    hutangForm.addEventListener(
      "submit",
      saveHutang
    );

  }

}


/* =========================================================
   INPUT EVENTS
   ========================================================= */

function initInputs() {

  const jualBarang =
    $("jualBarang");

  const jualQty =
    $("jualQty");

  const jualHarga =
    $("jualHarga");

  if (jualBarang) {

    jualBarang.addEventListener(
      "change",
      onJualBarangChange
    );

  }

  if (jualQty) {

    jualQty.addEventListener(
      "input",
      updateJualTotal
    );

  }

  if (jualHarga) {

    jualHarga.addEventListener(
      "input",
      updateJualTotal
    );

  }


  const belanjaBarang =
    $("belanjaBarang");

  const belanjaQty =
    $("belanjaQty");

  const belanjaHarga =
    $("belanjaHarga");

  if (belanjaBarang) {

    belanjaBarang.addEventListener(
      "change",
      onBelanjaBarangChange
    );

  }

  if (belanjaQty) {

    belanjaQty.addEventListener(
      "input",
      updateBelanjaTotal
    );

  }

  if (belanjaHarga) {

    belanjaHarga.addEventListener(
      "input",
      updateBelanjaTotal
    );

  }

}


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(page) {

  if (!page) {
    page = "dashboard";
  }

  console.log(
    "showPage:",
    page
  );

  document
    .querySelectorAll(".page")
    .forEach(section => {

      section.classList.remove(
        "active"
      );

    });


  const target =
    $("page-" + page);

  if (!target) {

    console.warn(
      "Halaman tidak ditemukan:",
      page
    );

    return;

  }


  target.classList.add("active");

  state.currentPage =
    page;


  document
    .querySelectorAll(".nav-item")
    .forEach(btn => {

      btn.classList.remove(
        "active"
      );

    });


  const navItems =
    document.querySelectorAll(
      ".nav-item"
    );


  if (page === "dashboard" && navItems[0]) {
    navItems[0].classList.add("active");
  }

  if (page === "add" && navItems[1]) {
    navItems[1].classList.add("active");
  }

  if (page === "barang" && navItems[3]) {
    navItems[3].classList.add("active");
  }


  closeQuickAdd();

  closeMoreMenu();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (page === "barang") {
    renderBarang();
  }

  if (page === "penjualan") {
    renderBarangSelect();
  }

  if (page === "belanja") {
    renderBarangSelect();
  }

  if (page === "history") {
    renderHistory();
  }

  if (page === "hutang") {
    renderHutang();
  }

}


/* =========================================================
   TRANSACTION TYPE
   ========================================================= */

function setTransactionType(type) {

  state.transactionType =
    type === "PENGELUARAN"
      ? "PENGELUARAN"
      : "PEMASUKAN";


  const tabIncome =
    $("tabIncome");

  const tabExpense =
    $("tabExpense");


  if (tabIncome) {

    tabIncome.classList.toggle(
      "active",
      state.transactionType ===
        "PEMASUKAN"
    );

  }


  if (tabExpense) {

    tabExpense.classList.toggle(
      "active",
      state.transactionType ===
        "PENGELUARAN"
    );

  }


  fillCategorySelect();

}


/* =========================================================
   QUICK TRANSACTION
   ========================================================= */

function quickTransaction(type) {

  closeQuickAdd();

  showPage("add");

  setTransactionType(type);

}


/* =========================================================
   QUICK ADD
   ========================================================= */

function openQuickAdd() {

  const menu =
    $("quickAddMenu");

  if (!menu) return;

  menu.classList.toggle("show");

}


function closeQuickAdd() {

  const menu =
    $("quickAddMenu");

  if (!menu) return;

  menu.classList.remove("show");

}


/* =========================================================
   MORE MENU
   ========================================================= */

function showMoreMenu() {

  const menu =
    $("moreMenu");

  if (!menu) return;

  menu.classList.remove(
    "hidden"
  );

}


function closeMoreMenu() {

  const menu =
    $("moreMenu");

  if (!menu) return;

  menu.classList.add(
    "hidden"
  );

}


function openFromMenu(page) {

  closeMoreMenu();

  showPage(page);

}


/* =========================================================
   MODAL
   ========================================================= */

function openModal(id) {

  const modal =
    $(id);

  if (!modal) {

    console.warn(
      "Modal tidak ditemukan:",
      id
    );

    return;

  }

  modal.classList.remove(
    "hidden"
  );

}


function closeModal(id) {

  const modal =
    $(id);

  if (!modal) return;

  modal.classList.add(
    "hidden"
  );

}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;


function toast(message) {

  const el =
    $("toast");

  if (!el) {

    console.log(
      "Toast:",
      message
    );

    return;

  }


  el.textContent =
    message;


  el.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(() => {

      el.classList.remove(
        "show"
      );

    }, 3000);

}


/* =========================================================
   ONLINE STATUS
   ========================================================= */

function updateOnlineStatus() {

  const online =
    navigator.onLine;

  const dot =
    $("onlineDot");

  const text =
    $("onlineText");


  if (dot) {

    dot.classList.toggle(
      "offline",
      !online
    );

  }


  if (text) {

    text.textContent =
      online
        ? "Online"
        : "Offline";

  }


  const syncText =
    $("syncText");

  if (syncText) {

    if (!online) {

      syncText.textContent =
        "Mode offline";

    }

  }

}


window.addEventListener(
  "online",
  () => {

    updateOnlineStatus();

    toast(
      "Internet tersambung"
    );

    syncOffline();

  }
);


window.addEventListener(
  "offline",
  () => {

    updateOnlineStatus();

    toast(
      "Mode offline aktif"
    );

  }
);


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function loadLocalData() {

  try {

    const raw =
      localStorage.getItem(
        CONFIG.STORAGE_KEY
      );

    if (!raw) return;

    const saved =
      JSON.parse(raw);

    if (!saved) return;


    state.data =
      Object.assign(
        state.data,
        saved
      );


    console.log(
      "Data lokal dimuat"
    );


    renderAll();

  } catch (error) {

    console.warn(
      "Gagal membaca data lokal:",
      error
    );

  }

}


function saveLocalData() {

  try {

    localStorage.setItem(
      CONFIG.STORAGE_KEY,
      JSON.stringify(
        state.data
      )
    );

  } catch (error) {

    console.warn(
      "Gagal menyimpan lokal:",
      error
    );

  }

}


/* =========================================================
   LOAD APP DATA
   ========================================================= */

async function loadAppData() {

  setSyncText(
    "Mengambil data..."
  );


  if (
    !CONFIG.GAS_URL ||
    CONFIG.GAS_URL.includes(
      "URL_WEB_APP"
    )
  ) {

    console.warn(
      "GAS_URL belum diisi"
    );

    setSyncText(
      "Data lokal"
    );

    renderAll();

    hideLoading();

    toast(
      "Isi GAS_URL di app.js"
    );

    return;

  }


  try {

    state.loading =
      true;


    const result =
      await gasRequest(
        "appData"
      );


    if (
      result &&
      result.success === false
    ) {

      throw new Error(
        result.error ||
        "GAS mengembalikan error"
      );

    }


    applyAppData(
      result
    );


    setSyncText(
      "Data tersinkron"
    );


    hideLoading();

  } catch (error) {

    console.error(
      "loadAppData error:",
      error
    );


    setSyncText(
      "Data lokal / offline"
    );


    renderAll();

    hideLoading();


    toast(
      "Server tidak dapat diakses"
    );

  } finally {

    state.loading =
      false;

  }

}


/* =========================================================
   APPLY APP DATA
   ========================================================= */

function applyAppData(result) {

  if (!result) return;


  if (result.dashboard) {

    state.data.dashboard =
      Object.assign(
        state.data.dashboard,
        result.dashboard
      );

  }


  if (Array.isArray(result.kategori)) {

    state.data.kategori =
      result.kategori;

  }


  if (Array.isArray(result.barang)) {

    state.data.barang =
      result.barang;

  }


  if (Array.isArray(result.history)) {

    state.data.history =
      result.history;

  }


  if (Array.isArray(result.hutang)) {

    state.data.hutang =
      result.hutang;

  }


  state.data.serverTime =
    result.serverTime ||
    new Date().toISOString();


  saveLocalData();

  renderAll();

}


/* =========================================================
   GAS REQUEST
   ========================================================= */

async function gasRequest(
  action,
  params = {}
) {

  const url =
    new URL(
      CONFIG.GAS_URL
    );


  url.searchParams.set(
    "action",
    action
  );


  if (CONFIG.API_KEY) {

    url.searchParams.set(
      "apiKey",
      CONFIG.API_KEY
    );

  }


  Object.keys(params)
    .forEach(key => {

      const value =
        params[key];

      if (
        value !== undefined &&
        value !== null
      ) {

        url.searchParams.set(
          key,
          typeof value === "object"
            ? JSON.stringify(value)
            : value
        );

      }

    });


  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () => controller.abort(),
      CONFIG.REQUEST_TIMEOUT
    );


  try {

    const response =
      await fetch(
        url.toString(),
        {
          method: "GET",
          cache: "no-store",
          signal:
            controller.signal
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status +
        ": " +
        text
      );

    }


    let json;

    try {

      json =
        JSON.parse(text);

    } catch (e) {

      console.error(
        "Response GAS bukan JSON:",
        text
      );

      throw new Error(
        "Response GAS bukan JSON"
      );

    }


    return json;

  } finally {

    clearTimeout(timer);

  }

}


/* =========================================================
   POST GAS
   ========================================================= */

async function gasPost(
  action,
  data
) {

  if (
    !CONFIG.GAS_URL ||
    CONFIG.GAS_URL.includes(
      "URL_WEB_APP"
    )
  ) {

    throw new Error(
      "GAS_URL belum diisi"
    );

  }


  const url =
    new URL(
      CONFIG.GAS_URL
    );


  url.searchParams.set(
    "action",
    action
  );


  if (CONFIG.API_KEY) {

    url.searchParams.set(
      "apiKey",
      CONFIG.API_KEY
    );

  }


  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () => controller.abort(),
      CONFIG.REQUEST_TIMEOUT
    );


  try {

    const response =
      await fetch(
        url.toString(),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8"
          },

          body:
            JSON.stringify(data),

          signal:
            controller.signal
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    let json;

    try {

      json =
        JSON.parse(text);

    } catch (e) {

      console.error(
        "Response POST bukan JSON:",
        text
      );

      throw new Error(
        "Response server bukan JSON"
      );

    }


    if (
      json &&
      json.success === false
    ) {

      throw new Error(
        json.error ||
        "GAS error"
      );

    }


    return json;

  } finally {

    clearTimeout(timer);

  }

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  const d =
    state.data.dashboard ||
    {};


  setText(
    "saldo",
    formatRupiah(
      number(d.saldo)
    )
  );


  setText(
    "totalPemasukan",
    formatRupiah(
      number(d.pemasukan)
    )
  );


  setText(
    "totalPengeluaran",
    formatRupiah(
      number(d.pengeluaran)
    )
  );


  setText(
    "totalPenjualan",
    formatRupiah(
      number(
        d.penjualan
      )
    )
  );


  setText(
    "totalHutang",
    formatRupiah(
      number(
        d.totalHutang
      )
    )
  );


  renderRecentTransactions();

}


/* =========================================================
   RENDER ALL
   ========================================================= */

function renderAll() {

  renderDashboard();

  fillCategorySelect();

  renderBarang();

  renderBarangSelect();

  renderHistory();

  renderHutang();

  updateJualTotal();

  updateBelanjaTotal();

  updateSyncBadge();

}


/* =========================================================
   CATEGORY
   ========================================================= */

function fillCategorySelect() {

  const select =
    $("trxKategori");

  if (!select) return;


  const current =
    select.value;


  select.innerHTML =
    `<option value="">
      Pilih kategori
    </option>`;


  let categories =
    Array.isArray(
      state.data.kategori
    )
      ? [...state.data.kategori]
      : [];


  if (!categories.length) {

    categories = [
      "Belanja",
      "Gaji",
      "Hutang",
      "Lainnya",
      "Makanan",
      "Operasional",
      "Penjualan",
      "Pribadi",
      "Tagihan",
      "Transportasi"
    ];

  }


  categories
    .forEach(category => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        category;

      option.textContent =
        category;

      select.appendChild(
        option
      );

    });


  if (
    current &&
    categories.includes(current)
  ) {

    select.value =
      current;

  }

}


/* =========================================================
   SAVE TRANSACTION
   ========================================================= */

async function saveTransaction(
  event
) {

  event.preventDefault();


  const tanggal =
    value("trxTanggal");

  const kategori =
    value("trxKategori");

  const keterangan =
    value("trxKeterangan");

  const nominal =
    number(
      value("trxNominal")
    );

  const rekening =
    value("trxRekening") ||
    "Kas";


  if (!tanggal) {

    toast(
      "Tanggal belum diisi"
    );

    return;

  }


  if (!kategori) {

    toast(
      "Pilih kategori"
    );

    return;

  }


  if (!keterangan) {

    toast(
      "Keterangan belum diisi"
    );

    return;

  }


  if (nominal <= 0) {

    toast(
      "Nominal harus lebih dari 0"
    );

    return;

  }


  const payload = {

    tanggal,

    jenis:
      state.transactionType,

    kategori,

    keterangan,

    nominal,

    rekening,

    entity:
      "TRANSAKSI"

  };


  await submitWithOfflineQueue(
    "tambahTransaksi",
    payload,
    () => {

      const form =
        $("transactionForm");

      if (form) {
        form.reset();
      }

      if ($("trxTanggal")) {
        $("trxTanggal").value =
          todayString();
      }

      if ($("trxRekening")) {
        $("trxRekening").value =
          "Kas";
      }

      setTransactionType(
        state.transactionType
      );

      showPage("dashboard");

    }
  );

}


/* =========================================================
   SAVE BARANG
   ========================================================= */

async function saveBarang(
  event
) {

  event.preventDefault();


  const nama =
    value("barangNama");

  const modal =
    number(
      value("barangModalPrice")
    );

  const jual =
    number(
      value("barangJualPrice")
    );

  const stok =
    number(
      value("barangStok")
    );


  if (!nama) {

    toast(
      "Nama barang wajib diisi"
    );

    return;

  }


  const payload = {

    id:
      generateId("BRG"),

    nama,

    kategori:
      "Lainnya",

    modal,

    labaPersen:
      modal > 0
        ? ((jual - modal) / modal) *
          100
        : 0,

    labaNominal:
      jual - modal,

    jual,

    stok,

    minimum: 0,

    supplier: "",

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()

  };


  await submitWithOfflineQueue(
    "tambahBarang",
    payload,
    () => {

      closeModal(
        "barangModal"
      );


      const form =
        $("barangForm");

      if (form) {
        form.reset();
      }


      $("barangStok").value =
        "0";


      showPage("barang");

    }
  );

}


/* =========================================================
   BARANG LIST
   ========================================================= */

function renderBarang(
  list = null
) {

  const container =
    $("barangList");

  if (!container) return;


  const items =
    list ||
    state.data.barang ||
    [];


  state.filteredBarang =
    items;


  if (!items.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada barang.
      </div>`;

    return;

  }


  container.innerHTML =
    items
      .map(item =>
        renderBarangCard(item)
      )
      .join("");

}


function renderBarangCard(item) {

  const nama =
    escapeHtml(
      item.nama ||
      "Tanpa nama"
    );

  const kategori =
    escapeHtml(
      item.kategori ||
      "Lainnya"
    );

  const stok =
    number(item.stok);

  const modal =
    number(item.modal);

  const jual =
    number(item.jual);

  const minimum =
    number(item.minimum);


  let stokInfo =
    `Stok: ${stok}`;


  if (
    minimum > 0 &&
    stok <= minimum
  ) {

    stokInfo +=
      ` • Stok minimum`;

  }


  return `
    <div class="form-card">

      <div style="
        display:flex;
        justify-content:space-between;
        gap:12px;
      ">

        <div style="min-width:0">

          <strong style="
            display:block;
            font-size:16px;
          ">
            ${nama}
          </strong>

          <small style="
            display:block;
            margin-top:4px;
            color:#64748b;
          ">
            ${kategori}
          </small>

        </div>

        <div style="
          text-align:right;
          white-space:nowrap;
        ">

          <strong>
            ${formatRupiah(jual)}
          </strong>

        </div>

      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-top:12px;
      ">

        <div style="
          padding:10px;
          border-radius:10px;
          background:#f8fafc;
        ">
          <small>Modal</small><br>
          <strong>
            ${formatRupiah(modal)}
          </strong>
        </div>

        <div style="
          padding:10px;
          border-radius:10px;
          background:#f8fafc;
        ">
          <small>Stok</small><br>
          <strong>
            ${stokInfo}
          </strong>
        </div>

      </div>

    </div>
  `;

}


/* =========================================================
   FILTER BARANG
   ========================================================= */

function filterBarang(query) {

  const q =
    String(query || "")
      .toLowerCase()
      .trim();


  const items =
    state.data.barang || [];


  if (!q) {

    renderBarang(items);

    return;

  }


  const filtered =
    items.filter(item => {

      const text =
        [
          item.nama,
          item.kategori,
          item.supplier
        ]
          .join(" ")
          .toLowerCase();

      return text.includes(q);

    });


  renderBarang(
    filtered
  );

}


/* =========================================================
   BARANG SELECT
   ========================================================= */

function renderBarangSelect() {

  const selects = [
    $("jualBarang"),
    $("belanjaBarang")
  ];


  selects.forEach(select => {

    if (!select) return;


    const current =
      select.value;


    select.innerHTML =
      `<option value="">
        Pilih barang
      </option>`;


    (state.data.barang || [])
      .forEach(item => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          item.id;

        option.textContent =
          `${item.nama || "Tanpa nama"} — Stok ${number(item.stok)}`;

        select.appendChild(
          option
        );

      });


    if (current) {

      select.value =
        current;

    }

  });

}


/* =========================================================
   PENJUALAN BARANG CHANGE
   ========================================================= */

function onJualBarangChange() {

  const id =
    value("jualBarang");


  const barang =
    findBarang(id);


  if (!barang) {

    updateJualTotal();

    return;

  }


  const harga =
    $("jualHarga");


  if (
    harga &&
    !number(harga.value)
  ) {

    harga.value =
      number(barang.jual);

  }


  updateJualTotal();

}


/* =========================================================
   BELANJA BARANG CHANGE
   ========================================================= */

function onBelanjaBarangChange() {

  const id =
    value("belanjaBarang");


  const barang =
    findBarang(id);


  if (!barang) {

    updateBelanjaTotal();

    return;

  }


  const harga =
    $("belanjaHarga");


  if (
    harga &&
    !number(harga.value)
  ) {

    harga.value =
      number(barang.modal);

  }


  updateBelanjaTotal();

}


/* =========================================================
   FIND BARANG
   ========================================================= */

function findBarang(id) {

  return (
    state.data.barang || []
  )
    .find(
      item =>
        String(item.id) ===
        String(id)
    );

}


/* =========================================================
   PENJUALAN TOTAL
   ========================================================= */

function updateJualTotal() {

  const qty =
    number(
      value("jualQty")
    );

  const harga =
    number(
      value("jualHarga")
    );


  setText(
    "jualTotalPreview",
    formatRupiah(
      qty * harga
    )
  );

}


/* =========================================================
   BELANJA TOTAL
   ========================================================= */

function updateBelanjaTotal() {

  const qty =
    number(
      value("belanjaQty")
    );

  const harga =
    number(
      value("belanjaHarga")
    );


  setText(
    "belanjaTotalPreview",
    formatRupiah(
      qty * harga
    )
  );

}


/* =========================================================
   SAVE PENJUALAN
   ========================================================= */

async function savePenjualan(
  event
) {

  event.preventDefault();


  const barangId =
    value("jualBarang");

  const qty =
    number(
      value("jualQty")
    );

  const harga =
    number(
      value("jualHarga")
    );

  const pelanggan =
    value("jualPelanggan") ||
    "Umum";


  const barang =
    findBarang(
      barangId
    );


  if (!barang) {

    toast(
      "Pilih barang"
    );

    return;

  }


  if (qty <= 0) {

    toast(
      "Jumlah harus lebih dari 0"
    );

    return;

  }


  if (harga <= 0) {

    toast(
      "Harga jual belum diisi"
    );

    return;

  }


  if (
    number(barang.stok) <
    qty
  ) {

    toast(
      "Stok tidak mencukupi"
    );

    return;

  }


  const payload = {

    id:
      generateId("JUAL"),

    tanggal:
      todayString(),

    barangID:
      barang.id,

    barangNama:
      barang.nama,

    qty,

    harga,

    pelanggan,

    nominal:
      qty * harga,

    rekening:
      "Kas",

    kategori:
      "Penjualan",

    jenis:
      "PEMASUKAN",

    entity:
      "PENJUALAN"

  };


  await submitWithOfflineQueue(
    "tambahPenjualan",
    payload,
    () => {

      const form =
        $("penjualanForm");

      if (form) {
        form.reset();
      }


      if ($("jualQty")) {
        $("jualQty").value =
          "1";
      }


      updateJualTotal();

      showPage(
        "penjualan"
      );

    }
  );

}


/* =========================================================
   SAVE BELANJA
   ========================================================= */

async function saveBelanja(
  event
) {

  event.preventDefault();


  const barangId =
    value("belanjaBarang");

  const qty =
    number(
      value("belanjaQty")
    );

  const harga =
    number(
      value("belanjaHarga")
    );

  const supplier =
    value("belanjaSupplier");


  const barang =
    findBarang(
      barangId
    );


  if (!barang) {

    toast(
      "Pilih barang"
    );

    return;

  }


  if (qty <= 0) {

    toast(
      "Jumlah harus lebih dari 0"
    );

    return;

  }


  if (harga <= 0) {

    toast(
      "Harga modal belum diisi"
    );

    return;

  }


  const payload = {

    id:
      generateId("BELI"),

    tanggal:
      todayString(),

    barangID:
      barang.id,

    barangNama:
      barang.nama,

    qty,

    harga,

    supplier,

    nominal:
      qty * harga,

    rekening:
      "Kas",

    kategori:
      "Belanja",

    jenis:
      "PENGELUARAN",

    entity:
      "BELANJA"

  };


  await submitWithOfflineQueue(
    "tambahBelanja",
    payload,
    () => {

      const form =
        $("belanjaForm");

      if (form) {
        form.reset();
      }


      if ($("belanjaQty")) {
        $("belanjaQty").value =
          "1";
      }


      updateBelanjaTotal();

      showPage(
        "belanja"
      );

    }
  );

}


/* =========================================================
   SAVE HUTANG
   ========================================================= */

async function saveHutang(
  event
) {

  event.preventDefault();


  const nama =
    value("hutangNama");

  const nominal =
    number(
      value("hutangNominal")
    );

  const jatuhTempo =
    value("hutangTempo");

  const keterangan =
    value("hutangKeterangan");


  if (!nama) {

    toast(
      "Nama / pihak wajib diisi"
    );

    return;

  }


  if (nominal <= 0) {

    toast(
      "Nominal harus lebih dari 0"
    );

    return;

  }


  const payload = {

    id:
      generateId("HUTANG"),

    tanggal:
      todayString(),

    nama,

    nominal,

    jatuhTempo,

    keterangan,

    dibayar: 0,

    status:
      "BELUM LUNAS",

    entity:
      "HUTANG"

  };


  await submitWithOfflineQueue(
    "tambahHutang",
    payload,
    () => {

      closeModal(
        "hutangModal"
      );


      const form =
        $("hutangForm");

      if (form) {
        form.reset();
      }


      showPage(
        "hutang"
      );

    }
  );

}


/* =========================================================
   OFFLINE QUEUE
   ========================================================= */

function getQueue() {

  try {

    const raw =
      localStorage.getItem(
        CONFIG.QUEUE_KEY
      );

    if (!raw) return [];

    const queue =
      JSON.parse(raw);

    return Array.isArray(queue)
      ? queue
      : [];

  } catch (error) {

    return [];

  }

}


function saveQueue(queue) {

  localStorage.setItem(
    CONFIG.QUEUE_KEY,
    JSON.stringify(queue)
  );

}


function addToQueue(
  action,
  payload
) {

  const queue =
    getQueue();


  queue.push({

    id:
      generateId("QUEUE"),

    action,

    payload,

    createdAt:
      new Date().toISOString()

  });


  saveQueue(
    queue
  );


  updateSyncBadge();

}


/* =========================================================
   SUBMIT WITH OFFLINE
   ========================================================= */

async function submitWithOfflineQueue(
  action,
  payload,
  successCallback
) {

  const button =
    document.activeElement;


  try {

    if (!navigator.onLine) {

      addToQueue(
        action,
        payload
      );


      toast(
        "Disimpan offline. Akan disinkronkan."
      );


      if (successCallback) {
        successCallback();
      }

      return;

    }


    setSyncText(
      "Menyimpan..."
    );


    const result =
      await gasPost(
        action,
        payload
      );


    console.log(
      action,
      result
    );


    if (
      result &&
      result.success === false
    ) {

      throw new Error(
        result.error ||
        "Gagal menyimpan"
      );

    }


    toast(
      "Data berhasil disimpan"
    );


    setSyncText(
      "Tersimpan"
    );


    await loadAppData();


    if (successCallback) {
      successCallback();
    }

  } catch (error) {

    console.error(
      "Submit error:",
      error
    );


    addToQueue(
      action,
      payload
    );


    toast(
      "Server gagal. Data disimpan offline."
    );


    setSyncText(
      "Menunggu sinkronisasi"
    );


    if (successCallback) {
      successCallback();
    }

  } finally {

    if (
      button &&
      button.tagName === "BUTTON"
    ) {

      button.blur();

    }

  }

}


/* =========================================================
   SYNC OFFLINE
   ========================================================= */

async function syncOffline() {

  const queue =
    getQueue();


  if (!queue.length) {

    setSyncText(
      "Tidak ada data tertunda"
    );

    updateSyncBadge();

    toast(
      "Semua data sudah tersinkron"
    );

    return;

  }


  if (!navigator.onLine) {

    toast(
      "Tidak ada koneksi internet"
    );

    return;

  }


  setSyncText(
    "Sinkronisasi..."
  );


  let success =
    0;

  let failed =
    0;


  const remaining = [];


  for (
    const item of queue
  ) {

    try {

      await gasPost(
        item.action,
        item.payload
      );


      success++;

    } catch (error) {

      console.error(
        "Sync gagal:",
        item,
        error
      );


      failed++;

      remaining.push(
        item
      );

    }

  }


  saveQueue(
    remaining
  );


  updateSyncBadge();


  if (failed === 0) {

    setSyncText(
      `${success} data tersinkron`
    );

    toast(
      "Sinkronisasi berhasil"
    );

  } else {

    setSyncText(
      `${success} berhasil, ${failed} tertunda`
    );

    toast(
      "Sebagian data belum tersinkron"
    );

  }


  await loadAppData();

}


/* =========================================================
   SYNC BADGE
   ========================================================= */

function updateSyncBadge() {

  const badge =
    $("syncBadge");

  if (!badge) return;


  const count =
    getQueue().length;


  badge.textContent =
    count;


  badge.classList.toggle(
    "hidden",
    count === 0
  );

}


/* =========================================================
   HISTORY
   ========================================================= */

function renderRecentTransactions() {

  const container =
    $("recentTransactions");

  if (!container) return;


  const items =
    (state.data.history || [])
      .slice(0, 5);


  if (!items.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada transaksi
      </div>`;

    return;

  }


  container.innerHTML =
    items
      .map(
        item =>
          renderHistoryCard(item)
      )
      .join("");

}


function renderHistory() {

  const container =
    $("historyList");

  if (!container) return;


  const items =
    state.data.history || [];


  state.filteredHistory =
    items;


  if (!items.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada transaksi.
      </div>`;

    return;

  }


  container.innerHTML =
    items
      .map(
        item =>
          renderHistoryCard(item)
      )
      .join("");

}


function renderHistoryCard(item) {

  const jenis =
    String(
      item.jenis ||
      item.Jenis ||
      ""
    )
      .toUpperCase();


  const pemasukan =
    jenis === "PEMASUKAN" ||
    jenis === "PENJUALAN";


  const nominal =
    number(
      item.nominal ||
      item.Nominal
    );


  const tanggal =
    item.tanggal ||
    item.Tanggal ||
    "";


  const kategori =
    escapeHtml(
      item.kategori ||
      item.Kategori ||
      "-"
    );


  const keterangan =
    escapeHtml(
      item.keterangan ||
      item.Keterangan ||
      item.nama ||
      item.Nama ||
      "-"
    );


  return `
    <div class="form-card">

      <div style="
        display:flex;
        justify-content:space-between;
        gap:10px;
      ">

        <div style="min-width:0">

          <strong>
            ${keterangan}
          </strong>

          <div style="
            margin-top:5px;
            color:#64748b;
            font-size:12px;
          ">
            ${formatDate(tanggal)}
            • ${kategori}
          </div>

        </div>

        <strong style="
          white-space:nowrap;
          color:${pemasukan
            ? "#16a34a"
            : "#dc2626"};
        ">
          ${pemasukan ? "+" : "-"}
          ${formatRupiah(nominal)}
        </strong>

      </div>

    </div>
  `;

}


/* =========================================================
   FILTER HISTORY
   ========================================================= */

function filterHistory(query) {

  const q =
    String(query || "")
      .toLowerCase()
      .trim();


  const items =
    state.data.history || [];


  if (!q) {

    renderHistory(
      items
    );

    return;

  }


  const filtered =
    items.filter(item => {

      const text =
        [
          item.tanggal,
          item.Tanggal,
          item.jenis,
          item.Jenis,
          item.kategori,
          item.Kategori,
          item.keterangan,
          item.Keterangan,
          item.nama,
          item.Nama,
          item.BarangNama
        ]
          .join(" ")
          .toLowerCase();


      return text.includes(q);

    });


  renderHistory(
    filtered
  );

}


/* =========================================================
   HUTANG
   ========================================================= */

function renderHutang() {

  const container =
    $("hutangList");

  if (!container) return;


  const items =
    state.data.hutang || [];


  if (!items.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada hutang.
      </div>`;

    return;

  }


  container.innerHTML =
    items
      .map(
        item =>
          renderHutangCard(item)
      )
      .join("");

}


function renderHutangCard(item) {

  const nama =
    escapeHtml(
      item.nama ||
      item.Nama ||
      item.pihak ||
      "-"
    );


  const nominal =
    number(
      item.nominal ||
      item.Nominal
    );


  const dibayar =
    number(
      item.dibayar ||
      item.Dibayar
    );


  const sisa =
    Math.max(
      0,
      nominal - dibayar
    );


  const tempo =
    item.jatuhTempo ||
    item.JatuhTempo ||
    "";


  const status =
    escapeHtml(
      item.status ||
      item.Status ||
      (
        sisa <= 0
          ? "LUNAS"
          : "BELUM LUNAS"
      )
    );


  return `
    <div class="form-card">

      <div style="
        display:flex;
        justify-content:space-between;
        gap:12px;
      ">

        <div>

          <strong>
            ${nama}
          </strong>

          <div style="
            margin-top:5px;
            color:#64748b;
            font-size:12px;
          ">
            Jatuh tempo:
            ${tempo
              ? formatDate(tempo)
              : "-"}
          </div>

        </div>

        <strong>
          ${formatRupiah(sisa)}
        </strong>

      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-top:12px;
      ">

        <div style="
          background:#f8fafc;
          padding:10px;
          border-radius:10px;
        ">
          <small>Total</small><br>
          <strong>
            ${formatRupiah(nominal)}
          </strong>
        </div>

        <div style="
          background:#f8fafc;
          padding:10px;
          border-radius:10px;
        ">
          <small>Dibayar</small><br>
          <strong>
            ${formatRupiah(dibayar)}
          </strong>
        </div>

      </div>

      <div style="
        margin-top:10px;
        font-size:12px;
        color:#64748b;
      ">
        Status: ${status}
      </div>

    </div>
  `;

}


/* =========================================================
   REPORT
   ========================================================= */

async function loadReport() {

  const start =
    value("reportStart");

  const end =
    value("reportEnd");


  if (!start || !end) {

    toast(
      "Pilih tanggal laporan"
    );

    return;

  }


  if (start > end) {

    toast(
      "Tanggal mulai tidak boleh setelah tanggal akhir"
    );

    return;

  }


  const resultBox =
    $("reportResult");


  if (resultBox) {

    resultBox.innerHTML =
      "Memuat laporan...";

  }


  try {

    let result;


    if (navigator.onLine) {

      result =
        await gasRequest(
          "laporan",
          {
            start,
            end,
            tanggalMulai:
              start,
            tanggalAkhir:
              end
          }
        );

    } else {

      result =
        buildLocalReport(
          start,
          end
        );

    }


    renderReport(
      result,
      start,
      end
    );

  } catch (error) {

    console.error(
      "loadReport:",
      error
    );


    const local =
      buildLocalReport(
        start,
        end
      );


    renderReport(
      local,
      start,
      end
    );


    toast(
      "Laporan lokal digunakan"
    );

  }

}


/* =========================================================
   LOCAL REPORT
   ========================================================= */

function buildLocalReport(
  start,
  end
) {

  const history =
    state.data.history || [];


  const filtered =
    history.filter(item => {

      const date =
        String(
          item.tanggal ||
          item.Tanggal ||
          ""
        )
          .slice(0, 10);


      return (
        date >= start &&
        date <= end
      );

    });


  let pemasukan =
    0;

  let pengeluaran =
    0;

  let penjualan =
    0;


  filtered.forEach(item => {

    const jenis =
      String(
        item.jenis ||
        item.Jenis ||
        ""
      )
        .toUpperCase();


    const nominal =
      number(
        item.nominal ||
        item.Nominal
      );


    if (
      jenis === "PEMASUKAN"
    ) {

      pemasukan +=
        nominal;

    }


    if (
      jenis === "PENGELUARAN"
    ) {

      pengeluaran +=
        nominal;

    }


    if (
      jenis === "PENJUALAN"
    ) {

      penjualan +=
        nominal;

    }

  });


  return {

    pemasukan,

    pengeluaran,

    penjualan,

    saldo:
      pemasukan -
      pengeluaran,

    transaksi:
      filtered.length

  };

}


/* =========================================================
   RENDER REPORT
   ========================================================= */

function renderReport(
  result,
  start,
  end
) {

  const box =
    $("reportResult");

  if (!box) return;


  const data =
    result || {};


  const pemasukan =
    number(
      data.pemasukan ||
      data.totalPemasukan
    );


  const pengeluaran =
    number(
      data.pengeluaran ||
      data.totalPengeluaran
    );


  const penjualan =
    number(
      data.penjualan ||
      data.totalPenjualan
    );


  const saldo =
    number(
      data.saldo
    );


  const transaksi =
    number(
      data.transaksi ||
      data.jumlahTransaksi
    );


  box.innerHTML = `

    <h3 style="
      margin-top:0;
    ">
      Laporan Keuangan
    </h3>

    <p style="
      color:#64748b;
      font-size:12px;
    ">
      ${formatDate(start)}
      sampai
      ${formatDate(end)}
    </p>

    <div style="
      display:grid;
      gap:10px;
      margin-top:15px;
    ">

      <div style="
        padding:14px;
        border-radius:12px;
        background:#f0fdf4;
      ">
        <small>Pemasukan</small>
        <strong style="
          display:block;
          margin-top:4px;
          font-size:18px;
          color:#16a34a;
        ">
          ${formatRupiah(pemasukan)}
        </strong>
      </div>

      <div style="
        padding:14px;
        border-radius:12px;
        background:#fef2f2;
      ">
        <small>Pengeluaran</small>
        <strong style="
          display:block;
          margin-top:4px;
          font-size:18px;
          color:#dc2626;
        ">
          ${formatRupiah(pengeluaran)}
        </strong>
      </div>

      <div style="
        padding:14px;
        border-radius:12px;
        background:#eff6ff;
      ">
        <small>Penjualan</small>
        <strong style="
          display:block;
          margin-top:4px;
          font-size:18px;
          color:#2563eb;
        ">
          ${formatRupiah(penjualan)}
        </strong>
      </div>

      <div style="
        padding:14px;
        border-radius:12px;
        background:#f8fafc;
      ">
        <small>Selisih</small>
        <strong style="
          display:block;
          margin-top:4px;
          font-size:20px;
        ">
          ${formatRupiah(saldo)}
        </strong>
      </div>

      <div style="
        padding:14px;
        border-radius:12px;
        background:#f8fafc;
      ">
        <small>Jumlah transaksi</small>
        <strong style="
          display:block;
          margin-top:4px;
          font-size:18px;
        ">
          ${transaksi}
        </strong>
      </div>

    </div>

  `;

}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshApp() {

  console.log(
    "Refresh CatatKu"
  );


  setSyncText(
    "Memuat ulang..."
  );


  await syncOffline();

  await loadAppData();

}


/* =========================================================
   SYNC TEXT
   ========================================================= */

function setSyncText(text) {

  const el =
    $("syncText");

  if (el) {

    el.textContent =
      text;

  }

}


/* =========================================================
   LOADING
   ========================================================= */

function hideLoading() {

  const loading =
    $("loading");

  if (!loading) return;

  loading.classList.add(
    "hidden"
  );

}


/* =========================================================
   NUMBER
   ========================================================= */

function number(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;

  }


  if (
    typeof value ===
    "number"
  ) {

    return Number.isFinite(value)
      ? value
      : 0;

  }


  const clean =
    String(value)
      .replace(
        /[^0-9.-]/g,
        ""
      );


  const n =
    Number(clean);


  return Number.isFinite(n)
    ? n
    : 0;

}


/* =========================================================
   RUPIAH
   ========================================================= */

function formatRupiah(value) {

  const n =
    number(value);


  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(n);

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(value) {

  if (!value) {
    return "-";
  }


  const text =
    String(value);


  const date =
    new Date(text);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return text;

  }


  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  ).format(date);

}


/* =========================================================
   GET VALUE
   ========================================================= */

function value(id) {

  const el =
    $(id);

  if (!el) {
    return "";
  }

  return String(
    el.value || ""
  ).trim();

}


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(
  id,
  text
) {

  const el =
    $(id);

  if (!el) return;

  el.textContent =
    text;

}


/* =========================================================
   ID GENERATOR
   ========================================================= */

function generateId(prefix) {

  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()
  );

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   GLOBAL FUNCTIONS
   Supaya onclick="" di index.html
   selalu menemukan fungsi.
   ========================================================= */

window.showPage =
  showPage;

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

window.refreshApp =
  refreshApp;

window.syncOffline =
  syncOffline;

window.filterBarang =
  filterBarang;

window.filterHistory =
  filterHistory;

window.loadReport =
  loadReport;

window.updateJualTotal =
  updateJualTotal;

window.updateBelanjaTotal =
  updateBelanjaTotal;


/* =========================================================
   DEBUG
   ========================================================= */

console.log(
  "%cCatatKu app.js aktif",
  "font-weight:bold;font-size:16px"
);

console.log(
  "GAS URL:",
  CONFIG.GAS_URL
);

console.log(
  "Fungsi navigasi tersedia:",
  {
    showPage:
      typeof window.showPage,
    openModal:
      typeof window.openModal,
    quickTransaction:
      typeof window.quickTransaction,
    refreshApp:
      typeof window.refreshApp,
    syncOffline:
      typeof window.syncOffline
  }
);


/* =========================================================
   END
   ========================================================= */
