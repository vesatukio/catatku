/* =========================================================
   CATATKU
   app.js
   OFFLINE FIRST
   INDEXEDDB
   AUTO SYNC GOOGLE APPS SCRIPT
   ========================================================= */

"use strict";

/* =========================================================
   KONFIGURASI
   ========================================================= */

const GAS_URL =
  "GANTI_DENGAN_URL_WEB_APP_GAS_ANDA";

const DB_NAME =
  "CatatKuDB";

const DB_VERSION =
  2;

const STORE_DATA =
  "data";

const STORE_QUEUE =
  "queue";

const STORE_META =
  "meta";


/* =========================================================
   STATE
   ========================================================= */

const AppState = {

  online:
    navigator.onLine,

  syncing:
    false,

  data: {

    dashboard: {},

    barang: [],

    history: [],

    hutang: [],

    kategori: []

  },

  lastSync:
    null

};


/* =========================================================
   IDB OPEN
   ========================================================= */

function openDB() {

  return new Promise(
    (resolve, reject) => {

      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION
        );

      request.onupgradeneeded =
        function (event) {

          const db =
            event.target.result;

          if (
            !db.objectStoreNames
              .contains(STORE_DATA)
          ) {

            db.createObjectStore(
              STORE_DATA,
              {
                keyPath: "key"
              }
            );

          }

          if (
            !db.objectStoreNames
              .contains(STORE_QUEUE)
          ) {

            db.createObjectStore(
              STORE_QUEUE,
              {
                keyPath: "localId"
              }
            );

          }

          if (
            !db.objectStoreNames
              .contains(STORE_META)
          ) {

            db.createObjectStore(
              STORE_META,
              {
                keyPath: "key"
              }
            );

          }

        };

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
   IDB PUT
   ========================================================= */

async function dbPut(
  storeName,
  value
) {

  const db =
    await openDB();

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
          storeName,
          "readwrite"
        );

      tx.objectStore(
        storeName
      ).put(value);

      tx.oncomplete =
        () => resolve(true);

      tx.onerror =
        () =>
          reject(
            tx.error
          );

    }
  );

}


/* =========================================================
   IDB GET
   ========================================================= */

async function dbGet(
  storeName,
  key
) {

  const db =
    await openDB();

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
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
   IDB ALL
   ========================================================= */

async function dbAll(
  storeName
) {

  const db =
    await openDB();

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
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
   IDB DELETE
   ========================================================= */

async function dbDelete(
  storeName,
  key
) {

  const db =
    await openDB();

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
          storeName,
          "readwrite"
        );

      tx.objectStore(
        storeName
      ).delete(key);

      tx.oncomplete =
        () => resolve(true);

      tx.onerror =
        () =>
          reject(
            tx.error
          );

    }
  );

}


/* =========================================================
   SIMPAN APP DATA
   ========================================================= */

async function saveAppData(
  data
) {

  if (!data) return;

  AppState.data =
    Object.assign(
      AppState.data,
      data
    );

  await dbPut(
    STORE_DATA,
    {
      key: "appData",
      value:
        AppState.data,
      updatedAt:
        Date.now()
    }
  );

  renderAppData();

}


/* =========================================================
   LOAD APP DATA
   ========================================================= */

async function loadLocalData() {

  const saved =
    await dbGet(
      STORE_DATA,
      "appData"
    );

  if (
    saved &&
    saved.value
  ) {

    AppState.data =
      Object.assign(
        AppState.data,
        saved.value
      );

    renderAppData();

    return true;

  }

  return false;
}


/* =========================================================
   QUEUE
   ========================================================= */

async function addQueue(
  action,
  payload
) {

  const localId =
    "Q-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 8);

  const item = {

    localId:

      localId,

    action:

      action,

    payload:

      payload,

    createdAt:

      new Date()
        .toISOString(),

    retry:

      0

  };

  await dbPut(
    STORE_QUEUE,
    item
  );

  updateSyncUI();

  return item;

}


/* =========================================================
   GET QUEUE
   ========================================================= */

async function getQueue() {

  return dbAll(
    STORE_QUEUE
  );

}


/* =========================================================
   REMOVE QUEUE
   ========================================================= */

async function removeQueue(
  localId
) {

  await dbDelete(
    STORE_QUEUE,
    localId
  );

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

  Object.keys(params)
    .forEach(
      key => {

        const value =
          params[key];

        if (
          value !== undefined &&
          value !== null
        ) {

          if (
            typeof value ===
            "object"
          ) {

            url.searchParams.set(
              key,
              JSON.stringify(value)
            );

          } else {

            url.searchParams.set(
              key,
              value
            );

          }

        }

      }
    );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",
        cache: "no-store"
      }
    );

  if (!response.ok) {

    throw new Error(
      "HTTP " +
      response.status
    );

  }

  return response.json();

}


/* =========================================================
   API POST
   ========================================================= */

async function apiPost(
  action,
  payload = {}
) {

  const body =
    Object.assign(
      {},
      payload,
      {
        action:
          action
      }
    );

  const response =
    await fetch(
      GAS_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body:
          JSON.stringify(body)
      }
    );

  if (!response.ok) {

    throw new Error(
      "HTTP " +
      response.status
    );

  }

  return response.json();

}


/* =========================================================
   API REQUEST
   ========================================================= */

async function apiRequest(
  action,
  payload = {},
  options = {}
) {

  if (
    !AppState.online &&
    !options.forceOnline
  ) {

    throw new Error(
      "OFFLINE"
    );

  }

  try {

    if (
      options.method === "GET"
    ) {

      return await apiGet(
        action,
        payload
      );

    }

    return await apiPost(
      action,
      payload
    );

  } catch (error) {

    /*
     * Jika gagal internet,
     * simpan ke queue.
     */

    if (
      options.queue !== false &&
      !options.readOnly
    ) {

      await addQueue(
        action,
        payload
      );

    }

    throw error;

  }

}


/* =========================================================
   LOAD SERVER
   ========================================================= */

async function loadServerData() {

  if (!AppState.online) {

    return false;

  }

  try {

    setSyncStatus(
      "syncing",
      "Mengambil data..."
    );

    const result =
      await apiGet(
        "appData"
      );

    if (
      !result.success
    ) {

      throw new Error(
        result.error ||
        "Gagal mengambil data."
      );

    }

    await saveAppData(
      result.data
    );

    AppState.lastSync =
      new Date();

    await dbPut(
      STORE_META,
      {
        key:
          "lastSync",
        value:
          AppState.lastSync
            .toISOString()
      }
    );

    setSyncStatus(
      "online",
      "Tersinkron"
    );

    return true;

  } catch (error) {

    console.error(
      "Load server:",
      error
    );

    setSyncStatus(
      "error",
      "Gagal sinkron"
    );

    return false;

  }

}


/* =========================================================
   SYNC QUEUE
   ========================================================= */

async function syncQueue() {

  if (
    AppState.syncing
  ) {

    return;

  }

  if (
    !AppState.online
  ) {

    return;

  }

  AppState.syncing =
    true;

  updateSyncUI();

  try {

    const queue =
      await getQueue();

    if (!queue.length) {

      await loadServerData();

      return;

    }

    setSyncStatus(
      "syncing",
      "Mengirim " +
      queue.length +
      " data..."
    );

    for (
      const item of queue
    ) {

      try {

        const result =
          await apiPost(
            item.action,
            item.payload
          );

        if (
          result &&
          result.success
        ) {

          await removeQueue(
            item.localId
          );

        } else {

          item.retry =
            (item.retry || 0) +
            1;

          item.error =
            result.error ||
            "Server menolak data.";

          await dbPut(
            STORE_QUEUE,
            item
          );

        }

      } catch (error) {

        item.retry =
          (item.retry || 0) +
          1;

        item.error =
          error.message;

        await dbPut(
          STORE_QUEUE,
          item
        );

        /*
         * Stop jika koneksi
         * memang bermasalah.
         */

        if (
          !navigator.onLine
        ) {

          break;

        }

      }

    }

    /*
     * Setelah queue selesai,
     * ambil data terbaru.
     */

    await loadServerData();

    setSyncStatus(
      "online",
      "Tersinkron"
    );

  } finally {

    AppState.syncing =
      false;

    updateSyncUI();

  }

}


/* =========================================================
   AUTO SYNC
   ========================================================= */

function startAutoSync() {

  setInterval(
    () => {

      if (
        navigator.onLine
      ) {

        syncQueue();

      }

    },
    30000
  );

}


/* =========================================================
   ONLINE
   ========================================================= */

window.addEventListener(
  "online",
  () => {

    AppState.online =
      true;

    setSyncStatus(
      "online",
      "Online"
    );

    syncQueue();

  }
);


/* =========================================================
   OFFLINE
   ========================================================= */

window.addEventListener(
  "offline",
  () => {

    AppState.online =
      false;

    setSyncStatus(
      "offline",
      "Offline"
    );

  }
);


/* =========================================================
   SIMPAN BARANG
   ========================================================= */

async function simpanBarang(
  data
) {

  data =
    normalizeBarang(data);

  /*
   * Optimistic local update
   */

  upsertLocal(
    "barang",
    data
  );

  renderAppData();

  try {

    if (!AppState.online) {

      await addQueue(
        "tambahBarang",
        data
      );

      return {
        success: true,
        offline: true,
        data: data
      };

    }

    const result =
      await apiPost(
        "tambahBarang",
        data
      );

    if (
      result.success
    ) {

      upsertLocal(
        "barang",
        result.data
      );

      await saveAppData(
        AppState.data
      );

      return result;

    }

    throw new Error(
      result.error
    );

  } catch (error) {

    /*
     * Jangan queue dua kali
     * kalau apiPost sudah
     * memasukkannya.
     */

    if (
      error.message ===
      "OFFLINE"
    ) {

      await addQueue(
        "tambahBarang",
        data
      );

    }

    return {
      success: true,
      offline: true,
      data: data
    };

  }

}


/* =========================================================
   HAPUS BARANG
   ========================================================= */

async function hapusBarang(
  id
) {

  const old =
    AppState.data.barang
      .find(
        b =>
          String(b.ID)
          === String(id)
      );

  AppState.data.barang =
    AppState.data.barang
      .filter(
        b =>
          String(b.ID)
          !== String(id)
      );

  renderAppData();

  const payload = {
    ID: id
  };

  if (!AppState.online) {

    await addQueue(
      "hapusBarang",
      payload
    );

    return {
      success: true,
      offline: true
    };

  }

  try {

    return await apiPost(
      "hapusBarang",
      payload
    );

  } catch (error) {

    /*
     * Jika gagal kirim,
     * queue hapus.
     */

    await addQueue(
      "hapusBarang",
      payload
    );

    return {
      success: true,
      offline: true,
      old: old
    };

  }

}


/* =========================================================
   PENJUALAN
   ========================================================= */

async function simpanPenjualan(
  data
) {

  data =
    normalizeTransaksi(
      data,
      "PENJUALAN"
    );

  /*
   * Update stok lokal
   */

  if (
    data.BarangID
  ) {

    updateLocalStock(
      data.BarangID,
      -Number(
        data.Qty || 1
      )
    );

  }

  addLocalHistory(
    data
  );

  renderAppData();

  if (
    !AppState.online
  ) {

    await addQueue(
      "tambahPenjualan",
      data
    );

    return {
      success: true,
      offline: true,
      data: data
    };

  }

  try {

    const result =
      await apiPost(
        "tambahPenjualan",
        data
      );

    if (
      !result.success
    ) {

      throw new Error(
        result.error
      );

    }

    await loadServerData();

    return result;

  } catch (error) {

    await addQueue(
      "tambahPenjualan",
      data
    );

    return {
      success: true,
      offline: true,
      data: data
    };

  }

}


/* =========================================================
   BELANJA
   ========================================================= */

async function simpanBelanja(
  data
) {

  data =
    normalizeTransaksi(
      data,
      "BELANJA"
    );

  if (
    data.BarangID
  ) {

    updateLocalStock(
      data.BarangID,
      Number(
        data.Qty || 1
      )
    );

  }

  addLocalHistory(
    data
  );

  renderAppData();

  if (
    !AppState.online
  ) {

    await addQueue(
      "tambahBelanja",
      data
    );

    return {
      success: true,
      offline: true,
      data: data
    };

  }

  try {

    const result =
      await apiPost(
        "tambahBelanja",
        data
      );

    if (
      !result.success
    ) {

      throw new Error(
        result.error
      );

    }

    await loadServerData();

    return result;

  } catch (error) {

    await addQueue(
      "tambahBelanja",
      data
    );

    return {
      success: true,
      offline: true,
      data: data
    };

  }

}


/* =========================================================
   TRANSAKSI UMUM
   ========================================================= */

async function simpanTransaksi(
  data
) {

  const jenis =
    String(
      data.Jenis ||
      data.jenis ||
      ""
    ).toUpperCase();

  if (
    jenis === "PENJUALAN" ||
    jenis === "PEMASUKAN"
  ) {

    return simpanPenjualan(
      data
    );

  }

  if (
    jenis === "BELANJA" ||
    jenis === "PENGELUARAN"
  ) {

    return simpanBelanja(
      data
    );

  }

  addLocalHistory(
    data
  );

  renderAppData();

  if (
    !AppState.online
  ) {

    await addQueue(
      "tambahTransaksi",
      data
    );

    return {
      success: true,
      offline: true,
      data: data
    };

  }

  try {

    const result =
      await apiPost(
        "tambahTransaksi",
        data
      );

    await loadServerData();

    return result;

  } catch (error) {

    await addQueue(
      "tambahTransaksi",
      data
    );

    return {
      success: true,
      offline: true
    };

  }

}


/* =========================================================
   HUTANG
   ========================================================= */

async function simpanHutang(
  data
) {

  data =
    normalizeTransaksi(
      data,
      "HUTANG"
    );

  addLocalHistory(
    data
  );

  if (!AppState.data.hutang) {

    AppState.data.hutang =
      [];

  }

  AppState.data.hutang
    .push(data);

  renderAppData();

  if (
    !AppState.online
  ) {

    await addQueue(
      "tambahHutang",
      data
    );

    return {
      success: true,
      offline: true
    };

  }

  try {

    const result =
      await apiPost(
        "tambahHutang",
        data
      );

    await loadServerData();

    return result;

  } catch (error) {

    await addQueue(
      "tambahHutang",
      data
    );

    return {
      success: true,
      offline: true
    };

  }

}


/* =========================================================
   BAYAR HUTANG
   ========================================================= */

async function bayarHutang(
  data
) {

  if (
    !AppState.online
  ) {

    await addQueue(
      "bayarHutang",
      data
    );

    return {
      success: true,
      offline: true
    };

  }

  try {

    const result =
      await apiPost(
        "bayarHutang",
        data
      );

    await loadServerData();

    return result;

  } catch (error) {

    await addQueue(
      "bayarHutang",
      data
    );

    return {
      success: true,
      offline: true
    };

  }

}


/* =========================================================
   NORMALIZE BARANG
   ========================================================= */

function normalizeBarang(
  data
) {

  const now =
    new Date()
      .toISOString();

  const modal =
    Number(
      data.Modal ??
      data.modal ??
      0
    );

  const labaPersen =
    Number(
      data["Laba%"] ??
      data.labaPersen ??
      data.laba ??
      0
    );

  let labaNominal =
    Number(
      data["Laba Nominal"] ??
      data.labaNominal ??
      0
    );

  let jual =
    Number(
      data.Jual ??
      data.jual ??
      data.harga ??
      0
    );

  if (
    !labaNominal &&
    labaPersen
  ) {

    labaNominal =
      modal *
      labaPersen /
      100;

  }

  if (
    !jual
  ) {

    jual =
      modal +
      labaNominal;

  }

  return {

    ID:
      data.ID ||
      data.id ||
      createID("BRG"),

    "Nama Barang":
      data["Nama Barang"] ||
      data.nama ||
      data.namaBarang ||
      "",

    Kategori:
      data.Kategori ||
      data.kategori ||
      "",

    Modal:
      modal,

    "Laba%":
      labaPersen,

    "Laba Nominal":
      labaNominal,

    Jual:
      jual,

    Stok:
      Number(
        data.Stok ??
        data.stok ??
        0
      ),

    Minimum:
      Number(
        data.Minimum ??
        data.minimum ??
        0
      ),

    Supplier:
      data.Supplier ||
      data.supplier ||
      "",

    "Tanggal Dibuat":
      data["Tanggal Dibuat"] ||
      now,

    "Terakhir Diubah":
      now

  };

}


/* =========================================================
   NORMALIZE TRANSAKSI
   ========================================================= */

function normalizeTransaksi(
  data,
  jenis
) {

  const nominal =
    Number(
      data.Nominal ??
      data.nominal ??
      (
        Number(
          data.Qty || 1
        ) *
        Number(
          data.Harga ||
          data.harga ||
          0
        )
      )
    );

  return {

    ID:
      data.ID ||
      data.id ||
      createID(
        jenis === "HUTANG"
          ? "HTG"
          : "TRX"
      ),

    "Tanggal Dibuat":
      data["Tanggal Dibuat"] ||
      new Date()
        .toISOString(),

    Data:
      data.Data ||
      jenis,

    Tanggal:
      data.Tanggal ||
      data.tanggal ||
      getToday(),

    Jenis:
      jenis === "BELANJA"
        ? "PENGELUARAN"
        : (
          jenis === "PENJUALAN"
            ? "PEMASUKAN"
            : jenis
        ),

    Kategori:
      data.Kategori ||
      data.kategori ||
      "",

    Keterangan:
      data.Keterangan ||
      data.keterangan ||
      "",

    Nominal:
      nominal,

    Rekening:
      data.Rekening ||
      data.rekening ||
      "Kas",

    BarangID:
      data.BarangID ||
      data.barangID ||
      "",

    BarangNama:
      data.BarangNama ||
      data.barangNama ||
      data.namaBarang ||
      "",

    Qty:
      Number(
        data.Qty ??
        data.qty ??
        0
      ),

    Harga:
      Number(
        data.Harga ??
        data.harga ??
        0
      ),

    Supplier:
      data.Supplier ||
      data.supplier ||
      "",

    Pelanggan:
      data.Pelanggan ||
      data.pelanggan ||
      "",

    Nama:
      data.Nama ||
      data.nama ||
      "",

    JatuhTempo:
      data.JatuhTempo ||
      data.jatuhTempo ||
      "",

    Dibayar:
      Number(
        data.Dibayar ??
        data.dibayar ??
        0
      ),

    Status:
      data.Status ||
      data.status ||
      (
        jenis === "HUTANG"
          ? "BELUM LUNAS"
          : "LUNAS"
      )

  };

}


/* =========================================================
   LOCAL UPSERT
   ========================================================= */

function upsertLocal(
  collection,
  item
) {

  if (
    !AppState.data[
      collection
    ]
  ) {

    AppState.data[
      collection
    ] = [];

  }

  const arr =
    AppState.data[
      collection
    ];

  const index =
    arr.findIndex(
      x =>
        String(x.ID)
        === String(item.ID)
    );

  if (
    index >= 0
  ) {

    arr[index] =
      Object.assign(
        {},
        arr[index],
        item
      );

  } else {

    arr.unshift(
      item
    );

  }

}


/* =========================================================
   LOCAL HISTORY
   ========================================================= */

function addLocalHistory(
  data
) {

  if (
    !AppState.data.history
  ) {

    AppState.data.history =
      [];

  }

  const exists =
    AppState.data.history
      .some(
        x =>
          String(x.ID)
          === String(data.ID)
      );

  if (!exists) {

    AppState.data.history
      .unshift(
        data
      );

  }

}


/* =========================================================
   LOCAL STOK
   ========================================================= */

function updateLocalStock(
  id,
  delta
) {

  const barang =
    AppState.data.barang
      .find(
        x =>
          String(x.ID)
          === String(id)
      );

  if (barang) {

    barang.Stok =
      Number(
        barang.Stok || 0
      ) +
      Number(delta);

  }

}


/* =========================================================
   ID LOCAL
   ========================================================= */

function createID(
  prefix
) {

  return (
    prefix +
    "-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 7)
  );

}


/* =========================================================
   TODAY
   ========================================================= */

function getToday() {

  const d =
    new Date();

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


/* =========================================================
   RENDER
   ========================================================= */

function renderAppData() {

  /*
   * Event custom.
   * HTML lama Anda dapat mendengarkan
   * event ini tanpa perlu perubahan besar.
   */

  window.dispatchEvent(
    new CustomEvent(
      "catatku:data",
      {
        detail:
          AppState.data
      }
    )
  );

  renderDashboard();

  renderBarang();

  renderHistory();

  renderHutang();

  renderKategori();

  updateSyncUI();

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  const d =
    AppState.data.dashboard ||
    {};

  setText(
    [
      "saldo",
      "totalSaldo",
      "dashboardSaldo"
    ],
    rupiah(d.saldo)
  );

  setText(
    [
      "pemasukan",
      "totalPemasukan"
    ],
    rupiah(d.pemasukan)
  );

  setText(
    [
      "pengeluaran",
      "totalPengeluaran"
    ],
    rupiah(d.pengeluaran)
  );

  setText(
    [
      "saldoPribadi"
    ],
    rupiah(d.saldoPribadi)
  );

  setText(
    [
      "saldoToko"
    ],
    rupiah(d.saldoToko)
  );

  setText(
    [
      "totalHutang"
    ],
    rupiah(d.totalHutang)
  );

  setText(
    [
      "nilaiStok"
    ],
    rupiah(d.nilaiStok)
  );

  setText(
    [
      "jumlahBarang"
    ],
    formatNumber(
      d.jumlahBarang
    )
  );

}


/* =========================================================
   BARANG
   ========================================================= */

function renderBarang() {

  window.dispatchEvent(
    new CustomEvent(
      "catatku:barang",
      {
        detail:
          AppState.data.barang
      }
    )
  );

}


/* =========================================================
   HISTORY
   ========================================================= */

function renderHistory() {

  window.dispatchEvent(
    new CustomEvent(
      "catatku:history",
      {
        detail:
          AppState.data.history
      }
    )
  );

}


/* =========================================================
   HUTANG
   ========================================================= */

function renderHutang() {

  window.dispatchEvent(
    new CustomEvent(
      "catatku:hutang",
      {
        detail:
          AppState.data.hutang
      }
    )
  );

}


/* =========================================================
   KATEGORI
   ========================================================= */

function renderKategori() {

  window.dispatchEvent(
    new CustomEvent(
      "catatku:kategori",
      {
        detail:
          AppState.data.kategori
      }
    )
  );

}


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(
  ids,
  value
) {

  ids.forEach(
    id => {

      const el =
        document.getElementById(
          id
        );

      if (el) {

        el.textContent =
          value;

      }

    }
  );

}


/* =========================================================
   RUPIAH
   ========================================================= */

function rupiah(
  value
) {

  return new Intl.NumberFormat(
    "id-ID",
    {
      style:
        "currency",
      currency:
        "IDR",
      maximumFractionDigits:
        0
    }
  ).format(
    Number(value || 0)
  );

}


/* =========================================================
   NUMBER
   ========================================================= */

function formatNumber(
  value
) {

  return new Intl.NumberFormat(
    "id-ID"
  ).format(
    Number(value || 0)
  );

}


/* =========================================================
   SYNC UI
   ========================================================= */

function setSyncStatus(
  status,
  text
) {

  const elements =
    document.querySelectorAll(
      "[data-sync-status], #syncStatus, .sync-status"
    );

  elements.forEach(
    el => {

      el.dataset.status =
        status;

      el.textContent =
        text;

    }
  );

}


async function updateSyncUI() {

  const queue =
    await getQueue();

  const count =
    queue.length;

  setText(
    [
      "syncCount",
      "pendingSync"
    ],
    String(count)
  );

  document
    .querySelectorAll(
      "[data-sync-count]"
    )
    .forEach(
      el => {

        el.textContent =
          count;

      }
    );

  if (
    AppState.syncing
  ) {

    setSyncStatus(
      "syncing",
      "Sinkronisasi..."
    );

  } else if (
    !navigator.onLine
  ) {

    setSyncStatus(
      "offline",
      "Offline"
    );

  } else if (
    count > 0
  ) {

    setSyncStatus(
      "pending",
      count +
      " belum tersinkron"
    );

  } else {

    setSyncStatus(
      "online",
      "Tersinkron"
    );

  }

}


/* =========================================================
   NAVIGASI MENU
   ========================================================= */

document.addEventListener(
  "click",
  function (event) {

    const button =
      event.target.closest(
        "[data-menu]"
      );

    if (!button) {

      return;

    }

    const menu =
      button.dataset.menu;

    if (!menu) {

      return;

    }

    document
      .querySelectorAll(
        "[data-page]"
      )
      .forEach(
        page => {

          page.hidden =
            page.dataset.page
            !== menu;

        }
      );

    document
      .querySelectorAll(
        "[data-menu]"
      )
      .forEach(
        btn => {

          btn.classList.toggle(
            "active",
            btn === button
          );

        }
      );

    window.dispatchEvent(
      new CustomEvent(
        "catatku:navigate",
        {
          detail:
            menu
        }
      )
    );

  }
);


/* =========================================================
   SUBMIT FORM OTOMATIS
   ========================================================= */

document.addEventListener(
  "submit",
  async function (event) {

    const form =
      event.target;

    if (
      !form.matches(
        "[data-catatku-form]"
      )
    ) {

      return;

    }

    event.preventDefault();

    const formData =
      new FormData(form);

    const data = {};

    formData.forEach(
      (value, key) => {

        data[key] =
          value;

      }
    );

    const action =
      form.dataset.action ||
      "tambahTransaksi";

    try {

      let result;

      switch (action) {

        case "tambahBarang":

          result =
            await simpanBarang(
              data
            );

          break;

        case "tambahPenjualan":

          result =
            await simpanPenjualan(
              data
            );

          break;

        case "tambahBelanja":

          result =
            await simpanBelanja(
              data
            );

          break;

        case "tambahHutang":

          result =
            await simpanHutang(
              data
            );

          break;

        case "bayarHutang":

          result =
            await bayarHutang(
              data
            );

          break;

        default:

          result =
            await simpanTransaksi(
              data
            );

      }

      if (
        result &&
        result.success
      ) {

        form.reset();

        showToast(
          result.offline
            ? "Tersimpan offline. Akan disinkronkan."
            : "Data berhasil disimpan."
        );

      } else {

        showToast(
          result.error ||
          "Gagal menyimpan data."
        );

      }

    } catch (error) {

      console.error(error);

      showToast(
        error.message
      );

    }

  }
);


/* =========================================================
   DELETE DATA
   ========================================================= */

document.addEventListener(
  "click",
  async function (event) {

    const button =
      event.target.closest(
        "[data-delete-id]"
      );

    if (!button) {

      return;

    }

    const id =
      button.dataset.deleteId;

    const type =
      button.dataset.deleteType ||
      "data";

    if (
      !confirm(
        "Hapus data ini?"
      )
    ) {

      return;

    }

    try {

      if (
        type === "barang"
      ) {

        await hapusBarang(
          id
        );

      } else {

        const payload = {
          ID: id
        };

        if (
          !AppState.online
        ) {

          await addQueue(
            "hapusData",
            payload
          );

        } else {

          await apiPost(
            "hapusData",
            payload
          );

        }

        AppState.data.history =
          AppState.data.history
            .filter(
              x =>
                String(x.ID)
                !== String(id)
            );

        renderAppData();

      }

      showToast(
        "Data dihapus."
      );

    } catch (error) {

      showToast(
        "Gagal menghapus: " +
        error.message
      );

    }

  }
);


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
  message
) {

  let toast =
    document.getElementById(
      "catatkuToast"
    );

  if (!toast) {

    toast =
      document.createElement(
        "div"
      );

    toast.id =
      "catatkuToast";

    toast.className =
      "catatku-toast";

    document.body
      .appendChild(
        toast
      );

  }

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  clearTimeout(
    toast._timer
  );

  toast._timer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      2500
    );

}


/* =========================================================
   MANUAL SYNC BUTTON
   ========================================================= */

document.addEventListener(
  "click",
  function (event) {

    const button =
      event.target.closest(
        "[data-sync], #btnSync"
      );

    if (!button) {

      return;

    }

    syncQueue();

  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initCatatKu() {

  console.log(
    "CatatKu starting..."
  );

  await openDB();

  await loadLocalData();

  updateSyncUI();

  /*
   * Ambil data server.
   */

  if (
    navigator.onLine
  ) {

    await loadServerData();

    await syncQueue();

  } else {

    setSyncStatus(
      "offline",
      "Offline"
    );

  }

  startAutoSync();

  /*
   * Service Worker
   */

  if (
    "serviceWorker"
    in navigator
  ) {

    try {

      await navigator
        .serviceWorker
        .register(
          "./sw.js"
        );

      console.log(
        "Service Worker aktif"
      );

    } catch (error) {

      console.warn(
        "Service Worker gagal:",
        error
      );

    }

  }

  renderAppData();

}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.CatatKu = {

  state:
    AppState,

  sync:
    syncQueue,

  refresh:
    loadServerData,

  dashboard:
    getDashboardLocal,

  barang:
    () =>
      AppState.data.barang,

  history:
    () =>
      AppState.data.history,

  hutang:
    () =>
      AppState.data.hutang,

  kategori:
    () =>
      AppState.data.kategori,

  simpanBarang:
    simpanBarang,

  hapusBarang:
    hapusBarang,

  simpanPenjualan:
    simpanPenjualan,

  simpanBelanja:
    simpanBelanja,

  simpanTransaksi:
    simpanTransaksi,

  simpanHutang:
    simpanHutang,

  bayarHutang:
    bayarHutang,

  getQueue:
    getQueue,

  rupiah:
    rupiah

};


/* =========================================================
   DASHBOARD LOCAL
   ========================================================= */

function getDashboardLocal() {

  return (
    AppState.data.dashboard ||
    {}
  );

}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initCatatKu
  );

} else {

  initCatatKu();

}
