/* =========================================================
   CATATKU
   app.js
   FRONTEND PWA
   GAS + INDEXEDDB
   OFFLINE FIRST + AUTO SYNC
   ========================================================= */

"use strict";

/* =========================================================
   KONFIGURASI GAS BARU
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzEyUC9gtpQ3vZG0mvz0RTx0zFAPEWAk3DGE-E8qEwslG0y1ELCJxdj6yZx1dA1zDha/exec";

/* =========================================================
   INDEXED DB
   ========================================================= */

const DB_NAME = "CatatKuDB";
const DB_VERSION = 2;

const STORE_DATA = "appData";
const STORE_QUEUE = "offlineQueue";

/* =========================================================
   STATE
   ========================================================= */

const state = {
  dashboard: {},
  kategori: {},
  barang: [],
  history: [],
  hutang: [],

  currentType: "PEMASUKAN",

  online: navigator.onLine,
  syncing: false,
  loading: false,

  barangSearch: "",
  historySearch: ""
};

let dbInstance = null;
let toastTimer = null;

/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {

  try {

    setTodayDefaults();
    setupForms();
    setupCalculations();
    updateConnectionStatus();

    await initDB();

    await loadLocalData();

    renderAll();

    hideLoading();

    if (navigator.onLine) {

      setSyncText("Menghubungkan ke server...");

      refreshApp();

    } else {

      setSyncText(
        "Offline — menggunakan data lokal"
      );

    }

  } catch (error) {

    console.error("INIT ERROR:", error);

    hideLoading();

    renderAll();

    setSyncText(
      "Aplikasi siap — mode lokal"
    );

  }

  /* =======================================================
     ONLINE
     ======================================================= */

  window.addEventListener(
    "online",
    async function () {

      state.online = true;

      updateConnectionStatus();

      setSyncText(
        "Koneksi kembali..."
      );

      await syncOffline();

      await refreshApp();

    }
  );

  /* =======================================================
     OFFLINE
     ======================================================= */

  window.addEventListener(
    "offline",
    function () {

      state.online = false;

      updateConnectionStatus();

      setSyncText(
        "Offline — transaksi disimpan di HP"
      );

    }
  );

  /* =======================================================
     AUTO SYNC
     ======================================================= */

  setInterval(
    async function () {

      if (
        navigator.onLine &&
        !state.syncing
      ) {

        const count =
          await queueCount();

        if (count > 0) {

          await syncOffline();

        }

      }

    },
    30000
  );

}

/* =========================================================
   SETUP FORM
   ========================================================= */

function setupForms() {

  const transactionForm =
    document.getElementById(
      "transactionForm"
    );

  if (transactionForm) {

    transactionForm.addEventListener(
      "submit",
      saveTransaction
    );

  }

  const barangForm =
    document.getElementById(
      "barangForm"
    );

  if (barangForm) {

    barangForm.addEventListener(
      "submit",
      saveBarang
    );

  }

  const penjualanForm =
    document.getElementById(
      "penjualanForm"
    );

  if (penjualanForm) {

    penjualanForm.addEventListener(
      "submit",
      savePenjualan
    );

  }

  const belanjaForm =
    document.getElementById(
      "belanjaForm"
    );

  if (belanjaForm) {

    belanjaForm.addEventListener(
      "submit",
      saveBelanja
    );

  }

  const hutangForm =
    document.getElementById(
      "hutangForm"
    );

  if (hutangForm) {

    hutangForm.addEventListener(
      "submit",
      saveHutang
    );

  }

  const jualBarang =
    document.getElementById(
      "jualBarang"
    );

  if (jualBarang) {

    jualBarang.addEventListener(
      "change",
      function () {

        const id =
          jualBarang.value;

        const barang =
          state.barang.find(
            b =>
              String(b.id) ===
              String(id)
          );

        if (barang) {

          const harga =
            document.getElementById(
              "jualHarga"
            );

          if (harga) {

            harga.value =
              Number(
                barang.jual || 0
              );

          }

        }

        updateJualTotal();

      }
    );

  }

}

/* =========================================================
   CALCULATIONS
   ========================================================= */

function setupCalculations() {

  [
    "jualQty",
    "jualHarga"
  ].forEach(
    id => {

      const el =
        document.getElementById(id);

      if (el) {

        el.addEventListener(
          "input",
          updateJualTotal
        );

      }

    }
  );

  [
    "belanjaQty",
    "belanjaHarga"
  ].forEach(
    id => {

      const el =
        document.getElementById(id);

      if (el) {

        el.addEventListener(
          "input",
          updateBelanjaTotal
        );

      }

    }
  );

}

function updateJualTotal() {

  const qty =
    Number(
      value("jualQty")
    );

  const harga =
    Number(
      value("jualHarga")
    );

  const total =
    qty * harga;

  setText(
    "jualTotalPreview",
    rupiah(total)
  );

}

function updateBelanjaTotal() {

  const qty =
    Number(
      value("belanjaQty")
    );

  const harga =
    Number(
      value("belanjaHarga")
    );

  const total =
    qty * harga;

  setText(
    "belanjaTotalPreview",
    rupiah(total)
  );

}

/* =========================================================
   DATE
   ========================================================= */

function today() {

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

function dateInput(d) {

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

function setTodayDefaults() {

  const date = today();

  const trxTanggal =
    document.getElementById(
      "trxTanggal"
    );

  if (trxTanggal) {

    trxTanggal.value = date;

  }

  const start =
    document.getElementById(
      "reportStart"
    );

  const end =
    document.getElementById(
      "reportEnd"
    );

  if (start && !start.value) {

    const d =
      new Date();

    d.setDate(
      d.getDate() - 30
    );

    start.value =
      dateInput(d);

  }

  if (end && !end.value) {

    end.value =
      date;

  }

}

/* =========================================================
   API GET
   ========================================================= */

async function apiGet(
  action,
  params = {}
) {

  const url =
    new URL(GAS_URL);

  url.searchParams.set(
    "action",
    action
  );

  Object.keys(params).forEach(
    key => {

      const val =
        params[key];

      if (
        val !== undefined &&
        val !== null
      ) {

        url.searchParams.set(
          key,
          String(val)
        );

      }

    }
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      }
    );

  if (!response.ok) {

    throw new Error(
      "HTTP " +
      response.status
    );

  }

  const text =
    await response.text();

  if (!text) {

    throw new Error(
      "GAS mengembalikan response kosong"
    );

  }

  let json;

  try {

    json =
      JSON.parse(text);

  } catch (error) {

    console.error(
      "GAS RESPONSE:",
      text
    );

    throw new Error(
      "Response GAS bukan JSON"
    );

  }

  if (
    json &&
    json.success === false
  ) {

    throw new Error(
      json.error ||
      "GAS Error"
    );

  }

  return json;

}

/* =========================================================
   API POST
   ========================================================= */

async function apiPost(
  action,
  data = {}
) {

  const payload = {
    action,
    ...data
  };

  const body =
    new URLSearchParams();

  body.set(
    "payload",
    JSON.stringify(payload)
  );

  const response =
    await fetch(
      GAS_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8"
        },

        body:
          body.toString(),

        cache:
          "no-store",

        redirect:
          "follow"
      }
    );

  if (!response.ok) {

    throw new Error(
      "HTTP " +
      response.status
    );

  }

  const text =
    await response.text();

  if (!text) {

    throw new Error(
      "Response GAS kosong"
    );

  }

  let json;

  try {

    json =
      JSON.parse(text);

  } catch (error) {

    console.error(
      "GAS POST RESPONSE:",
      text
    );

    throw new Error(
      "Response GAS bukan JSON"
    );

  }

  if (
    json &&
    json.success === false
  ) {

    throw new Error(
      json.error ||
      "GAS Error"
    );

  }

  return json;

}

/* =========================================================
   LOAD REMOTE
   ========================================================= */

async function loadRemoteAppData() {

  const result =
    await apiGet(
      "appData"
    );

  const data =
    normalizeAppData(result);

  applyAppData(data);

  await saveLocalData(data);

  renderAll();

  return data;

}

/* =========================================================
   NORMALIZE DATA
   ========================================================= */

function normalizeAppData(result) {

  if (!result) {

    return {
      dashboard: {},
      kategori: {},
      barang: [],
      history: [],
      hutang: []
    };

  }

  let source =
    result;

  if (
    result.appData &&
    typeof result.appData === "object"
  ) {

    source =
      result.appData;

  }

  if (
    source.data &&
    typeof source.data === "object"
  ) {

    source =
      source.data;

  }

  return {

    dashboard:
      source.dashboard ||
      {},

    kategori:
      source.kategori ||
      {},

    barang:
      Array.isArray(
        source.barang
      )
        ? source.barang
        : [],

    history:
      Array.isArray(
        source.history
      )
        ? source.history
        : [],

    hutang:
      Array.isArray(
        source.hutang
      )
        ? source.hutang
        : []

  };

}

/* =========================================================
   APPLY DATA
   ========================================================= */

function applyAppData(result) {

  const data =
    normalizeAppData(result);

  state.dashboard =
    data.dashboard;

  state.kategori =
    data.kategori;

  state.barang =
    data.barang;

  state.history =
    data.history;

  state.hutang =
    data.hutang;

}

/* =========================================================
   REFRESH
   ========================================================= */

async function refreshApp() {

  if (state.loading) {

    return;

  }

  if (!navigator.onLine) {

    renderAll();

    hideLoading();

    setSyncText(
      "Offline — data lokal"
    );

    return;

  }

  state.loading = true;

  try {

    setSyncText(
      "Menyiapkan data..."
    );

    await loadRemoteAppData();

    hideLoading();

    await updateSyncBadge();

    setSyncText(
      "Data tersinkron"
    );

  } catch (error) {

    console.error(
      "REFRESH ERROR:",
      error
    );

    hideLoading();

    renderAll();

    setSyncText(
      "Server tidak tersedia — data lokal digunakan"
    );

  } finally {

    state.loading = false;

  }

}

/* =========================================================
   LOCAL DATA
   ========================================================= */

async function loadLocalData() {

  try {

    const record =
      await dbGet(
        STORE_DATA,
        "main"
      );

    if (record) {

      applyAppData(
        record
      );

    }

  } catch (error) {

    console.error(
      "LOCAL LOAD:",
      error
    );

  }

}

async function saveLocalData(data) {

  await dbPut(
    STORE_DATA,
    {
      key: "main",

      dashboard:
        data.dashboard || {},

      kategori:
        data.kategori || {},

      barang:
        data.barang || [],

      history:
        data.history || [],

      hutang:
        data.hutang || [],

      savedAt:
        Date.now()
    }
  );

}

/* =========================================================
   INDEXED DB
   ========================================================= */

function initDB() {

  return new Promise(
    (resolve, reject) => {

      if (dbInstance) {

        resolve(
          dbInstance
        );

        return;

      }

      if (
        !window.indexedDB
      ) {

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
        function(event) {

          const db =
            event.target.result;

          if (
            !db.objectStoreNames.contains(
              STORE_DATA
            )
          ) {

            db.createObjectStore(
              STORE_DATA,
              {
                keyPath: "key"
              }
            );

          }

          if (
            !db.objectStoreNames.contains(
              STORE_QUEUE
            )
          ) {

            const store =
              db.createObjectStore(
                STORE_QUEUE,
                {
                  keyPath:
                    "queueId"
                }
              );

            store.createIndex(
              "createdAt",
              "createdAt",
              {
                unique: false
              }
            );

          }

        };

      request.onsuccess =
        function(event) {

          dbInstance =
            event.target.result;

          dbInstance.onversionchange =
            function() {

              dbInstance.close();

            };

          resolve(
            dbInstance
          );

        };

      request.onerror =
        function() {

          reject(
            request.error
          );

        };

    }
  );

}

/* =========================================================
   DB PUT
   ========================================================= */

function dbPut(
  storeName,
  value
) {

  return new Promise(
    (resolve, reject) => {

      if (!dbInstance) {

        reject(
          new Error(
            "Database belum siap"
          )
        );

        return;

      }

      const tx =
        dbInstance.transaction(
          storeName,
          "readwrite"
        );

      const store =
        tx.objectStore(
          storeName
        );

      const request =
        store.put(value);

      request.onsuccess =
        () =>
          resolve(
            request.result
          );

      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}

/* =========================================================
   DB GET
   ========================================================= */

function dbGet(
  storeName,
  key
) {

  return new Promise(
    (resolve, reject) => {

      if (!dbInstance) {

        resolve(null);

        return;

      }

      const tx =
        dbInstance.transaction(
          storeName,
          "readonly"
        );

      const request =
        tx.objectStore(
          storeName
        ).get(key);

      request.onsuccess =
        () =>
          resolve(
            request.result ||
            null
          );

      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}

/* =========================================================
   DB DELETE
   ========================================================= */

function dbDelete(
  storeName,
  key
) {

  return new Promise(
    (resolve, reject) => {

      if (!dbInstance) {

        resolve();

        return;

      }

      const tx =
        dbInstance.transaction(
          storeName,
          "readwrite"
        );

      const request =
        tx.objectStore(
          storeName
        ).delete(key);

      request.onsuccess =
        () => resolve();

      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}

/* =========================================================
   DB ALL
   ========================================================= */

function dbGetAll(
  storeName
) {

  return new Promise(
    (resolve, reject) => {

      if (!dbInstance) {

        resolve([]);

        return;

      }

      const tx =
        dbInstance.transaction(
          storeName,
          "readonly"
        );

      const request =
        tx.objectStore(
          storeName
        ).getAll();

      request.onsuccess =
        () =>
          resolve(
            request.result || []
          );

      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}

/* =========================================================
   OFFLINE QUEUE
   ========================================================= */

async function addToQueue(
  action,
  data
) {

  const queueId =
    data.id ||
    makeLocalId(
      action
    );

  const item = {

    queueId,

    action,

    data: {
      ...data
    },

    createdAt:
      Date.now(),

    attempts:
      0

  };

  await dbPut(
    STORE_QUEUE,
    item
  );

  await updateSyncBadge();

  return queueId;

}

async function queueCount() {

  const items =
    await dbGetAll(
      STORE_QUEUE
    );

  return items.length;

}

/* =========================================================
   SYNC BADGE
   ========================================================= */

async function updateSyncBadge() {

  const badge =
    document.getElementById(
      "syncBadge"
    );

  const count =
    await queueCount();

  if (!badge) return;

  badge.textContent =
    String(count);

  badge.classList.toggle(
    "hidden",
    count <= 0
  );

}

/* =========================================================
   SYNC
   ========================================================= */

async function syncOffline() {

  if (state.syncing) {

    return;

  }

  if (!navigator.onLine) {

    setSyncText(
      "Offline — menunggu koneksi"
    );

    return;

  }

  const items =
    await dbGetAll(
      STORE_QUEUE
    );

  if (!items.length) {

    await updateSyncBadge();

    return;

  }

  state.syncing = true;

  setSyncText(
    "Sinkronisasi " +
    items.length +
    " transaksi..."
  );

  try {

    /*
     * Kirim SATU-SATU.
     *
     * Ini sengaja dibuat lebih aman
     * agar bila satu transaksi gagal,
     * transaksi lain tidak ikut gagal.
     */

    for (
      const item of items
    ) {

      try {

        const result =
          await apiPost(
            item.action,
            item.data
          );

        console.log(
          "SYNC OK:",
          item.queueId,
          result
        );

        /*
         * Berhasil → hapus antrean.
         */

        await dbDelete(
          STORE_QUEUE,
          item.queueId
        );

      } catch (error) {

        console.error(
          "SYNC FAILED:",
          item,
          error
        );

        /*
         * Naikkan attempts.
         */

        item.attempts =
          Number(
            item.attempts || 0
          ) + 1;

        item.lastError =
          error.message;

        item.lastAttempt =
          Date.now();

        await dbPut(
          STORE_QUEUE,
          item
        );

      }

    }

    await updateSyncBadge();

    /*
     * Setelah semua yang berhasil
     * terkirim, ambil data server terbaru.
     */

    const remaining =
      await queueCount();

    if (
      remaining === 0
    ) {

      setSyncText(
        "Sinkronisasi selesai"
      );

      try {

        await loadRemoteAppData();

      } catch (error) {

        console.warn(
          "Refresh setelah sync gagal:",
          error
        );

      }

    } else {

      setSyncText(
        remaining +
        " transaksi menunggu sinkronisasi"
      );

    }

    renderAll();

  } catch (error) {

    console.error(
      "SYNC ERROR:",
      error
    );

    setSyncText(
      "Belum tersinkron — akan dicoba lagi"
    );

  } finally {

    state.syncing =
      false;

    await updateSyncBadge();

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
    value(
      "trxTanggal"
    );

  const kategori =
    value(
      "trxKategori"
    );

  const keterangan =
    value(
      "trxKeterangan"
    );

  const nominal =
    Number(
      value(
        "trxNominal"
      )
    );

  const rekening =
    value(
      "trxRekening"
    ) ||
    "Kas";

  if (!tanggal) {

    showToast(
      "Tanggal wajib diisi"
    );

    return;

  }

  if (!kategori) {

    showToast(
      "Pilih kategori"
    );

    return;

  }

  if (!keterangan) {

    showToast(
      "Keterangan wajib diisi"
    );

    return;

  }

  if (
    nominal <= 0
  ) {

    showToast(
      "Nominal tidak valid"
    );

    return;

  }

  const data = {

    id:
      makeLocalId(
        "TRX"
      ),

    tanggal,

    jenis:
      state.currentType,

    kategori,

    keterangan,

    nominal,

    rekening

  };

  /*
   * Simpan ke IndexedDB dahulu.
   */

  await addToQueue(
    "tambahTransaksi",
    data
  );

  resetTransactionForm();

  showToast(
    navigator.onLine
      ? "Transaksi disimpan"
      : "Transaksi disimpan offline"
  );

  /*
   * Jika online langsung kirim.
   */

  if (navigator.onLine) {

    await syncOffline();

  }

}

/* =========================================================
   SAVE BARANG
   ========================================================= */

async function saveBarang(
  event
) {

  event.preventDefault();

  const nama =
    value(
      "barangNama"
    );

  const modal =
    Number(
      value(
        "barangModalPrice"
      )
    );

  const jual =
    Number(
      value(
        "barangJualPrice"
      )
    );

  const stok =
    Number(
      value(
        "barangStok"
      )
    );

  if (!nama) {

    showToast(
      "Nama barang wajib diisi"
    );

    return;

  }

  if (
    modal < 0 ||
    jual < 0 ||
    stok < 0
  ) {

    showToast(
      "Data barang tidak valid"
    );

    return;

  }

  const data = {

    id:
      makeLocalId(
        "BRG"
      ),

    nama,

    kategori:
      "Lainnya",

    modal,

    jual,

    stok,

    minimum:
      0,

    supplier:
      ""

  };

  await addToQueue(
    "tambahBarang",
    data
  );

  closeModal(
    "barangModal"
  );

  document
    .getElementById(
      "barangForm"
    )
    ?.reset();

  showToast(
    navigator.onLine
      ? "Barang disimpan"
      : "Barang disimpan offline"
  );

  if (navigator.onLine) {

    await syncOffline();

  }

}

/* =========================================================
   SAVE PENJUALAN
   ========================================================= */

async function savePenjualan(
  event
) {

  event.preventDefault();

  const barangId =
    value(
      "jualBarang"
    );

  const qty =
    Number(
      value(
        "jualQty"
      )
    );

  const harga =
    Number(
      value(
        "jualHarga"
      )
    );

  const pelanggan =
    value(
      "jualPelanggan"
    ) ||
    "Umum";

  const barang =
    state.barang.find(
      b =>
        String(b.id) ===
        String(barangId)
    );

  if (!barang) {

    showToast(
      "Pilih barang"
    );

    return;

  }

  if (qty <= 0) {

    showToast(
      "Jumlah tidak valid"
    );

    return;

  }

  if (harga <= 0) {

    showToast(
      "Harga jual tidak valid"
    );

    return;

  }

  if (
    Number(barang.stok || 0) <
    qty
  ) {

    showToast(
      "Stok tidak cukup"
    );

    return;

  }

  const data = {

    id:
      makeLocalId(
        "JUAL"
      ),

    barangId:
      barangId,

    qty,

    harga,

    pelanggan,

    tanggal:
      today()

  };

  await addToQueue(
    "tambahPenjualan",
    data
  );

  /*
   * Optimistic stock.
   */

  barang.stok =
    Number(
      barang.stok || 0
    ) -
    qty;

  renderBarang();

  fillBarangSelects();

  document
    .getElementById(
      "penjualanForm"
    )
    ?.reset();

  const qtyInput =
    document.getElementById(
      "jualQty"
    );

  if (qtyInput) {

    qtyInput.value = 1;

  }

  setText(
    "jualTotalPreview",
    "Rp 0"
  );

  showToast(
    navigator.onLine
      ? "Penjualan disimpan"
      : "Penjualan disimpan offline"
  );

  if (navigator.onLine) {

    await syncOffline();

  }

}

/* =========================================================
   SAVE BELANJA
   ========================================================= */

async function saveBelanja(
  event
) {

  event.preventDefault();

  const barangId =
    value(
      "belanjaBarang"
    );

  const qty =
    Number(
      value(
        "belanjaQty"
      )
    );

  const harga =
    Number(
      value(
        "belanjaHarga"
      )
    );

  const supplier =
    value(
      "belanjaSupplier"
    );

  const barang =
    state.barang.find(
      b =>
        String(b.id) ===
        String(barangId)
    );

  if (!barang) {

    showToast(
      "Pilih barang"
    );

    return;

  }

  if (qty <= 0) {

    showToast(
      "Jumlah tidak valid"
    );

    return;

  }

  if (harga <= 0) {

    showToast(
      "Harga modal tidak valid"
    );

    return;

  }

  const data = {

    id:
      makeLocalId(
        "BELI"
      ),

    barangId,

    qty,

    harga,

    supplier,

    tanggal:
      today()

  };

  await addToQueue(
    "tambahBelanja",
    data
  );

  /*
   * Optimistic update.
   */

  barang.stok =
    Number(
      barang.stok || 0
    ) +
    qty;

  renderBarang();

  fillBarangSelects();

  document
    .getElementById(
      "belanjaForm"
    )
    ?.reset();

  const qtyInput =
    document.getElementById(
      "belanjaQty"
    );

  if (qtyInput) {

    qtyInput.value = 1;

  }

  setText(
    "belanjaTotalPreview",
    "Rp 0"
  );

  showToast(
    navigator.onLine
      ? "Belanja disimpan"
      : "Belanja disimpan offline"
  );

  if (navigator.onLine) {

    await syncOffline();

  }

}

/* =========================================================
   SAVE HUTANG
   ========================================================= */

async function saveHutang(
  event
) {

  event.preventDefault();

  const nama =
    value(
      "hutangNama"
    );

  const nominal =
    Number(
      value(
        "hutangNominal"
      )
    );

  const jatuhTempo =
    value(
      "hutangTempo"
    );

  const keterangan =
    value(
      "hutangKeterangan"
    );

  if (!nama) {

    showToast(
      "Nama / pihak wajib diisi"
    );

    return;

  }

  if (
    nominal <= 0
  ) {

    showToast(
      "Nominal hutang tidak valid"
    );

    return;

  }

  const data = {

    id:
      makeLocalId(
        "HTG"
      ),

    nama,

    nominal,

    jatuhTempo,

    keterangan

  };

  await addToQueue(
    "tambahHutang",
    data
  );

  closeModal(
    "hutangModal"
  );

  document
    .getElementById(
      "hutangForm"
    )
    ?.reset();

  showToast(
    navigator.onLine
      ? "Hutang disimpan"
      : "Hutang disimpan offline"
  );

  if (navigator.onLine) {

    await syncOffline();

  }

}

/* =========================================================
   BAYAR HUTANG
   ========================================================= */

async function bayarHutangPrompt(
  id
) {

  const h =
    state.hutang.find(
      x =>
        String(x.id) ===
        String(id)
    );

  if (!h) {

    showToast(
      "Data hutang tidak ditemukan"
    );

    return;

  }

  const sisa =
    Number(
      h.sisa ??
      h.nominal ??
      0
    );

  const input =
    prompt(
      "Nominal pembayaran:\nSisa " +
      rupiah(sisa),
      sisa
    );

  if (input === null) {

    return;

  }

  const nominal =
    Number(input);

  if (
    nominal <= 0
  ) {

    showToast(
      "Nominal tidak valid"
    );

    return;

  }

  if (
    nominal > sisa
  ) {

    showToast(
      "Pembayaran melebihi sisa hutang"
    );

    return;

  }

  const data = {

    id:
      id,

    nominal

  };

  await addToQueue(
    "bayarHutang",
    data
  );

  showToast(
    navigator.onLine
      ? "Pembayaran disimpan"
      : "Pembayaran disimpan offline"
  );

  if (navigator.onLine) {

    await syncOffline();

  }

}

/* =========================================================
   TRANSACTION TYPE
   ========================================================= */

function setTransactionType(
  type
) {

  state.currentType =
    String(
      type
    ).toUpperCase();

  const income =
    document.getElementById(
      "tabIncome"
    );

  const expense =
    document.getElementById(
      "tabExpense"
    );

  income?.classList.toggle(
    "active",
    state.currentType ===
      "PEMASUKAN"
  );

  expense?.classList.toggle(
    "active",
    state.currentType ===
      "PENGELUARAN"
  );

  renderKategoriSelect();

}

/* =========================================================
   QUICK TRANSACTION
   ========================================================= */

function quickTransaction(
  type
) {

  closeQuickAdd();

  showPage(
    "add"
  );

  setTransactionType(
    type
  );

}

/* =========================================================
   RENDER ALL
   ========================================================= */

function renderAll() {

  renderDashboard();

  renderKategoriSelect();

  renderBarang();

  renderHistory();

  renderHutang();

  fillBarangSelects();

  updateJualTotal();

  updateBelanjaTotal();

  updateConnectionStatus();

}

/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  const d =
    state.dashboard ||
    {};

  setText(
    "saldo",
    rupiah(
      d.saldo || 0
    )
  );

  setText(
    "totalPemasukan",
    rupiah(
      d.pemasukan || 0
    )
  );

  setText(
    "totalPengeluaran",
    rupiah(
      d.pengeluaran || 0
    )
  );

  setText(
    "totalPenjualan",
    rupiah(
      d.penjualan || 0
    )
  );

  setText(
    "totalHutang",
    rupiah(
      d.totalHutang || 0
    )
  );

  const recent =
    document.getElementById(
      "recentTransactions"
    );

  if (!recent) return;

  const list =
    state.history
      .slice()
      .sort(sortNewest)
      .slice(
        0,
        5
      );

  if (!list.length) {

    recent.innerHTML =
      `<div class="empty">
        Belum ada transaksi
      </div>`;

    return;

  }

  recent.innerHTML =
    list
      .map(
        transactionHTML
      )
      .join("");

}

/* =========================================================
   KATEGORI
   ========================================================= */

function renderKategoriSelect() {

  const select =
    document.getElementById(
      "trxKategori"
    );

  if (!select) return;

  const current =
    select.value;

  const jenis =
    state.currentType;

  let categories =
    Array.isArray(
      state.kategori?.[jenis]
    )
      ? state.kategori[jenis]
      : [];

  if (!categories.length) {

    categories =
      jenis === "PEMASUKAN"
        ? [
            "Penjualan",
            "Lainnya"
          ]
        : [
            "Operasional",
            "Lainnya"
          ];

  }

  select.innerHTML =
    `<option value="">
      Pilih kategori
    </option>` +
    categories
      .map(
        k =>
          `<option value="${esc(k)}">
            ${esc(k)}
          </option>`
      )
      .join("");

  if (
    categories.includes(
      current
    )
  ) {

    select.value =
      current;

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

  const search =
    state.barangSearch
      .trim()
      .toLowerCase();

  let list =
    state.barang || [];

  if (search) {

    list =
      list.filter(
        b =>
          String(
            b.nama || ""
          )
            .toLowerCase()
            .includes(search)
          ||
          String(
            b.kategori || ""
          )
            .toLowerCase()
            .includes(search)
      );

  }

  if (!list.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada barang.
      </div>`;

    return;

  }

  container.innerHTML =
    list
      .map(
        barangHTML
      )
      .join("");

}

function barangHTML(
  b
) {

  const stok =
    Number(
      b.stok || 0
    );

  const minimum =
    Number(
      b.minimum || 0
    );

  const lowStock =
    minimum > 0 &&
    stok <= minimum;

  return `
    <div class="form-card">

      <div style="
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
      ">

        <div style="
          min-width:0;
        ">

          <strong style="
            display:block;
            font-size:16px;
            margin-bottom:5px;
          ">
            ${esc(b.nama)}
          </strong>

          <div class="small">
            ${esc(
              b.kategori ||
              "Lainnya"
            )}
          </div>

        </div>

        <div style="
          text-align:right;
          white-space:nowrap;
        ">

          <strong>
            ${rupiah(b.jual)}
          </strong>

          <div class="small">
            Jual
          </div>

        </div>

      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-top:14px;
      ">

        <div>

          <div class="small">
            Modal
          </div>

          <strong>
            ${rupiah(b.modal)}
          </strong>

        </div>

        <div>

          <div class="small">
            Stok
          </div>

          <strong
            style="${
              lowStock
                ? "color:#dc2626;"
                : ""
            }"
          >
            ${stok}
            ${lowStock ? " ⚠️" : ""}
          </strong>

        </div>

      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:10px;
        margin-top:13px;
        padding-top:12px;
        border-top:1px solid #f1f5f9;
      ">

        <span class="small">
          Laba:
          ${rupiah(
            b.labaNominal || 0
          )}
        </span>

        <span class="small">
          ${Number(
            b.labaPersen || 0
          ).toFixed(1)}%
        </span>

      </div>

    </div>
  `;

}

function filterBarang(
  text
) {

  state.barangSearch =
    text || "";

  renderBarang();

}

/* =========================================================
   BARANG SELECT
   ========================================================= */

function fillBarangSelects() {

  const selects = [

    document.getElementById(
      "jualBarang"
    ),

    document.getElementById(
      "belanjaBarang"
    )

  ];

  selects.forEach(
    select => {

      if (!select) return;

      const current =
        select.value;

      select.innerHTML =
        `<option value="">
          Pilih barang
        </option>` +
        state.barang
          .map(
            b =>
              `<option value="${esc(b.id)}">
                ${esc(b.nama)}
                — Stok ${Number(
                  b.stok || 0
                )}
              </option>`
          )
          .join("");

      if (
        state.barang.some(
          b =>
            String(b.id) ===
            String(current)
        )
      ) {

        select.value =
          current;

      }

    }
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

  const search =
    state.historySearch
      .trim()
      .toLowerCase();

  let list =
    state.history
      .slice()
      .sort(sortNewest);

  if (search) {

    list =
      list.filter(
        x => {

          const text =
            [
              x.jenis,
              x.kategori,
              x.keterangan,
              x.barangNama,
              x.nama,
              x.pelanggan,
              x.supplier
            ]
              .join(" ")
              .toLowerCase();

          return text.includes(
            search
          );

        }
      );

  }

  if (!list.length) {

    container.innerHTML =
      `<div class="empty">
        Belum ada transaksi.
      </div>`;

    return;

  }

  container.innerHTML =
    list
      .map(
        transactionHTML
      )
      .join("");

}

function filterHistory(
  text
) {

  state.historySearch =
    text || "";

  renderHistory();

}

/* =========================================================
   TRANSACTION HTML
   ========================================================= */

function transactionHTML(
  x
) {

  const jenis =
    String(
      x.jenis || ""
    ).toUpperCase();

  const positive =
    jenis === "PEMASUKAN" ||
    jenis === "PENJUALAN";

  const nominal =
    Number(
      x.nominal || 0
    );

  const sign =
    positive
      ? "+"
      : "-";

  return `
    <div class="form-card">

      <div style="
        display:flex;
        justify-content:space-between;
        gap:12px;
      ">

        <div style="
          min-width:0;
        ">

          <strong style="
            display:block;
            font-size:14px;
          ">
            ${esc(
              x.keterangan ||
              x.data ||
              "-"
            )}
          </strong>

          <div
            class="small"
            style="
              margin-top:4px;
            "
          >
            ${esc(
              x.tanggal ||
              "-"
            )}
            ·
            ${esc(
              x.kategori ||
              ""
            )}
          </div>

        </div>

        <strong style="
          white-space:nowrap;
          color:${
            positive
              ? "#16a34a"
              : "#dc2626"
          };
        ">
          ${sign}
          ${rupiah(nominal)}
        </strong>

      </div>

      ${
        x.barangNama
          ? `
            <div
              class="small"
              style="
                margin-top:10px;
              "
            >
              Barang:
              ${esc(
                x.barangNama
              )}
              ${
                x.qty
                  ? " × " +
                    x.qty
                  : ""
              }
            </div>
          `
          : ""
      }

      ${
        x.nama
          ? `
            <div
              class="small"
              style="
                margin-top:4px;
              "
            >
              Pihak:
              ${esc(
                x.nama
              )}
            </div>
          `
          : ""
      }

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

  if (
    !state.hutang.length
  ) {

    container.innerHTML =
      `<div class="empty">
        Belum ada hutang.
      </div>`;

    return;

  }

  container.innerHTML =
    state.hutang
      .map(
        hutangHTML
      )
      .join("");

}

function hutangHTML(
  h
) {

  const lunas =
    String(
      h.status || ""
    )
      .toUpperCase() ===
    "LUNAS";

  const sisa =
    Number(
      h.sisa ??
      h.nominal ??
      0
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
            ${esc(h.nama)}
          </strong>

          <div
            class="small"
            style="
              margin-top:5px;
            "
          >
            ${esc(
              h.keterangan ||
              "Hutang"
            )}
          </div>

        </div>

        <strong>
          ${rupiah(sisa)}
        </strong>

      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-top:14px;
      ">

        <div>

          <div class="small">
            Total
          </div>

          <strong>
            ${rupiah(
              h.nominal
            )}
          </strong>

        </div>

        <div>

          <div class="small">
            Dibayar
          </div>

          <strong>
            ${rupiah(
              h.dibayar
            )}
          </strong>

        </div>

      </div>

      <div style="
        margin-top:12px;
        padding-top:10px;
        border-top:1px solid #f1f5f9;
      ">

        <div class="small">
          Jatuh tempo:
          ${
            h.jatuhTempo
              ? esc(
                  h.jatuhTempo
                )
              : "-"
          }
        </div>

        <div
          class="small"
          style="
            margin-top:4px;
            font-weight:700;
            color:${
              lunas
                ? "#16a34a"
                : "#dc2626"
            };
          "
        >
          ${esc(
            h.status ||
            "BELUM LUNAS"
          )}
        </div>

      </div>

      ${
        !lunas &&
        sisa > 0
          ? `
            <button
              type="button"
              class="primary-btn"
              style="
                width:100%;
                margin-top:13px;
              "
              onclick="
                bayarHutangPrompt(
                  '${escAttr(h.id)}'
                )
              "
            >
              💰 Bayar Hutang
            </button>
          `
          : ""
      }

    </div>
  `;

}

/* =========================================================
   REPORT
   ========================================================= */

async function loadReport() {

  const start =
    value(
      "reportStart"
    );

  const end =
    value(
      "reportEnd"
    );

  if (!start || !end) {

    showToast(
      "Pilih periode laporan"
    );

    return;

  }

  if (
    start > end
  ) {

    showToast(
      "Tanggal mulai tidak boleh setelah tanggal akhir"
    );

    return;

  }

  const box =
    document.getElementById(
      "reportResult"
    );

  if (box) {

    box.innerHTML =
      "Memuat laporan...";

  }

  try {

    if (
      navigator.onLine
    ) {

      const result =
        await apiGet(
          "laporan",
          {
            start,
            end
          }
        );

      renderReport(
        result
      );

    } else {

      renderReport(
        buildLocalReport(
          start,
          end
        )
      );

    }

  } catch (error) {

    console.error(
      "REPORT:",
      error
    );

    renderReport(
      buildLocalReport(
        start,
        end
      )
    );

  }

}

function buildLocalReport(
  start,
  end
) {

  let pemasukan = 0;
  let pengeluaran = 0;
  let penjualan = 0;

  const transaksi =
    state.history.filter(
      x => {

        const t =
          x.tanggal ||
          "";

        return (
          (!start ||
            t >= start) &&
          (!end ||
            t <= end)
        );

      }
    );

  transaksi.forEach(
    x => {

      const jenis =
        String(
          x.jenis || ""
        ).toUpperCase();

      const nominal =
        Number(
          x.nominal || 0
        );

      if (
        jenis ===
        "PEMASUKAN"
      ) {

        pemasukan +=
          nominal;

      }

      if (
        jenis ===
        "PENGELUARAN"
      ) {

        pengeluaran +=
          nominal;

      }

      if (
        jenis ===
        "PENJUALAN"
      ) {

        penjualan +=
          nominal;

      }

    }
  );

  return {

    success: true,

    laporan: {

      start,
      end,

      pemasukan,
      pengeluaran,
      penjualan,

      saldo:
        pemasukan -
        pengeluaran,

      jumlahTransaksi:
        transaksi.length,

      transaksi

    }

  };

}

function renderReport(
  result
) {

  const box =
    document.getElementById(
      "reportResult"
    );

  if (!box) return;

  const r =
    result.laporan ||
    result;

  box.innerHTML = `

    <h3 style="
      margin:0 0 15px;
    ">
      Laporan
    </h3>

    <div class="summary-grid">

      <div class="summary-card">
        <div class="summary-info">
          <div class="small">
            Pemasukan
          </div>
          <div class="summary-value">
            ${rupiah(
              r.pemasukan
            )}
          </div>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-info">
          <div class="small">
            Pengeluaran
          </div>
          <div class="summary-value">
            ${rupiah(
              r.pengeluaran
            )}
          </div>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-info">
          <div class="small">
            Penjualan
          </div>
          <div class="summary-value">
            ${rupiah(
              r.penjualan
            )}
          </div>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-info">
          <div class="small">
            Saldo
          </div>
          <div class="summary-value">
            ${rupiah(
              r.saldo
            )}
          </div>
        </div>
      </div>

    </div>

    <div style="
      margin-top:18px;
      padding-top:14px;
      border-top:1px solid #e5e7eb;
    ">

      <div class="small">
        Periode
      </div>

      <strong>
        ${esc(
          r.start || "-"
        )}
        s/d
        ${esc(
          r.end || "-"
        )}
      </strong>

      <div
        class="small"
        style="
          margin-top:6px;
        "
      >
        ${Number(
          r.jumlahTransaksi ||
          0
        )}
        transaksi
      </div>

    </div>

  `;

}

/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(
  page
) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      el =>
        el.classList.remove(
          "active"
        )
    );

  const target =
    document.getElementById(
      "page-" +
      page
    );

  if (target) {

    target.classList.add(
      "active"
    );

  }

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      el =>
        el.classList.remove(
          "active"
        )
    );

  const navItems =
    document.querySelectorAll(
      ".nav-item"
    );

  if (
    page ===
    "dashboard"
  ) {

    navItems[0]
      ?.classList.add(
        "active"
      );

  } else if (
    page === "add"
  ) {

    navItems[1]
      ?.classList.add(
        "active"
      );

  } else if (
    page === "barang"
  ) {

    navItems[3]
      ?.classList.add(
        "active"
      );

  }

  closeQuickAdd();

  window.scrollTo(
    {
      top: 0,
      behavior: "smooth"
    }
  );

  if (
    page === "barang"
  ) {

    renderBarang();

  }

}

/* =========================================================
   MORE MENU
   ========================================================= */

function showMoreMenu() {

  document
    .getElementById(
      "moreMenu"
    )
    ?.classList.remove(
      "hidden"
    );

}

function closeMoreMenu() {

  document
    .getElementById(
      "moreMenu"
    )
    ?.classList.add(
      "hidden"
    );

}

function openFromMenu(
  page
) {

  closeMoreMenu();

  showPage(
    page
  );

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

  document
    .getElementById(
      "quickAddMenu"
    )
    ?.classList.remove(
      "show"
    );

}

/* =========================================================
   MODAL
   ========================================================= */

function openModal(
  id
) {

  document
    .getElementById(
      id
    )
    ?.classList.remove(
      "hidden"
    );

}

function closeModal(
  id
) {

  document
    .getElementById(
      id
    )
    ?.classList.add(
      "hidden"
    );

}

/* =========================================================
   RESET FORM
   ========================================================= */

function resetTransactionForm() {

  const form =
    document.getElementById(
      "transactionForm"
    );

  if (form) {

    form.reset();

  }

  const date =
    document.getElementById(
      "trxTanggal"
    );

  if (date) {

    date.value =
      today();

  }

  const rekening =
    document.getElementById(
      "trxRekening"
    );

  if (rekening) {

    rekening.value =
      "Kas";

  }

  renderKategoriSelect();

}

/* =========================================================
   CONNECTION
   ========================================================= */

function updateConnectionStatus() {

  const online =
    navigator.onLine;

  state.online =
    online;

  const dot =
    document.getElementById(
      "onlineDot"
    );

  const text =
    document.getElementById(
      "onlineText"
    );

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

function setSyncText(
  text
) {

  const el =
    document.getElementById(
      "syncText"
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

  document
    .getElementById(
      "loading"
    )
    ?.classList.add(
      "hidden"
    );

}

/* =========================================================
   TOAST
   ========================================================= */

function showToast(
  message
) {

  const el =
    document.getElementById(
      "toast"
    );

  if (!el) {

    console.log(
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
    setTimeout(
      () => {

        el.classList.remove(
          "show"
        );

      },
      2500
    );

}

/* =========================================================
   HELPERS
   ========================================================= */

function value(
  id
) {

  return (
    document.getElementById(
      id
    )?.value
      ?.trim() ||
    ""
  );

}

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

function rupiah(
  value
) {

  const n =
    Number(
      value || 0
    );

  return (
    "Rp " +
    new Intl.NumberFormat(
      "id-ID"
    ).format(n)
  );

}

function sortNewest(
  a,
  b
) {

  const da =
    new Date(
      a.tanggalDibuat ||
      a.createdAt ||
      a.tanggal ||
      0
    ).getTime();

  const db =
    new Date(
      b.tanggalDibuat ||
      b.createdAt ||
      b.tanggal ||
      0
    ).getTime();

  return db - da;

}

/* =========================================================
   LOCAL ID
   ========================================================= */

function makeLocalId(
  prefix
) {

  return (
    prefix +
    "-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(
        2,
        9
      )
      .toUpperCase()
  );

}

/* =========================================================
   HTML ESCAPE
   ========================================================= */

function esc(
  value
) {

  return String(
    value ??
    ""
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

function escAttr(
  value
) {

  return esc(
    value
  );

}

/* =========================================================
   SERVICE WORKER
   ========================================================= */

if (
  "serviceWorker" in
  navigator
) {

  window.addEventListener(
    "load",
    function() {

      navigator.serviceWorker
        .register(
          "./sw.js",
          {
            scope:
              "./"
          }
        )
        .then(
          registration => {

            console.log(
              "Service Worker aktif:",
              registration.scope
            );

          }
        )
        .catch(
          error => {

            console.warn(
              "Service Worker:",
              error
            );

          }
        );

    }
  );

}
