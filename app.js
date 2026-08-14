/* =========================================================
   CATATKU
   app.js - Frontend PWA + Google Apps Script
   OFFLINE FIRST + INDEXEDDB AUTO REPAIR
   ========================================================= */

"use strict";

/* =========================================================
   KONFIGURASI GAS & INDEXED DB
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxrgQIppwaphvBIQjMbV6e5EO18C6O066k0jbBvRWPCKKV1rp9A7TQhZfM9_I01lL6a/exec";

const API_KEY = "CATATKU-2026-PRIBADI";

const DB_NAME = "CatatKuDB";

/*
 * Naikkan versi agar database lama dipaksa menjalankan
 * proses upgrade dan memastikan object store tersedia.
 */
const DB_VERSION = 4;

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
let toastTimer = null;

/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {

  console.log("CatatKu mulai...");

  initDates();
  initEvents();
  updateOnlineStatus();

  window.addEventListener("online", async function () {

    updateOnlineStatus();

    setSyncText("Online — sinkronisasi...");

    try {
      await syncOffline();
      await loadAppData();
    } catch (error) {
      console.error("Online sync error:", error);
    }

  });

  window.addEventListener("offline", function () {

    updateOnlineStatus();

    setSyncText(
      "Offline — data akan disimpan di perangkat"
    );

  });

  try {

    await openDatabase();

    await ensureDatabaseStores();

    await loadLocalCache();

    await updateSyncBadge();

    if (navigator.onLine) {

      await loadAppData();

      await syncOffline();

    } else {

      setSyncText(
        "Offline — menggunakan data tersimpan"
      );

    }

  } catch (error) {

    console.error("Startup error:", error);

    setSyncText("Mode offline");

    showToast(
      "Aplikasi dibuka dalam mode offline"
    );

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


  const searchBarang =
    document.getElementById("searchBarang");

  if (searchBarang) {

    searchBarang.addEventListener(
      "input",
      function (e) {

        filterBarang(e.target.value);

      }
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
   DATE HELPERS
   ========================================================= */

function initDates() {

  const today = getLocalDate();

  const trxTanggal =
    document.getElementById("trxTanggal");

  if (
    trxTanggal &&
    !trxTanggal.value
  ) {

    trxTanggal.value = today;

  }


  const reportStart =
    document.getElementById("reportStart");

  const reportEnd =
    document.getElementById("reportEnd");


  if (
    reportEnd &&
    !reportEnd.value
  ) {

    reportEnd.value = today;

  }


  if (
    reportStart &&
    !reportStart.value
  ) {

    const date = new Date();

    date.setDate(
      date.getDate() - 30
    );

    reportStart.value =
      formatDateInput(date);

  }

}


function getLocalDate() {

  const d = new Date();

  return (
    d.getFullYear() +
    "-" +
    String(
      d.getMonth() + 1
    ).padStart(2, "0") +
    "-" +
    String(
      d.getDate()
    ).padStart(2, "0")
  );

}


function formatDateInput(date) {

  return (
    date.getFullYear() +
    "-" +
    String(
      date.getMonth() + 1
    ).padStart(2, "0") +
    "-" +
    String(
      date.getDate()
    ).padStart(2, "0")
  );

}


/* =========================================================
   INDEXED DB CORE
   ========================================================= */

/*
 * Membuka database.
 *
 * PERBAIKAN:
 * object store selalu dicek dan dibuat di onupgradeneeded.
 */

function openDatabase() {

  return new Promise(function (
    resolve,
    reject
  ) {

    if (db) {

      if (
        hasStore(QUEUE_STORE) &&
        hasStore(CACHE_STORE)
      ) {

        resolve(db);

        return;

      }

      db = null;

    }


    if (!window.indexedDB) {

      reject(
        new Error(
          "IndexedDB tidak tersedia"
        )
      );

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


        console.log(
          "IndexedDB upgrade:",
          event.oldVersion,
          "→",
          event.newVersion
        );


        /*
         * STORE QUEUE
         */

        if (
          !database.objectStoreNames.contains(
            QUEUE_STORE
          )
        ) {

          database.createObjectStore(
            QUEUE_STORE,
            {
              keyPath: "id",
              autoIncrement: true
            }
          );

          console.log(
            "Object store dibuat:",
            QUEUE_STORE
          );

        }


        /*
         * STORE CACHE
         */

        if (
          !database.objectStoreNames.contains(
            CACHE_STORE
          )
        ) {

          database.createObjectStore(
            CACHE_STORE,
            {
              keyPath: "key"
            }
          );

          console.log(
            "Object store dibuat:",
            CACHE_STORE
          );

        }

      };


    request.onsuccess =
      function (event) {

        db = event.target.result;


        /*
         * Jika database ditutup dari tempat lain,
         * kosongkan reference.
         */

        db.onclose = function () {

          db = null;

        };


        db.onerror = function (event) {

          console.warn(
            "IndexedDB error:",
            event
          );

        };


        console.log(
          "IndexedDB aktif:",
          DB_NAME,
          "v" + db.version
        );


        if (
          !hasStore(QUEUE_STORE) ||
          !hasStore(CACHE_STORE)
        ) {

          console.warn(
            "Object store belum lengkap"
          );

        }


        resolve(db);

      };


    request.onerror =
      function () {

        db = null;

        reject(
          request.error ||
          new Error(
            "Gagal membuka IndexedDB"
          )
        );

      };


    request.onblocked =
      function () {

        console.warn(
          "IndexedDB sedang diblokir"
        );

      };

  });

}


/*
 * Mengecek apakah object store tersedia.
 */

function hasStore(storeName) {

  return (
    db &&
    db.objectStoreNames &&
    db.objectStoreNames.contains(
      storeName
    )
  );

}


/*
 * Memastikan store tersedia.
 */

async function ensureDatabaseStores() {

  if (!db) {
    await openDatabase();
  }


  if (
    hasStore(QUEUE_STORE) &&
    hasStore(CACHE_STORE)
  ) {

    return true;

  }


  /*
   * Jika store tidak ada,
   * tutup DB lalu hapus dan buat ulang.
   *
   * Data antrean lama yang rusak memang
   * tidak bisa digunakan lagi.
   */

  console.warn(
    "Database tidak lengkap. Membuat ulang..."
  );


  try {

    db.close();

  } catch (e) {}


  db = null;


  await deleteDatabase();


  await openDatabase();


  return (
    hasStore(QUEUE_STORE) &&
    hasStore(CACHE_STORE)
  );

}


/*
 * Hapus database secara aman.
 */

function deleteDatabase() {

  return new Promise(function (
    resolve,
    reject
  ) {

    try {

      const request =
        indexedDB.deleteDatabase(
          DB_NAME
        );


      request.onsuccess =
        function () {

          console.log(
            "Database lama dihapus"
          );

          resolve();

        };


      request.onerror =
        function () {

          reject(
            request.error
          );

        };


      request.onblocked =
        function () {

          console.warn(
            "Penghapusan database diblokir"
          );

          /*
           * Tetap lanjut setelah beberapa saat.
           */

          setTimeout(
            resolve,
            500
          );

        };

    } catch (error) {

      reject(error);

    }

  });

}


/* =========================================================
   CACHE
   ========================================================= */

async function saveCache(
  key,
  value
) {

  try {

    if (!db) {
      await openDatabase();
    }


    if (!hasStore(CACHE_STORE)) {

      await ensureDatabaseStores();

    }


    return new Promise(
      function (
        resolve,
        reject
      ) {

        let transaction;

        try {

          transaction =
            db.transaction(
              CACHE_STORE,
              "readwrite"
            );

        } catch (error) {

          /*
           * Auto repair satu kali.
           */

          ensureDatabaseStores()
            .then(function () {

              saveCache(
                key,
                value
              )
                .then(resolve)
                .catch(reject);

            })
            .catch(reject);

          return;

        }


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

      }
    );

  } catch (error) {

    console.warn(
      "saveCache error:",
      error
    );

  }

}


/* =========================================================
   GET CACHE
   ========================================================= */

async function getCache(key) {

  try {

    if (!db) {
      await openDatabase();
    }


    if (!hasStore(CACHE_STORE)) {

      await ensureDatabaseStores();

    }


    return new Promise(
      function (resolve) {

        let transaction;

        try {

          transaction =
            db.transaction(
              CACHE_STORE,
              "readonly"
            );

        } catch (error) {

          console.warn(
            "Cache transaction error:",
            error
          );

          resolve(null);

          return;

        }


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

      }
    );

  } catch (error) {

    console.warn(
      "getCache error:",
      error
    );

    return null;

  }

}


/* =========================================================
   LOAD LOCAL CACHE
   ========================================================= */

async function loadLocalCache() {

  try {

    const cached =
      await getCache(
        "appData"
      );


    if (!cached) {

      console.log(
        "Belum ada cache lokal"
      );

      return;

    }


    appData =
      normalizeAppData(
        cached
      );


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
   OFFLINE QUEUE
   ========================================================= */

async function addToQueue(
  action,
  payload
) {

  try {

    if (!db) {
      await openDatabase();
    }


    if (!hasStore(QUEUE_STORE)) {

      await ensureDatabaseStores();

    }


    return new Promise(
      function (
        resolve,
        reject
      ) {

        let transaction;

        try {

          transaction =
            db.transaction(
              QUEUE_STORE,
              "readwrite"
            );

        } catch (error) {

          console.warn(
            "Queue transaction error. Repair DB..."
          );


          ensureDatabaseStores()
            .then(function () {

              addToQueue(
                action,
                payload
              )
                .then(resolve)
                .catch(reject);

            })
            .catch(reject);


          return;

        }


        const store =
          transaction.objectStore(
            QUEUE_STORE
          );


        store.add({

          action: action,

          payload: payload,

          createdAt: Date.now()

        });


        transaction.oncomplete =
          async function () {

            await updateSyncBadge();

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

  } catch (error) {

    console.error(
      "addToQueue:",
      error
    );

    throw error;

  }

}


/* =========================================================
   GET QUEUE
   ========================================================= */

async function getQueue() {

  try {

    if (!db) {
      await openDatabase();
    }


    if (!hasStore(QUEUE_STORE)) {

      await ensureDatabaseStores();

    }


    return new Promise(
      function (resolve) {

        let transaction;

        try {

          transaction =
            db.transaction(
              QUEUE_STORE,
              "readonly"
            );

        } catch (error) {

          console.warn(
            "getQueue transaction error:",
            error
          );

          resolve([]);

          return;

        }


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

  } catch (error) {

    console.warn(
      "getQueue error:",
      error
    );

    return [];

  }

}


/* =========================================================
   REMOVE QUEUE
   ========================================================= */

async function removeFromQueue(id) {

  try {

    if (!db) {
      await openDatabase();
    }


    if (!hasStore(QUEUE_STORE)) {

      await ensureDatabaseStores();

    }


    return new Promise(
      function (resolve) {

        let transaction;

        try {

          transaction =
            db.transaction(
              QUEUE_STORE,
              "readwrite"
            );

        } catch (error) {

          resolve();

          return;

        }


        const store =
          transaction.objectStore(
            QUEUE_STORE
          );


        store.delete(id);


        transaction.oncomplete =
          async function () {

            await updateSyncBadge();

            resolve();

          };


        transaction.onerror =
          function () {

            resolve();

          };

      }
    );

  } catch (error) {

    console.warn(
      "removeFromQueue error:",
      error
    );

  }

}


/* =========================================================
   SYNC BADGE
   ========================================================= */

async function updateSyncBadge() {

  try {

    const queue =
      await getQueue();


    const badge =
      document.getElementById(
        "syncBadge"
      );


    if (!badge) return;


    if (queue.length > 0) {

      badge.textContent =
        queue.length;

      badge.style.display =
        "inline-block";

    } else {

      badge.style.display =
        "none";

    }

  } catch (error) {

    console.warn(
      "updateSyncBadge:",
      error
    );

  }

}


/* =========================================================
   SAVE OR QUEUE
   ========================================================= */

async function saveOrQueue(
  action,
  payload
) {

  if (navigator.onLine) {

    try {

      const res =
        await gasRequest(
          action,
          payload
        );


      showToast(
        "✅ Berhasil disimpan"
      );


      await loadAppData();


      return res;

    } catch (err) {

      console.warn(
        "Gagal simpan online. Masuk antrean:",
        err
      );


      await addToQueue(
        action,
        payload
      );


      showToast(
        "⚠️ Disimpan offline — akan disinkronkan"
      );


      return {
        success: true,
        offline: true
      };

    }

  } else {

    await addToQueue(
      action,
      payload
    );


    showToast(
      "📁 Disimpan di perangkat (Offline)"
    );


    return {
      success: true,
      offline: true
    };

  }

}


/* =========================================================
   SYNC OFFLINE
   ========================================================= */

async function syncOffline() {

  if (
    syncRunning ||
    !navigator.onLine
  ) {

    return;

  }


  syncRunning = true;


  try {

    const queue =
      await getQueue();


    if (!queue.length) {

      setSyncText(
        "Online — Data Terkini"
      );


      syncRunning = false;

      return;

    }


    setSyncText(
      "Menyinkronkan " +
      queue.length +
      " data..."
    );


    for (
      const item of queue
    ) {

      if (!item.action) {

        console.warn(
          "Antrean tanpa action:",
          item.id
        );


        await removeFromQueue(
          item.id
        );


        continue;

      }


      try {

        await gasRequest(
          item.action,
          item.payload
        );


        await removeFromQueue(
          item.id
        );


      } catch (error) {

        console.error(
          "Gagal sinkron ID:",
          item.id,
          error
        );


        break;

      }

    }


    const remainingQueue =
      await getQueue();


    if (
      remainingQueue.length > 0
    ) {

      setSyncText(
        "⚠️ " +
        remainingQueue.length +
        " data tertunda"
      );

    } else {

      await loadAppData();

      setSyncText(
        "Online — Data Terkini"
      );

      showToast(
        "🔄 Sinkronisasi selesai"
      );

    }

  } catch (error) {

    console.error(
      "Sync error:",
      error
    );


    setSyncText(
      "Gagal sinkronisasi"
    );

  } finally {

    syncRunning = false;

  }

}


/* =========================================================
   GAS REQUEST
   ========================================================= */

function normalizeAppData(data) {

  data = data || {};


  return {

    dashboard:
      data.dashboard || {},

    kategori:
      Array.isArray(
        data.kategori
      )
        ? data.kategori
        : [],

    barang:
      Array.isArray(
        data.barang
      )
        ? data.barang
        : [],

    history:
      Array.isArray(
        data.history
      )
        ? data.history
        : [],

    hutang:
      Array.isArray(
        data.hutang
      )
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


  let url = GAS_URL;


  const query =
    new URLSearchParams();


  Object.keys(data).forEach(
    function (key) {

      if (
        data[key] !== undefined &&
        data[key] !== null
      ) {

        query.append(
          key,
          String(data[key])
        );

      }

    }
  );


  url +=
    "?" +
    query.toString();


  const response =
    await fetch(
      url,
      {
        method: "GET",
        redirect: "follow",
        cache: "no-store"
      }
    );


  if (!response.ok) {

    throw new Error(
      "HTTP " +
      response.status +
      " " +
      response.statusText
    );

  }


  const text =
    await response.text();


  if (!text) {

    throw new Error(
      "GAS tidak mengirim response"
    );

  }


  let result;


  try {

    result =
      JSON.parse(text);

  } catch (e) {

    console.error(
      "Response GAS:",
      text
    );


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


    await updateSyncBadge();

  } catch (error) {

    console.error(
      "loadAppData error:",
      error
    );


    setSyncText(
      "Gagal terhubung — data lokal digunakan"
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


/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

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
      .map(transactionHTML)
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


  const categories =
    Array.isArray(
      appData.kategori
    )
      ? appData.kategori
      : [];


  categories.forEach(
    function (item) {

      let nama =
        typeof item === "string"
          ? item
          : (
              item.nama ||
              item.kategori ||
              item.name ||
              ""
            );


      let jenis =
        typeof item === "object"
          ? String(
              item.jenis ||
              item.type ||
              ""
            ).toUpperCase()
          : "";


      if (!nama) return;


      if (
        jenis &&
        jenis !== transactionType &&
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

function setTransactionType(
  type
) {

  transactionType =
    String(
      type ||
      "PEMASUKAN"
    ).toUpperCase();


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


/* =========================================================
   QUICK TRANSACTION
   ========================================================= */

function quickTransaction(
  type
) {

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


  if (
    !currentBarangList.length
  ) {

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
      .map(barangHTML)
      .join("");

}


/* =========================================================
   BARANG HTML
   ========================================================= */

function barangHTML(item) {

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
    <div class="form-card"
      style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
      ">

      <div style="min-width:0;">

        <strong
          style="
            font-size:15px;
            display:block;
          "
        >
          ${escapeHTML(nama)}
        </strong>

        <div
          class="small"
          style="margin-top:5px;"
        >
          Stok:
          <strong>
            ${formatNumber(stok)}
          </strong>
        </div>

        <div
          class="small"
          style="margin-top:3px;"
        >
          Modal:
          <strong>
            ${rupiah(modal)}
          </strong>
        </div>

      </div>


      <div style="text-align:right;">

        <div class="small">
          Harga Jual
        </div>

        <strong
          style="
            display:block;
            color:#2563eb;
            margin-top:4px;
          "
        >
          ${rupiah(jual)}
        </strong>

      </div>

    </div>
  `;

}


/* =========================================================
   FILTER BARANG
   ========================================================= */

function filterBarang(
  keyword
) {

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
          ).toLowerCase();


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


  const populateSelect =
    function (selectEl) {

      if (!selectEl) return;


      const old =
        selectEl.value;


      let html =
        `<option value="">
          Pilih barang
        </option>`;


      list.forEach(
        function (
          item,
          index
        ) {

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


          html +=
            `<option value="${escapeAttr(id)}">
              ${escapeHTML(nama)}
            </option>`;

        }
      );


      selectEl.innerHTML =
        html;


      if (old) {

        selectEl.value =
          old;

      }

    };


  populateSelect(jual);

  populateSelect(belanja);

}


/* =========================================================
   FIND BARANG
   ========================================================= */

function findBarang(id) {

  return appData.barang.find(
    function (
      item,
      index
    ) {

      const itemId =
        item.id ||
        item.ID ||
        item.kode ||
        index;


      return (
        String(itemId) ===
        String(id)
      );

    }
  );

}


/* =========================================================
   AUTO HARGA JUAL
   ========================================================= */

function autoHargaJual() {

  const id =
    valueOf(
      "jualBarang"
    );


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


  if (
    input &&
    harga > 0
  ) {

    input.value =
      harga;

  }


  updateJualTotal();

}


/* =========================================================
   AUTO HARGA MODAL
   ========================================================= */

function autoHargaModal() {

  const id =
    valueOf(
      "belanjaBarang"
    );


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


  if (
    input &&
    harga > 0
  ) {

    input.value =
      harga;

  }


  updateBelanjaTotal();

}


/* =========================================================
   TOTAL JUAL
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


/* =========================================================
   TOTAL BELANJA
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


/* =========================================================
   HISTORY
   ========================================================= */

function renderHistory() {

  const container =
    document.getElementById(
      "historyList"
    );


  if (!container) return;


  currentHistoryList =
    Array.isArray(
      appData.history
    )
      ? appData.history
      : [];


  if (
    !currentHistoryList.length
  ) {

    container.innerHTML =
      `<div class="empty">
        Belum ada histori transaksi.
      </div>`;

    return;

  }


  container.innerHTML =
    currentHistoryList
      .map(transactionHTML)
      .join("");

}


/* =========================================================
   TRANSACTION HTML
   ========================================================= */

function transactionHTML(item) {

  const jenis =
    String(
      item.jenis ||
      item.type ||
      "PEMASUKAN"
    ).toUpperCase();


  const isIncome =
    jenis === "PEMASUKAN" ||
    jenis === "PENJUALAN";


  const nominal =
    numberValue(
      item.nominal ||
      item.total ||
      item.jumlah
    );


  return `
    <div
      class="form-card"
      style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
      "
    >

      <div>

        <strong>
          ${escapeHTML(
            item.keterangan ||
            item.kategori ||
            "Transaksi"
          )}
        </strong>

        <div
          class="small"
          style="
            color:#666;
            margin-top:3px;
          "
        >
          ${escapeHTML(
            item.tanggal || ""
          )}
          —
          ${escapeHTML(
            item.kategori || ""
          )}
        </div>

      </div>


      <div style="text-align:right;">

        <span
          style="
            font-weight:bold;
            color:${
              isIncome
                ? "#16a34a"
                : "#dc2626"
            };
          "
        >
          ${isIncome ? "+" : "-"}
          ${rupiah(nominal)}
        </span>

      </div>

    </div>
  `;

}


/* =========================================================
   HUTANG
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
        Tidak ada catatan hutang/piutang.
      </div>`;

    return;

  }


  container.innerHTML =
    list.map(
      function (item) {

        return `
          <div
            class="form-card"
            style="
              display:flex;
              justify-content:space-between;
              align-items:center;
            "
          >

            <div>

              <strong>
                ${escapeHTML(
                  item.nama ||
                  item.kontak ||
                  "Tanpa Nama"
                )}
              </strong>

              <div class="small">
                ${escapeHTML(
                  item.keterangan ||
                  ""
                )}
              </div>

            </div>


            <div
              style="text-align:right;"
            >

              <strong
                style="color:#dc2626;"
              >
                ${rupiah(
                  numberValue(
                    item.nominal
                  )
                )}
              </strong>

            </div>

          </div>
        `;

      }
    ).join("");

}


/* =========================================================
   SUBMIT TRANSACTION
   ========================================================= */

async function submitTransaction(
  event
) {

  event.preventDefault();


  const tanggal =
    valueOf(
      "trxTanggal"
    );


  const kategori =
    valueOf(
      "trxKategori"
    );


  const keterangan =
    valueOf(
      "trxKeterangan"
    );


  const nominal =
    numberValue(
      valueOf(
        "trxNominal"
      )
    );


  const rekening =
    valueOf(
      "trxRekening"
    ) ||
    "Kas";


  if (
    !tanggal ||
    !kategori ||
    !keterangan ||
    nominal <= 0
  ) {

    showToast(
      "Isi semua data transaksi dengan benar"
    );

    return;

  }


  const payload = {

    tanggal,

    jenis:
      transactionType,

    kategori,

    keterangan,

    nominal,

    rekening

  };


  const button =
    event.submitter ||
    event.target.querySelector(
      'button[type="submit"]'
    );


  if (button) {

    button.disabled = true;

    button.dataset.oldText =
      button.textContent;

    button.textContent =
      "Menyimpan...";

  }


  try {

    await saveOrQueue(
      "tambahTransaksi",
      payload
    );


    event.target.reset();


    const dateInput =
      document.getElementById(
        "trxTanggal"
      );


    if (dateInput) {

      dateInput.value =
        getLocalDate();

    }


    setTransactionType(
      transactionType
    );

  } catch (err) {

    showToast(
      "❌ " +
      (
        err.message ||
        "Gagal menyimpan"
      )
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        button.dataset.oldText ||
        "Simpan";

    }

  }

}


/* =========================================================
   SUBMIT BARANG
   ========================================================= */

async function submitBarang(
  event
) {

  event.preventDefault();


  const nama =
    valueOf(
      "barangNama"
    );


  const modal =
    numberValue(
      valueOf(
        "barangHargaModal"
      )
    );


  const jual =
    numberValue(
      valueOf(
        "barangHargaJual"
      )
    );


  const stok =
    numberValue(
      valueOf(
        "barangStokAwal"
      )
    );


  if (!nama) {

    showToast(
      "Nama barang harus diisi"
    );

    return;

  }


  const payload = {

    nama,

    hargaModal:
      modal,

    hargaJual:
      jual,

    stok

  };


  const button =
    event.submitter ||
    event.target.querySelector(
      'button[type="submit"]'
    );


  if (button) {

    button.disabled = true;

    button.dataset.oldText =
      button.textContent;

    button.textContent =
      "Menyimpan...";

  }


  try {

    await saveOrQueue(
      "tambahBarang",
      payload
    );


    event.target.reset();


    closeModal(
      "barangModal"
    );

  } catch (err) {

    showToast(
      "❌ " +
      (
        err.message ||
        "Gagal menambah barang"
      )
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        button.dataset.oldText ||
        "Simpan Barang";

    }

  }

}


/* =========================================================
   SUBMIT PENJUALAN
   ========================================================= */

async function submitPenjualan(
  event
) {

  event.preventDefault();


  const barang =
    valueOf(
      "jualBarang"
    );


  const qty =
    numberValue(
      valueOf(
        "jualQty"
      )
    );


  const harga =
    numberValue(
      valueOf(
        "jualHarga"
      )
    );


  const pelanggan =
    valueOf(
      "jualPelanggan"
    ) ||
    "Umum";


  if (
    !barang ||
    qty <= 0 ||
    harga <= 0
  ) {

    showToast(
      "Lengkapi data penjualan"
    );

    return;

  }


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
      qty * harga,

    pelanggan:
      pelanggan

  };


  const button =
    event.submitter ||
    event.target.querySelector(
      'button[type="submit"]'
    );


  if (button) {

    button.disabled = true;

    button.dataset.oldText =
      button.textContent;

    button.textContent =
      "Menyimpan...";

  }


  try {

    await saveOrQueue(
      "tambahPenjualan",
      payload
    );


    event.target.reset();


    setText(
      "jualTotalPreview",
      "Rp 0"
    );

  } catch (error) {

    console.error(
      "submitPenjualan:",
      error
    );


    showToast(
      "❌ Gagal menyimpan penjualan"
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        button.dataset.oldText ||
        "Simpan";

    }

  }

}


/* =========================================================
   SUBMIT BELANJA
   ========================================================= */

async function submitBelanja(
  event
) {

  event.preventDefault();


  const barang =
    valueOf(
      "belanjaBarang"
    );


  const qty =
    numberValue(
      valueOf(
        "belanjaQty"
      )
    );


  const harga =
    numberValue(
      valueOf(
        "belanjaHarga"
      )
    );


  const supplier =
    valueOf(
      "belanjaSupplier"
    ) ||
    "";


  if (
    !barang ||
    qty <= 0 ||
    harga <= 0
  ) {

    showToast(
      "Lengkapi data belanja"
    );

    return;

  }


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
      qty * harga,

    supplier:
      supplier

  };


  const button =
    event.submitter ||
    event.target.querySelector(
      'button[type="submit"]'
    );


  if (button) {

    button.disabled = true;

    button.dataset.oldText =
      button.textContent;

    button.textContent =
      "Menyimpan...";

  }


  try {

    await saveOrQueue(
      "tambahBelanja",
      payload
    );


    event.target.reset();


    setText(
      "belanjaTotalPreview",
      "Rp 0"
    );

  } catch (error) {

    console.error(
      "submitBelanja:",
      error
    );


    showToast(
      "❌ Gagal menyimpan belanja"
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        button.dataset.oldText ||
        "Simpan";

    }

  }

}


/* =========================================================
   SUBMIT HUTANG
   ========================================================= */

async function submitHutang(
  event
) {

  event.preventDefault();


  const nama =
    valueOf(
      "hutangNama"
    );


  const nominal =
    numberValue(
      valueOf(
        "hutangNominal"
      )
    );


  const keterangan =
    valueOf(
      "hutangKeterangan"
    );


  if (
    !nama ||
    nominal <= 0
  ) {

    showToast(
      "Lengkapi data hutang/piutang"
    );

    return;

  }


  const payload = {

    nama,

    nominal,

    keterangan,

    tanggal:
      getLocalDate()

  };


  const button =
    event.submitter ||
    event.target.querySelector(
      'button[type="submit"]'
    );


  if (button) {

    button.disabled = true;

    button.dataset.oldText =
      button.textContent;

    button.textContent =
      "Menyimpan...";

  }


  try {

    await saveOrQueue(
      "tambahHutang",
      payload
    );


    event.target.reset();


    closeModal(
      "hutangModal"
    );

  } catch (err) {

    showToast(
      "❌ " +
      (
        err.message ||
        "Gagal menyimpan hutang"
      )
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        button.dataset.oldText ||
        "Simpan";

    }

  }

}


/* =========================================================
   UI HELPERS
   ========================================================= */

function showPage(
  pageId
) {

  const pages =
    document.querySelectorAll(
      ".page"
    );


  pages.forEach(
    function (p) {

      p.classList.remove(
        "active"
      );

    }
  );


  const targetPage =
    document.getElementById(
      pageId + "Page"
    );


  if (targetPage) {

    targetPage.classList.add(
      "active"
    );

  }


  const navs =
    document.querySelectorAll(
      ".nav-item"
    );


  navs.forEach(
    function (n) {

      n.classList.remove(
        "active"
      );

    }
  );


  const targetNav =
    document.querySelector(
      `.nav-item[onclick*="${pageId}"]`
    );


  if (targetNav) {

    targetNav.classList.add(
      "active"
    );

  }


  window.scrollTo(
    0,
    0
  );

}


/* =========================================================
   MODAL
   ========================================================= */

function openModal(
  id
) {

  const modal =
    document.getElementById(
      id
    );


  if (modal) {

    modal.style.display =
      "flex";

  }

}


function closeModal(
  id
) {

  const modal =
    document.getElementById(
      id
    );


  if (modal) {

    modal.style.display =
      "none";

  }

}


/* =========================================================
   MORE MENU
   ========================================================= */

function toggleMoreMenu() {

  const menu =
    document.getElementById(
      "moreMenu"
    );


  if (!menu) return;


  menu.style.display =
    menu.style.display ===
    "block"
      ? "none"
      : "block";

}


function closeMoreMenu() {

  const menu =
    document.getElementById(
      "moreMenu"
    );


  if (menu) {

    menu.style.display =
      "none";

  }

}


/* =========================================================
   QUICK ADD
   ========================================================= */

function toggleQuickAdd() {

  const menu =
    document.getElementById(
      "quickAddMenu"
    );


  if (!menu) return;


  menu.style.display =
    menu.style.display ===
    "block"
      ? "none"
      : "block";

}


function closeQuickAdd() {

  const menu =
    document.getElementById(
      "quickAddMenu"
    );


  if (menu) {

    menu.style.display =
      "none";

  }

}


/* =========================================================
   ONLINE STATUS
   ========================================================= */

function updateOnlineStatus() {

  const statusEl =
    document.getElementById(
      "onlineStatus"
    );


  if (!statusEl) return;


  if (navigator.onLine) {

    statusEl.textContent =
      "Online";


    statusEl.className =
      "status-badge online";

  } else {

    statusEl.textContent =
      "Offline";


    statusEl.className =
      "status-badge offline";

  }

}


/* =========================================================
   SYNC TEXT
   ========================================================= */

function setSyncText(
  text
) {

  const el =
    document.getElementById(
      "syncStatusText"
    );


  if (el) {

    el.textContent =
      text;

  }

}


/* =========================================================
   LOADING
   ========================================================= */

function hideLoading() {

  const loader =
    document.getElementById(
      "appLoader"
    );


  if (loader) {

    loader.style.display =
      "none";

  }

}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
  message
) {

  let toast =
    document.getElementById(
      "toast"
    );


  if (!toast) {

    toast =
      document.createElement(
        "div"
      );


    toast.id =
      "toast";


    toast.className =
      "toast";


    document.body.appendChild(
      toast
    );

  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  if (toastTimer) {

    clearTimeout(
      toastTimer
    );

  }


  toastTimer =
    setTimeout(
      function () {

        toast.classList.remove(
          "show"
        );

      },
      3000
    );

}


/* =========================================================
   VALUE HELPERS
   ========================================================= */

function valueOf(
  id
) {

  const el =
    document.getElementById(
      id
    );


  return el
    ? el.value.trim()
    : "";

}


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(
  id,
  text
) {

  const el =
    document.getElementById(
      id
    );


  if (el) {

    el.textContent =
      text;

  }

}


/* =========================================================
   NUMBER
   ========================================================= */

function numberValue(
  val
) {

  if (
    typeof val ===
    "number"
  ) {

    return isNaN(val)
      ? 0
      : val;

  }


  if (!val) {

    return 0;

  }


  const cleaned =
    String(val)
      .replace(
        /[^0-9.-]/g,
        ""
      );


  const num =
    parseFloat(
      cleaned
    );


  return isNaN(num)
    ? 0
    : num;

}


/* =========================================================
   RUPIAH
   ========================================================= */

function rupiah(
  num
) {

  return (
    "Rp " +
    numberValue(num)
      .toLocaleString(
        "id-ID"
      )
  );

}


/* =========================================================
   FORMAT NUMBER
   ========================================================= */

function formatNumber(
  num
) {

  return numberValue(num)
    .toLocaleString(
      "id-ID"
    );

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(
  str
) {

  return String(
    str || ""
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
   ESCAPE ATTRIBUTE
   ========================================================= */

function escapeAttr(
  str
) {

  return String(
    str || ""
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
   GLOBAL DEBUG
   ========================================================= */

window.CatatKu = {

  getDB: function () {
    return db;
  },

  getAppData: function () {
    return appData;
  },

  getQueue: async function () {
    return await getQueue();
  },

  sync: async function () {
    return await syncOffline();
  },

  reload: async function () {
    return await loadAppData();
  },

  repairDB: async function () {

    try {

      if (db) {

        try {
          db.close();
        } catch (e) {}

      }

      db = null;

      await deleteDatabase();

      await openDatabase();

      showToast(
        "✅ Database diperbaiki"
      );

      await updateSyncBadge();

      return true;

    } catch (error) {

      console.error(
        "Repair DB gagal:",
        error
      );

      return false;

    }

  }

};

console.log(
  "CatatKu app.js aktif — IndexedDB v" +
  DB_VERSION
);
