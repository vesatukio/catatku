/* =========================================================
   CATATKU
   app.js
   Frontend PWA + Google Apps Script
   ========================================================= */

"use strict";

/* =========================================================
   KONFIGURASI GAS
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxrgQIppwaphvBIQjMbV6e5EO18C6O066k0jbBvRWPCKKV1rp9A7TQhZfM9_I01lL6a/exec";

const API_KEY = "CATATKU-2026-PRIBADI";

const DB_NAME = "CatatKuDB";
const DB_VERSION = 1;
const QUEUE_STORE = "syncQueue";
const CACHE_STORE = "appCache";


/* =========================================================
   STATE
   ========================================================= */

let appData = {
  dashboard: {},
  kategori: [],
  barang: [],
  history: [],
  hutang: [],
  laporan: {}
};

let transactionType = "PEMASUKAN";

let db = null;

let currentBarangList = [];
let currentHistoryList = [];

let syncRunning = false;


/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {

  console.log("CatatKu mulai...");

  initDates();
  initEvents();
  initDB();

  updateOnlineStatus();

  window.addEventListener("online", function () {
    updateOnlineStatus();
    syncOffline();
  });

  window.addEventListener("offline", function () {
    updateOnlineStatus();
    setSyncText("Offline — data akan disimpan di perangkat");
  });

  try {

    await openDatabase();

    await loadLocalCache();

    updateSyncBadge();

    if (navigator.onLine) {
      await loadAppData();
    } else {
      setSyncText("Offline — menggunakan data tersimpan");
    }

  } catch (error) {

    console.error("Startup error:", error);

    setSyncText("Mode offline");

    showToast("Aplikasi dibuka dalam mode offline");

  } finally {

    hideLoading();

  }

});


/* =========================================================
   INITIAL EVENTS
   ========================================================= */

function initEvents() {

  const transactionForm =
    document.getElementById("transactionForm");

  if (transactionForm) {

    transactionForm.addEventListener(
      "submit",
      submitTransaction
    );

  }


  const barangForm =
    document.getElementById("barangForm");

  if (barangForm) {

    barangForm.addEventListener(
      "submit",
      submitBarang
    );

  }


  const penjualanForm =
    document.getElementById("penjualanForm");

  if (penjualanForm) {

    penjualanForm.addEventListener(
      "submit",
      submitPenjualan
    );

  }


  const belanjaForm =
    document.getElementById("belanjaForm");

  if (belanjaForm) {

    belanjaForm.addEventListener(
      "submit",
      submitBelanja
    );

  }


  const hutangForm =
    document.getElementById("hutangForm");

  if (hutangForm) {

    hutangForm.addEventListener(
      "submit",
      submitHutang
    );

  }


  const jualQty =
    document.getElementById("jualQty");

  const jualHarga =
    document.getElementById("jualHarga");

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


  const belanjaQty =
    document.getElementById("belanjaQty");

  const belanjaHarga =
    document.getElementById("belanjaHarga");

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


  const jualBarang =
    document.getElementById("jualBarang");

  if (jualBarang) {

    jualBarang.addEventListener(
      "change",
      autoHargaJual
    );

  }


  const belanjaBarang =
    document.getElementById("belanjaBarang");

  if (belanjaBarang) {

    belanjaBarang.addEventListener(
      "change",
      autoHargaModal
    );

  }


  document.addEventListener(
    "keydown",
    function (event) {

      if (event.key === "Escape") {

        closeModal("barangModal");
        closeModal("hutangModal");
        closeMoreMenu();
        closeQuickAdd();

      }

    }
  );

}


/* =========================================================
   DATE
   ========================================================= */

function initDates() {

  const today = getLocalDate();

  const trxTanggal =
    document.getElementById("trxTanggal");

  if (trxTanggal && !trxTanggal.value) {
    trxTanggal.value = today;
  }

  const reportStart =
    document.getElementById("reportStart");

  const reportEnd =
    document.getElementById("reportEnd");

  if (reportEnd && !reportEnd.value) {
    reportEnd.value = today;
  }

  if (reportStart && !reportStart.value) {

    const date =
      new Date();

    date.setDate(
      date.getDate() - 30
    );

    reportStart.value =
      formatDateInput(date);

  }

}


function getLocalDate() {

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


function formatDateInput(date) {

  const year =
    date.getFullYear();

  const month =
    String(date.getMonth() + 1)
      .padStart(2, "0");

  const day =
    String(date.getDate())
      .padStart(2, "0");

  return `${year}-${month}-${day}`;

}


/* =========================================================
   INDEXED DB
   ========================================================= */

function initDB() {

  try {

    const request =
      indexedDB.open(
        DB_NAME,
        DB_VERSION
      );

    request.onupgradeneeded =
      function (event) {

        const database =
          event.target.result;

        if (!database.objectStoreNames.contains(QUEUE_STORE)) {

          database.createObjectStore(
            QUEUE_STORE,
            {
              keyPath: "id",
              autoIncrement: true
            }
          );

        }

        if (!database.objectStoreNames.contains(CACHE_STORE)) {

          database.createObjectStore(
            CACHE_STORE,
            {
              keyPath: "key"
            }
          );

        }

      };

    request.onsuccess =
      function (event) {

        db =
          event.target.result;

        console.log(
          "IndexedDB aktif"
        );

      };

    request.onerror =
      function (event) {

        console.warn(
          "IndexedDB gagal:",
          event.target.error
        );

      };

  } catch (error) {

    console.warn(
      "IndexedDB tidak tersedia:",
      error
    );

  }

}


function openDatabase() {

  return new Promise(function (resolve, reject) {

    if (db) {
      resolve(db);
      return;
    }

    const request =
      indexedDB.open(
        DB_NAME,
        DB_VERSION
      );

    request.onupgradeneeded =
      function (event) {

        const database =
          event.target.result;

        if (!database.objectStoreNames.contains(QUEUE_STORE)) {

          database.createObjectStore(
            QUEUE_STORE,
            {
              keyPath: "id",
              autoIncrement: true
            }
          );

        }

        if (!database.objectStoreNames.contains(CACHE_STORE)) {

          database.createObjectStore(
            CACHE_STORE,
            {
              keyPath: "key"
            }
          );

        }

      };

    request.onsuccess =
      function (event) {

        db =
          event.target.result;

        resolve(db);

      };

    request.onerror =
      function () {

        reject(
          request.error
        );

      };

  });

}


/* =========================================================
   CACHE
   ========================================================= */

async function saveCache(key, value) {

  if (!db) return;

  return new Promise(function (resolve, reject) {

    const transaction =
      db.transaction(
        CACHE_STORE,
        "readwrite"
      );

    const store =
      transaction.objectStore(
        CACHE_STORE
      );

    store.put({
      key: key,
      value: value,
      savedAt: Date.now()
    });

    transaction.oncomplete =
      function () {
        resolve();
      };

    transaction.onerror =
      function () {
        reject(
          transaction.error
        );
      };

  });

}


async function getCache(key) {

  if (!db) return null;

  return new Promise(function (resolve) {

    const transaction =
      db.transaction(
        CACHE_STORE,
        "readonly"
      );

    const store =
      transaction.objectStore(
        CACHE_STORE
      );

    const request =
      store.get(key);

    request.onsuccess =
      function () {

        resolve(
          request.result
            ? request.result.value
            : null
        );

      };

    request.onerror =
      function () {

        resolve(null);

      };

  });

}


async function loadLocalCache() {

  try {

    const cached =
      await getCache("appData");

    if (!cached) return;

    appData =
      normalizeAppData(cached);

    renderAll();

    console.log(
      "Data lokal dimuat"
    );

  } catch (error) {

    console.warn(
      "Cache error:",
      error
    );

  }

}


/* =========================================================
   NORMALIZE DATA
   ========================================================= */

function normalizeAppData(data) {

  data =
    data || {};

  return {

    dashboard:
      data.dashboard || {},

    kategori:
      Array.isArray(data.kategori)
        ? data.kategori
        : [],

    barang:
      Array.isArray(data.barang)
        ? data.barang
        : [],

    history:
      Array.isArray(data.history)
        ? data.history
        : [],

    hutang:
      Array.isArray(data.hutang)
        ? data.hutang
        : [],

    laporan:
      data.laporan || {}

  };

}


/* =========================================================
   GAS REQUEST
   ========================================================= */

async function gasRequest(
  action,
  params = {},
  method = "GET"
) {

  const data = {
    action: action,
    key: API_KEY,
    ...params
  };

  let url =
    GAS_URL;

  let options = {
    method: method,
    redirect: "follow"
  };


  if (method === "GET") {

    const query =
      new URLSearchParams(
        data
      ).toString();

    url +=
      "?" + query;

  } else {

    options.headers = {
      "Content-Type":
        "text/plain;charset=utf-8"
    };

    options.body =
      JSON.stringify(data);

  }


  const response =
    await fetch(
      url,
      options
    );

  if (!response.ok) {

    throw new Error(
      "HTTP " +
      response.status
    );

  }


  const text =
    await response.text();

  let result;

  try {

    result =
      JSON.parse(text);

  } catch (error) {

    console.error(
      "Response GAS bukan JSON:",
      text
    );

    throw new Error(
      "Response GAS tidak valid"
    );

  }


  if (
    result &&
    result.success === false
  ) {

    throw new Error(
      result.error ||
      "GAS mengembalikan error"
    );

  }


  return result;

}


/* =========================================================
   LOAD APP DATA
   ========================================================= */

async function loadAppData() {

  if (!navigator.onLine) {

    setSyncText(
      "Offline — menggunakan data tersimpan"
    );

    return;

  }


  setSyncText(
    "Mengambil data..."
  );


  try {

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
        "Gagal mengambil data"
      );

    }


    /*
     * Beberapa versi GAS mengembalikan
     * data langsung, beberapa memakai
     * result.data.
     */

    const data =
      result.data ||
      result;


    appData =
      normalizeAppData(
        data
      );


    await saveCache(
      "appData",
      appData
    );


    renderAll();

    setSyncText(
      "Data tersinkron"
    );

    updateSyncBadge();


    if (navigator.onLine) {

      setTimeout(
        function () {
          syncOffline();
        },
        500
      );

    }


  } catch (error) {

    console.error(
      "loadAppData:",
      error
    );

    setSyncText(
      "Gagal terhubung — data lokal digunakan"
    );

    showToast(
      "Server tidak dapat diakses"
    );

  }

}


/* =========================================================
   RENDER ALL
   ========================================================= */

function renderAll() {

  renderDashboard();

  renderKategori();

  renderBarang();

  renderBarangSelects();

  renderHistory();

  renderHutang();

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  const d =
    appData.dashboard || {};


  setText(
    "saldo",
    rupiah(
      numberValue(
        d.saldo
      )
    )
  );


  setText(
    "totalPemasukan",
    rupiah(
      numberValue(
        d.pemasukan
      )
    )
  );


  setText(
    "totalPengeluaran",
    rupiah(
      numberValue(
        d.pengeluaran
      )
    )
  );


  setText(
    "totalPenjualan",
    rupiah(
      numberValue(
        d.penjualan ||
        d.totalPenjualan ||
        d.pemasukanToko
      )
    )
  );


  setText(
    "totalHutang",
    rupiah(
      numberValue(
        d.totalHutang
      )
    )
  );


  renderRecentTransactions();

}


function renderRecentTransactions() {

  const container =
    document.getElementById(
      "recentTransactions"
    );

  if (!container) return;


  const list =
    Array.isArray(
      appData.history
    )
      ? appData.history
      : [];


  if (!list.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada transaksi
      </div>`;

    return;

  }


  container.innerHTML =
    list
      .slice(0, 5)
      .map(
        transactionHTML
      )
      .join("");

}


/* =========================================================
   KATEGORI
   ========================================================= */

function renderKategori() {

  const select =
    document.getElementById(
      "trxKategori"
    );

  if (!select) return;


  const oldValue =
    select.value;


  let html =
    `<option value="">
      Pilih kategori
    </option>`;


  const type =
    transactionType;


  const categories =
    Array.isArray(
      appData.kategori
    )
      ? appData.kategori
      : [];


  categories.forEach(
    function (item) {

      let nama = "";
      let jenis = "";


      if (
        typeof item === "string"
      ) {

        nama = item;

      } else {

        nama =
          item.nama ||
          item.kategori ||
          item.name ||
          "";

        jenis =
          String(
            item.jenis ||
            item.type ||
            ""
          )
            .toUpperCase();

      }


      if (!nama) return;


      /*
       * Jika kategori punya jenis,
       * tampilkan hanya yang sesuai.
       */

      if (
        jenis &&
        jenis !== type &&
        jenis !== "SEMUA"
      ) {
        return;
      }


      html +=
        `<option value="${escapeAttr(nama)}">
          ${escapeHTML(nama)}
        </option>`;

    }
  );


  select.innerHTML =
    html;


  if (oldValue) {
    select.value =
      oldValue;
  }

}


/* =========================================================
   TRANSACTION TYPE
   ========================================================= */

function setTransactionType(type) {

  transactionType =
    String(type || "PEMASUKAN")
      .toUpperCase();


  const income =
    document.getElementById(
      "tabIncome"
    );

  const expense =
    document.getElementById(
      "tabExpense"
    );


  if (income) {

    income.classList.toggle(
      "active",
      transactionType ===
      "PEMASUKAN"
    );

  }


  if (expense) {

    expense.classList.toggle(
      "active",
      transactionType ===
      "PENGELUARAN"
    );

  }


  renderKategori();

}


function quickTransaction(type) {

  closeQuickAdd();

  showPage("add");

  setTransactionType(
    type
  );

  const field =
    document.getElementById(
      "trxKeterangan"
    );

  if (field) {

    setTimeout(
      function () {
        field.focus();
      },
      150
    );

  }

}


/* =========================================================
   SUBMIT TRANSACTION
   ========================================================= */

async function submitTransaction(event) {

  event.preventDefault();


  const tanggal =
    valueOf("trxTanggal");

  const kategori =
    valueOf("trxKategori");

  const keterangan =
    valueOf("trxKeterangan");

  const nominal =
    numberValue(
      valueOf("trxNominal")
    );

  const rekening =
    valueOf("trxRekening") ||
    "Kas";


  if (!tanggal ||
      !kategori ||
      !keterangan ||
      nominal <= 0) {

    showToast(
      "Lengkapi data transaksi"
    );

    return;

  }


  const payload = {

    tanggal:
      tanggal,

    jenis:
      transactionType,

    kategori:
      kategori,

    keterangan:
      keterangan,

    nominal:
      nominal,

    rekening:
      rekening

  };


  await saveOrQueue(
    "tambahTransaksi",
    payload
  );


  event.target.reset();

  document.getElementById(
    "trxTanggal"
  ).value =
    getLocalDate();

  document.getElementById(
    "trxRekening"
  ).value =
    "Kas";

  setTransactionType(
    transactionType
  );

}


/* =========================================================
   BARANG
   ========================================================= */

function renderBarang() {

  const container =
    document.getElementById(
      "barangList"
    );

  if (!container) return;


  currentBarangList =
    Array.isArray(
      appData.barang
    )
      ? appData.barang
      : [];


  if (!currentBarangList.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada barang.
        <br><br>
        Tekan "+ Tambah Barang".
      </div>`;

    return;

  }


  container.innerHTML =
    currentBarangList
      .map(
        barangHTML
      )
      .join("");

}


function barangHTML(item) {

  const id =
    item.id ||
    item.ID ||
    item.kode ||
    item.sku ||
    "";

  const nama =
    item.nama ||
    item.Nama ||
    item.name ||
    "Barang";


  const stok =
    numberValue(
      item.stok ||
      item.Stok
    );


  const modal =
    numberValue(
      item.hargaModal ||
      item.modal ||
      item.harga_modal ||
      item.HargaModal
    );


  const jual =
    numberValue(
      item.hargaJual ||
      item.jual ||
      item.harga_jual ||
      item.HargaJual
    );


  return `
    <div
      class="form-card"
      style="display:flex;align-items:center;justify-content:space-between;gap:12px;"
    >

      <div style="min-width:0;">

        <strong
          style="font-size:15px;display:block;"
        >
          ${escapeHTML(nama)}
        </strong>

        <div
          class="small"
          style="margin-top:5px;"
        >
          Stok: <strong>${formatNumber(stok)}</strong>
        </div>

        <div
          class="small"
          style="margin-top:3px;"
        >
          Modal:
          <strong>${rupiah(modal)}</strong>
        </div>

      </div>

      <div style="text-align:right;">

        <div
          class="small"
        >
          Harga Jual
        </div>

        <strong
          style="display:block;color:#2563eb;margin-top:4px;"
        >
          ${rupiah(jual)}
        </strong>

      </div>

    </div>
  `;

}


function filterBarang(keyword) {

  const term =
    String(
      keyword || ""
    )
      .toLowerCase()
      .trim();


  const filtered =
    currentBarangList.filter(
      function (item) {

        const nama =
          String(
            item.nama ||
            item.Nama ||
            item.name ||
            ""
          )
            .toLowerCase();

        return nama.includes(
          term
        );

      }
    );


  const container =
    document.getElementById(
      "barangList"
    );

  if (!container) return;


  if (!filtered.length) {

    container.innerHTML =
      `<div class="empty">
        Barang tidak ditemukan.
      </div>`;

    return;

  }


  container.innerHTML =
    filtered
      .map(barangHTML)
      .join("");

}


/* =========================================================
   BARANG SELECT
   ========================================================= */

function renderBarangSelects() {

  const jual =
    document.getElementById(
      "jualBarang"
    );

  const belanja =
    document.getElementById(
      "belanjaBarang"
    );


  const list =
    Array.isArray(
      appData.barang
    )
      ? appData.barang
      : [];


  if (jual) {

    const old =
      jual.value;

    jual.innerHTML =
      `<option value="">
        Pilih barang
      </option>`;


    list.forEach(
      function (item, index) {

        const id =
          item.id ||
          item.ID ||
          item.kode ||
          index;


        const nama =
          item.nama ||
          item.Nama ||
          item.name ||
          "Barang";


        jual.innerHTML +=
          `<option value="${escapeAttr(id)}">
            ${escapeHTML(nama)}
          </option>`;

      }
    );


    if (old) {
      jual.value = old;
    }

  }


  if (belanja) {

    const old =
      belanja.value;

    belanja.innerHTML =
      `<option value="">
        Pilih barang
      </option>`;


    list.forEach(
      function (item, index) {

        const id =
          item.id ||
          item.ID ||
          item.kode ||
          index;


        const nama =
          item.nama ||
          item.Nama ||
          item.name ||
          "Barang";


        belanja.innerHTML +=
          `<option value="${escapeAttr(id)}">
            ${escapeHTML(nama)}
          </option>`;

      }
    );


    if (old) {
      belanja.value = old;
    }

  }

}


/* =========================================================
   AUTO PRICE
   ========================================================= */

function findBarang(id) {

  return appData.barang.find(
    function (item, index) {

      const itemId =
        item.id ||
        item.ID ||
        item.kode ||
        index;

      return String(itemId) ===
        String(id);

    }
  );

}


function autoHargaJual() {

  const id =
    valueOf("jualBarang");

  const barang =
    findBarang(id);

  if (!barang) return;


  const harga =
    numberValue(
      barang.hargaJual ||
      barang.jual ||
      barang.harga_jual ||
      barang.HargaJual
    );


  const input =
    document.getElementById(
      "jualHarga"
    );

  if (input && harga > 0) {

    input.value =
      harga;

  }


  updateJualTotal();

}


function autoHargaModal() {

  const id =
    valueOf("belanjaBarang");

  const barang =
    findBarang(id);

  if (!barang) return;


  const harga =
    numberValue(
      barang.hargaModal ||
      barang.modal ||
      barang.harga_modal ||
      barang.HargaModal
    );


  const input =
    document.getElementById(
      "belanjaHarga"
    );

  if (input && harga > 0) {

    input.value =
      harga;

  }


  updateBelanjaTotal();

}


/* =========================================================
   PENJUALAN
   ========================================================= */

function updateJualTotal() {

  const qty =
    numberValue(
      valueOf("jualQty")
    );

  const harga =
    numberValue(
      valueOf("jualHarga")
    );


  setText(
    "jualTotalPreview",
    rupiah(
      qty * harga
    )
  );

}


async function submitPenjualan(event) {

  event.preventDefault();


  const barang =
    valueOf("jualBarang");

  const qty =
    numberValue(
      valueOf("jualQty")
    );

  const harga =
    numberValue(
      valueOf("jualHarga")
    );

  const pelanggan =
    valueOf("jualPelanggan") ||
    "Umum";


  if (!barang ||
      qty <= 0 ||
      harga <= 0) {

    showToast(
      "Lengkapi data penjualan"
    );

    return;

  }


  const total =
    qty * harga;


  const payload = {

    tanggal:
      getLocalDate(),

    barangId:
      barang,

    idBarang:
      barang,

    qty:
      qty,

    jumlah:
      qty,

    harga:
      harga,

    hargaJual:
      harga,

    total:
      total,

    pelanggan:
      pelanggan

  };


  await saveOrQueue(
    "tambahPenjualan",
    payload
  );


  event.target.reset();

  setText(
    "jualTotalPreview",
    "Rp 0"
  );


}


/* =========================================================
   BELANJA
   ========================================================= */

function updateBelanjaTotal() {

  const qty =
    numberValue(
      valueOf("belanjaQty")
    );

  const harga =
    numberValue(
      valueOf("belanjaHarga")
    );


  setText(
    "belanjaTotalPreview",
    rupiah(
      qty * harga
    )
  );

}


async function submitBelanja(event) {

  event.preventDefault();


  const barang =
    valueOf("belanjaBarang");

  const qty =
    numberValue(
      valueOf("belanjaQty")
    );

  const harga =
    numberValue(
      valueOf("belanjaHarga")
    );

  const supplier =
    valueOf("belanjaSupplier") ||
    "";


  if (!barang ||
      qty <= 0 ||
      harga <= 0) {

    showToast(
      "Lengkapi data belanja"
    );

    return;

  }


  const total =
    qty * harga;


  const payload = {

    tanggal:
      getLocalDate(),

    barangId:
      barang,

    idBarang:
      barang,

    qty:
      qty,

    jumlah:
      qty,

    harga:
      harga,

    hargaModal:
      harga,

    total:
      total,

    supplier:
      supplier

  };


  await saveOrQueue(
    "tambahBelanja",
    payload
  );


  event.target.reset();

  setText(
    "belanjaTotalPreview",
    "Rp 0"
  );

}


/* =========================================================
   TAMBAH BARANG
   ========================================================= */

async function submitBarang(event) {

  event.preventDefault();


  const nama =
    valueOf("barangNama");

  const hargaModal =
    numberValue(
      valueOf(
        "barangModalPrice"
      )
    );

  const hargaJual =
    numberValue(
      valueOf(
        "barangJualPrice"
      )
    );

  const stok =
    numberValue(
      valueOf("barangStok")
    );


  if (!nama ||
      hargaModal < 0 ||
      hargaJual < 0 ||
      stok < 0) {

    showToast(
      "Data barang belum lengkap"
    );

    return;

  }


  const payload = {

    nama:
      nama,

    hargaModal:
      hargaModal,

    modal:
      hargaModal,

    hargaJual:
      hargaJual,

    jual:
      hargaJual,

    stok:
      stok

  };


  await saveOrQueue(
    "tambahBarang",
    payload
  );


  event.target.reset();

  closeModal(
    "barangModal"
  );


}


/* =========================================================
   HUTANG
   ========================================================= */

async function submitHutang(event) {

  event.preventDefault();


  const nama =
    valueOf("hutangNama");

  const nominal =
    numberValue(
      valueOf("hutangNominal")
    );

  const tempo =
    valueOf("hutangTempo");

  const keterangan =
    valueOf(
      "hutangKeterangan"
    );


  if (!nama ||
      nominal <= 0) {

    showToast(
      "Lengkapi data hutang"
    );

    return;

  }


  const payload = {

    nama:
      nama,

    pihak:
      nama,

    nominal:
      nominal,

    jatuhTempo:
      tempo,

    tempo:
      tempo,

    keterangan:
      keterangan

  };


  await saveOrQueue(
    "tambahHutang",
    payload
  );


  event.target.reset();

  closeModal(
    "hutangModal"
  );

}


/* =========================================================
   HUTANG LIST
   ========================================================= */

function renderHutang() {

  const container =
    document.getElementById(
      "hutangList"
    );

  if (!container) return;


  const list =
    Array.isArray(
      appData.hutang
    )
      ? appData.hutang
      : [];


  if (!list.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada hutang.
      </div>`;

    return;

  }


  container.innerHTML =
    list
      .map(
        hutangHTML
      )
      .join("");

}


function hutangHTML(item) {

  const nama =
    item.nama ||
    item.pihak ||
    item.Nama ||
    "Hutang";


  const nominal =
    numberValue(
      item.nominal ||
      item.Nominal ||
      item.sisa
    );


  const tempo =
    item.jatuhTempo ||
    item.tempo ||
    item.tanggalTempo ||
    "";


  let tempoText =
    "";


  if (tempo) {

    tempoText =
      formatDateDisplay(
        tempo
      );

  }


  return `
    <div
      class="form-card"
      style="display:flex;justify-content:space-between;gap:12px;"
    >

      <div>

        <strong
          style="display:block;font-size:15px;"
        >
          ${escapeHTML(nama)}
        </strong>

        <div
          class="small"
          style="margin-top:5px;"
        >
          ${tempoText
            ? "Jatuh tempo: " +
              escapeHTML(tempoText)
            : "Belum ada jatuh tempo"}
        </div>

      </div>

      <strong
        style="color:#dc2626;white-space:nowrap;"
      >
        ${rupiah(nominal)}
      </strong>

    </div>
  `;

}


/* =========================================================
   HISTORY
   ========================================================= */

function renderHistory() {

  currentHistoryList =
    Array.isArray(
      appData.history
    )
      ? appData.history
      : [];


  const container =
    document.getElementById(
      "historyList"
    );

  if (!container) return;


  if (!currentHistoryList.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada transaksi.
      </div>`;

    return;

  }


  container.innerHTML =
    currentHistoryList
      .map(
        transactionHTML
      )
      .join("");

}


function transactionHTML(item) {

  const jenis =
    String(
      item.jenis ||
      item.type ||
      item.tipe ||
      ""
    )
      .toUpperCase();


  const pemasukan =
    jenis === "PEMASUKAN" ||
    jenis === "INCOME";


  const nominal =
    numberValue(
      item.nominal ||
      item.total ||
      item.jumlah
    );


  const tanggal =
    item.tanggal ||
    item.date ||
    item.waktu ||
    "";


  const kategori =
    item.kategori ||
    item.category ||
    "";


  const keterangan =
    item.keterangan ||
    item.deskripsi ||
    item.nama ||
    item.description ||
    "Transaksi";


  const color =
    pemasukan
      ? "#16a34a"
      : "#dc2626";


  const sign =
    pemasukan
      ? "+"
      : "-";


  return `
    <div
      class="form-card"
      style="display:flex;justify-content:space-between;gap:12px;"
    >

      <div
        style="min-width:0;"
      >

        <strong
          style="display:block;font-size:14px;"
        >
          ${escapeHTML(keterangan)}
        </strong>

        <div
          class="small"
          style="margin-top:4px;"
        >
          ${escapeHTML(
            formatDateDisplay(
              tanggal
            )
          )}
          ${kategori
            ? " • " +
              escapeHTML(kategori)
            : ""}
        </div>

      </div>

      <strong
        style="color:${color};white-space:nowrap;"
      >
        ${sign}
        ${rupiah(nominal)}
      </strong>

    </div>
  `;

}


function filterHistory(keyword) {

  const term =
    String(
      keyword || ""
    )
      .toLowerCase()
      .trim();


  const filtered =
    currentHistoryList.filter(
      function (item) {

        const text =
          [
            item.jenis,
            item.kategori,
            item.keterangan,
            item.deskripsi,
            item.nama,
            item.tanggal,
            item.nominal
          ]
            .join(" ")
            .toLowerCase();


        return text.includes(
          term
        );

      }
    );


  const container =
    document.getElementById(
      "historyList"
    );

  if (!container) return;


  if (!filtered.length) {

    container.innerHTML =
      `<div class="empty">
        Transaksi tidak ditemukan.
      </div>`;

    return;

  }


  container.innerHTML =
    filtered
      .map(
        transactionHTML
      )
      .join("");

}


/* =========================================================
   SAVE / OFFLINE QUEUE
   ========================================================= */

async function saveOrQueue(
  action,
  payload
) {

  const queueItem = {

    action:
      action,

    payload:
      payload,

    createdAt:
      Date.now(),

    retry:
      0

  };


  if (!navigator.onLine) {

    await addQueue(
      queueItem
    );

    showToast(
      "Disimpan offline"
    );

    updateSyncBadge();

    return;

  }


  try {

    setSyncText(
      "Menyimpan..."
    );


    const result =
      await gasRequest(
        action,
        payload
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


    showToast(
      "Berhasil disimpan"
    );


    setSyncText(
      "Data tersimpan"
    );


    await loadAppData();


  } catch (error) {

    console.warn(
      "Gagal online, masuk queue:",
      error
    );


    await addQueue(
      queueItem
    );


    showToast(
      "Server gagal — disimpan offline"
    );


    updateSyncBadge();

  }

}


/* =========================================================
   QUEUE
   ========================================================= */

async function addQueue(item) {

  if (!db) {

    try {
      await openDatabase();
    } catch (error) {
      console.error(error);
      return;
    }

  }


  return new Promise(
    function (resolve, reject) {

      const transaction =
        db.transaction(
          QUEUE_STORE,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          QUEUE_STORE
        );


      store.add(item);


      transaction.oncomplete =
        function () {
          resolve();
        };


      transaction.onerror =
        function () {
          reject(
            transaction.error
          );
        };

    }
  );

}


async function getQueue() {

  if (!db) {

    try {
      await openDatabase();
    } catch (error) {
      return [];
    }

  }


  return new Promise(
    function (resolve) {

      const transaction =
        db.transaction(
          QUEUE_STORE,
          "readonly"
        );

      const store =
        transaction.objectStore(
          QUEUE_STORE
        );


      const request =
        store.getAll();


      request.onsuccess =
        function () {

          resolve(
            request.result || []
          );

        };


      request.onerror =
        function () {

          resolve([]);

        };

    }
  );

}


async function deleteQueueItem(id) {

  return new Promise(
    function (resolve) {

      const transaction =
        db.transaction(
          QUEUE_STORE,
          "readwrite"
        );

      transaction
        .objectStore(
          QUEUE_STORE
        )
        .delete(id);


      transaction.oncomplete =
        function () {
          resolve();
        };


      transaction.onerror =
        function () {
          resolve();
        };

    }
  );

}


/* =========================================================
   SYNC OFFLINE
   ========================================================= */

async function syncOffline() {

  if (syncRunning) return;


  if (!navigator.onLine) {

    setSyncText(
      "Offline — belum dapat sinkron"
    );

    updateSyncBadge();

    return;

  }


  syncRunning = true;


  try {

    const queue =
      await getQueue();


    if (!queue.length) {

      setSyncText(
        "Semua data sudah sinkron"
      );

      updateSyncBadge();

      return;

    }


    setSyncText(
      "Sinkronkan " +
      queue.length +
      " data..."
    );


    let successCount = 0;


    for (
      const item of queue
    ) {

      try {

        await gasRequest(
          item.action,
          item.payload
        );


        await deleteQueueItem(
          item.id
        );


        successCount++;


      } catch (error) {

        console.warn(
          "Queue gagal:",
          item,
          error
        );

        break;

      }

    }


    updateSyncBadge();


    if (successCount > 0) {

      showToast(
        successCount +
        " data berhasil disinkronkan"
      );

      await loadAppData();

    }


  } catch (error) {

    console.error(
      "syncOffline:",
      error
    );

    setSyncText(
      "Sinkronisasi gagal"
    );

  } finally {

    syncRunning = false;

    updateSyncBadge();

  }

}


/* =========================================================
   SYNC BADGE
   ========================================================= */

async function updateSyncBadge() {

  const badge =
    document.getElementById(
      "syncBadge"
    );

  if (!badge) return;


  const queue =
    await getQueue();


  const count =
    queue.length;


  badge.textContent =
    count;


  badge.classList.toggle(
    "hidden",
    count === 0
  );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showPage(page) {

  const pages =
    document.querySelectorAll(
      ".page"
    );


  pages.forEach(
    function (element) {

      element.classList.remove(
        "active"
      );

    }
  );


  const target =
    document.getElementById(
      "page-" + page
    );


  if (target) {

    target.classList.add(
      "active"
    );

  } else {

    console.warn(
      "Page tidak ditemukan:",
      page
    );

    return;

  }


  updateBottomNav(
    page
  );


  closeQuickAdd();
  closeMoreMenu();


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  /*
   * Refresh data ketika membuka
   * halaman tertentu.
   */

  if (page === "dashboard") {
    renderDashboard();
  }

  if (page === "barang") {
    renderBarang();
  }

  if (page === "history") {
    renderHistory();
  }

  if (page === "hutang") {
    renderHutang();
  }

}


function updateBottomNav(page) {

  const nav =
    document.querySelectorAll(
      ".nav-item"
    );


  nav.forEach(
    function (item) {

      item.classList.remove(
        "active"
      );

    }
  );


  /*
   * Bottom nav urutan:
   * dashboard
   * add
   * quick
   * barang
   * lainnya
   */

  if (page === "dashboard") {

    if (nav[0]) {
      nav[0].classList.add(
        "active"
      );
    }

  }


  if (page === "add") {

    if (nav[1]) {
      nav[1].classList.add(
        "active"
      );
    }

  }


  if (page === "barang") {

    if (nav[3]) {
      nav[3].classList.add(
        "active"
      );
    }

  }


  if (
    [
      "penjualan",
      "belanja",
      "hutang",
      "history",
      "report"
    ].includes(page)
  ) {

    if (nav[4]) {
      nav[4].classList.add(
        "active"
      );
    }

  }

}


/* =========================================================
   QUICK ADD
   ========================================================= */

function openQuickAdd() {

  const menu =
    document.getElementById(
      "quickAddMenu"
    );

  if (!menu) return;


  menu.classList.toggle(
    "show"
  );

}


function closeQuickAdd() {

  const menu =
    document.getElementById(
      "quickAddMenu"
    );

  if (!menu) return;


  menu.classList.remove(
    "show"
  );

}


/* =========================================================
   MORE MENU
   ========================================================= */

function showMoreMenu() {

  const menu =
    document.getElementById(
      "moreMenu"
    );

  if (!menu) return;


  menu.classList.remove(
    "hidden"
  );

}


function closeMoreMenu() {

  const menu =
    document.getElementById(
      "moreMenu"
    );

  if (!menu) return;


  menu.classList.add(
    "hidden"
  );

}


function openFromMenu(page) {

  closeMoreMenu();

  showPage(
    page
  );

}


/* =========================================================
   MODAL
   ========================================================= */

function openModal(id) {

  const modal =
    document.getElementById(
      id
    );

  if (!modal) return;


  modal.classList.remove(
    "hidden"
  );


  document.body.style.overflow =
    "hidden";

}


function closeModal(id) {

  const modal =
    document.getElementById(
      id
    );

  if (!modal) return;


  modal.classList.add(
    "hidden"
  );


  /*
   * Hanya buka scroll kembali
   * jika tidak ada modal lain.
   */

  const otherModal =
    document.querySelector(
      ".modal:not(.hidden)"
    );


  if (!otherModal) {

    document.body.style.overflow =
      "";

  }

}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshApp() {

  if (!navigator.onLine) {

    showToast(
      "Anda sedang offline"
    );

    return;

  }


  showToast(
    "Memuat ulang data..."
  );


  await loadAppData();

}


/* =========================================================
   ONLINE STATUS
   ========================================================= */

function updateOnlineStatus() {

  const dot =
    document.getElementById(
      "onlineDot"
    );

  const text =
    document.getElementById(
      "onlineText"
    );


  const online =
    navigator.onLine;


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

}


/* =========================================================
   SYNC TEXT
   ========================================================= */

function setSyncText(text) {

  const element =
    document.getElementById(
      "syncText"
    );

  if (element) {

    element.textContent =
      text;

  }

}


/* =========================================================
   LOADING
   ========================================================= */

function hideLoading() {

  const loading =
    document.getElementById(
      "loading"
    );

  if (!loading) return;


  loading.classList.add(
    "hidden"
  );

}


/* =========================================================
   REPORT
   ========================================================= */

async function loadReport() {

  const start =
    valueOf(
      "reportStart"
    );

  const end =
    valueOf(
      "reportEnd"
    );


  if (!start || !end) {

    showToast(
      "Pilih periode laporan"
    );

    return;

  }


  if (start > end) {

    showToast(
      "Tanggal mulai tidak boleh lebih besar"
    );

    return;

  }


  const container =
    document.getElementById(
      "reportResult"
    );


  if (container) {

    container.innerHTML =
      `<div class="empty">
        Mengambil laporan...
      </div>`;

  }


  try {

    const result =
      await gasRequest(
        "laporan",
        {
          mulai: start,
          tanggalMulai: start,
          dari: start,

          selesai: end,
          tanggalSelesai: end,
          sampai: end
        }
      );


    const data =
      result.data ||
      result;


    renderReport(
      data,
      start,
      end
    );


  } catch (error) {

    console.error(
      "Laporan:",
      error
    );


    if (container) {

      container.innerHTML =
        `<div class="empty">
          Gagal mengambil laporan.
          <br><br>
          ${escapeHTML(
            error.message
          )}
        </div>`;

    }

  }

}


function renderReport(
  data,
  start,
  end
) {

  const container =
    document.getElementById(
      "reportResult"
    );

  if (!container) return;


  const pemasukan =
    numberValue(
      data.pemasukan ||
      data.totalPemasukan ||
      data.income
    );


  const pengeluaran =
    numberValue(
      data.pengeluaran ||
      data.totalPengeluaran ||
      data.expense
    );


  const penjualan =
    numberValue(
      data.penjualan ||
      data.totalPenjualan ||
      data.sales
    );


  const belanja =
    numberValue(
      data.belanja ||
      data.totalBelanja ||
      data.purchase
    );


  const laba =
    numberValue(
      data.laba ||
      data.keuntungan ||
      (penjualan - belanja)
    );


  const saldo =
    numberValue(
      data.saldo ||
      (pemasukan - pengeluaran)
    );


  container.innerHTML = `

    <h3
      style="margin:0 0 15px;"
    >
      Laporan Keuangan
    </h3>

    <div
      class="summary-grid"
    >

      <div class="summary-card">

        <div class="summary-icon">
          ↗
        </div>

        <div>
          <div class="small">
            Pemasukan
          </div>

          <strong>
            ${rupiah(pemasukan)}
          </strong>
        </div>

      </div>


      <div class="summary-card">

        <div class="summary-icon">
          ↘
        </div>

        <div>
          <div class="small">
            Pengeluaran
          </div>

          <strong>
            ${rupiah(pengeluaran)}
          </strong>
        </div>

      </div>


      <div class="summary-card">

        <div class="summary-icon">
          🛒
        </div>

        <div>
          <div class="small">
            Penjualan
          </div>

          <strong>
            ${rupiah(penjualan)}
          </strong>
        </div>

      </div>


      <div class="summary-card">

        <div class="summary-icon">
          📦
        </div>

        <div>
          <div class="small">
            Belanja
          </div>

          <strong>
            ${rupiah(belanja)}
          </strong>
        </div>

      </div>

    </div>


    <div
      style="
        margin-top:15px;
        padding:16px;
        border-radius:14px;
        background:#eff6ff;
      "
    >

      <div class="small">
        Periode
      </div>

      <strong>
        ${escapeHTML(
          formatDateDisplay(start)
        )}
        —
        ${escapeHTML(
          formatDateDisplay(end)
        )}
      </strong>

    </div>


    <div
      style="
        margin-top:10px;
        padding:16px;
        border-radius:14px;
        background:#f8fafc;
      "
    >

      <div class="small">
        Saldo Bersih
      </div>

      <strong
        style="font-size:20px;"
      >
        ${rupiah(saldo)}
      </strong>

    </div>


    <div
      style="
        margin-top:10px;
        padding:16px;
        border-radius:14px;
        background:#f8fafc;
      "
    >

      <div class="small">
        Perkiraan Laba
      </div>

      <strong
        style="font-size:20px;color:#16a34a;"
      >
        ${rupiah(laba)}
      </strong>

    </div>

  `;

}


/* =========================================================
   UTILITIES
   ========================================================= */

function valueOf(id) {

  const element =
    document.getElementById(id);

  if (!element) {
    return "";
  }

  return String(
    element.value || ""
  ).trim();

}


function setText(
  id,
  text
) {

  const element =
    document.getElementById(id);

  if (element) {

    element.textContent =
      text;

  }

}


function numberValue(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;

  }


  if (
    typeof value === "number"
  ) {

    return Number.isFinite(value)
      ? value
      : 0;

  }


  /*
   * Hilangkan Rp, titik, spasi.
   * Komma diperlakukan sebagai desimal
   * hanya jika formatnya memang decimal.
   */

  let str =
    String(value)
      .trim()
      .replace(/Rp/gi, "")
      .replace(/\s/g, "");


  /*
   * Format Indonesia:
   * 1.500.000
   */

  if (
    str.includes(".") &&
    !str.includes(",")
  ) {

    str =
      str.replace(/\./g, "");

  } else {

    str =
      str
        .replace(/\./g, "")
        .replace(",", ".");

  }


  const number =
    Number(str);


  return Number.isFinite(number)
    ? number
    : 0;

}


function rupiah(value) {

  const number =
    numberValue(value);


  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }
  ).format(number);

}


function formatNumber(value) {

  return new Intl.NumberFormat(
    "id-ID"
  ).format(
    numberValue(value)
  );

}


function formatDateDisplay(value) {

  if (!value) {
    return "";
  }


  let date;


  /*
   * YYYY-MM-DD
   */

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {

    const parts =
      value.split("-");

    return (
      parts[2] +
      "/" +
      parts[1] +
      "/" +
      parts[0]
    );

  }


  date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(value);

  }


  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);

}


function escapeHTML(value) {

  return String(
    value ?? ""
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function escapeAttr(value) {

  return escapeHTML(value);

}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;


function showToast(message) {

  const toast =
    document.getElementById(
      "toast"
    );

  if (!toast) return;


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      function () {

        toast.classList.remove(
          "show"
        );

      },
      2500
    );

}


/* =========================================================
   AUTO SYNC
   ========================================================= */

setInterval(
  function () {

    if (
      navigator.onLine &&
      !syncRunning
    ) {

      updateSyncBadge();

    }

  },
  15000
);


/* =========================================================
   EXPOSE FUNCTIONS
   Untuk onclick="" di HTML
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

window.autoHargaJual =
  autoHargaJual;

window.autoHargaModal =
  autoHargaModal;


/* =========================================================
   END
   ========================================================= */

console.log(
  "CatatKu app.js loaded"
);
