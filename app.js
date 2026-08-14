/* =========================================================
   CATATKU
   app.js FINAL

   FRONTEND
   - IndexedDB
   - Offline First
   - Queue
   - Auto Sync
   - Manual Sync
   - Google Apps Script
   - Barang
   - Transaksi
   - Penjualan
   - Dashboard
   - Anti Duplikat
   ========================================================= */

"use strict";


/* =========================================================
   KONFIGURASI GAS
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzYYBPcHEKLcVHjOz0O1nTAkUrX6YbH3PgHWAWscVNX9-sBKwWRSgkqwd7ET02w_brc/exec";


/* =========================================================
   DATABASE
   ========================================================= */

const DB_NAME =
  "CATATKU_DB";

const DB_VERSION =
  1;

const STORE_DATA =
  "data";

const STORE_QUEUE =
  "queue";


let db = null;

let dbReady = null;


/* =========================================================
   DATA LOKAL
   ========================================================= */

const localData = {

  transaksi: [],

  barang: [],

  penjualan: [],

  dashboard: {

    uangMasuk: 0,
    uangKeluar: 0,
    saldo: 0,

    omzet: 0,
    modal: 0,
    untung: 0,

    jumlahBarang: 0,
    jumlahStok: 0,
    nilaiStok: 0,

    jumlahPenjualan: 0,
    totalTerjual: 0

  }

};


/* =========================================================
   START DATABASE
   ========================================================= */

function initDatabase() {

  if (dbReady) {

    return dbReady;

  }

  dbReady =
    new Promise(
      function(resolve, reject) {

        const request =
          indexedDB.open(
            DB_NAME,
            DB_VERSION
          );


        request.onupgradeneeded =
          function(event) {

            const database =
              event.target.result;


            if (
              !database.objectStoreNames.contains(
                STORE_DATA
              )
            ) {

              database.createObjectStore(
                STORE_DATA,
                {
                  keyPath: "key"
                }
              );

            }


            if (
              !database.objectStoreNames.contains(
                STORE_QUEUE
              )
            ) {

              const queue =
                database.createObjectStore(
                  STORE_QUEUE,
                  {
                    keyPath: "id"
                  }
                );

              queue.createIndex(
                "createdAt",
                "createdAt"
              );

            }

          };


        request.onsuccess =
          function(event) {

            db =
              event.target.result;

            db.onerror =
              function(error) {

                console.error(
                  "IndexedDB error:",
                  error
                );

              };

            resolve(db);

          };


        request.onerror =
          function(event) {

            console.error(
              "IndexedDB gagal:",
              event.target.error
            );

            reject(
              event.target.error
            );

          };

      }
    );

  return dbReady;

}


/* =========================================================
   DATABASE PUT
   ========================================================= */

async function dbPut(
  key,
  value
) {

  const database =
    await initDatabase();

  return new Promise(
    function(resolve, reject) {

      const tx =
        database.transaction(
          STORE_DATA,
          "readwrite"
        );

      const store =
        tx.objectStore(
          STORE_DATA
        );

      store.put({

        key: key,

        value: value

      });

      tx.oncomplete =
        function() {

          resolve(true);

        };

      tx.onerror =
        function() {

          reject(
            tx.error
          );

        };

    }
  );

}


/* =========================================================
   DATABASE GET
   ========================================================= */

async function dbGet(key) {

  const database =
    await initDatabase();

  return new Promise(
    function(resolve, reject) {

      const tx =
        database.transaction(
          STORE_DATA,
          "readonly"
        );

      const request =
        tx
          .objectStore(
            STORE_DATA
          )
          .get(key);

      request.onsuccess =
        function() {

          resolve(
            request.result
              ? request.result.value
              : null
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
   QUEUE ADD
   ========================================================= */

async function queueAdd(item) {

  const database =
    await initDatabase();

  return new Promise(
    function(resolve, reject) {

      const tx =
        database.transaction(
          STORE_QUEUE,
          "readwrite"
        );

      tx
        .objectStore(
          STORE_QUEUE
        )
        .put(item);

      tx.oncomplete =
        function() {

          resolve(true);

        };

      tx.onerror =
        function() {

          reject(
            tx.error
          );

        };

    }
  );

}


/* =========================================================
   QUEUE GET ALL
   ========================================================= */

async function queueGetAll() {

  const database =
    await initDatabase();

  return new Promise(
    function(resolve, reject) {

      const tx =
        database.transaction(
          STORE_QUEUE,
          "readonly"
        );

      const request =
        tx
          .objectStore(
            STORE_QUEUE
          )
          .getAll();

      request.onsuccess =
        function() {

          const data =
            request.result || [];

          data.sort(
            function(a, b) {

              return (
                Number(a.createdAt || 0) -
                Number(b.createdAt || 0)
              );

            }
          );

          resolve(data);

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
   QUEUE DELETE
   ========================================================= */

async function queueDelete(id) {

  const database =
    await initDatabase();

  return new Promise(
    function(resolve, reject) {

      const tx =
        database.transaction(
          STORE_QUEUE,
          "readwrite"
        );

      tx
        .objectStore(
          STORE_QUEUE
        )
        .delete(id);

      tx.oncomplete =
        function() {

          resolve(true);

        };

      tx.onerror =
        function() {

          reject(
            tx.error
          );

        };

    }
  );

}


/* =========================================================
   LOCAL LOAD
   ========================================================= */

async function loadLocalData() {

  await initDatabase();

  const transaksi =
    await dbGet(
      "transaksi"
    );

  const barang =
    await dbGet(
      "barang"
    );

  const penjualan =
    await dbGet(
      "penjualan"
    );

  const dashboard =
    await dbGet(
      "dashboard"
    );


  if (
    Array.isArray(transaksi)
  ) {

    localData.transaksi =
      transaksi;

  }

  if (
    Array.isArray(barang)
  ) {

    localData.barang =
      barang;

  }

  if (
    Array.isArray(penjualan)
  ) {

    localData.penjualan =
      penjualan;

  }

  if (
    dashboard &&
    typeof dashboard ===
    "object"
  ) {

    localData.dashboard =
      dashboard;

  }


  renderAll();

}


/* =========================================================
   LOCAL SAVE
   ========================================================= */

async function saveLocalData() {

  await Promise.all([

    dbPut(
      "transaksi",
      localData.transaksi
    ),

    dbPut(
      "barang",
      localData.barang
    ),

    dbPut(
      "penjualan",
      localData.penjualan
    ),

    dbPut(
      "dashboard",
      localData.dashboard
    )

  ]);

}


/* =========================================================
   ID FRONTEND
   ========================================================= */

function uid(prefix) {

  const now =
    Date.now();

  const random =
    Math.random()
      .toString(36)
      .substring(2, 10);

  return (
    prefix +
    "-" +
    now +
    "-" +
    random
  );

}


/* =========================================================
   FORMAT RUPIAH
   ========================================================= */

function rupiah(value) {

  const number =
    Number(value) || 0;

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(number);

}


/* =========================================================
   NUMBER
   ========================================================= */

function num(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;

  }

  const n =
    Number(
      String(value)
        .replace(/[^\d.-]/g, "")
    );

  return isFinite(n)
    ? n
    : 0;

}


/* =========================================================
   TODAY
   ========================================================= */

function today() {

  const d =
    new Date();

  const y =
    d.getFullYear();

  const m =
    String(
      d.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      d.getDate()
    ).padStart(2, "0");

  return (
    y +
    "-" +
    m +
    "-" +
    day
  );

}


/* =========================================================
   ONLINE CHECK
   ========================================================= */

function isOnline() {

  return (
    navigator.onLine
  );

}


/* =========================================================
   STATUS
   ========================================================= */

function setSyncStatus(
  text,
  type
) {

  const elements =
    document.querySelectorAll(
      "[data-sync-status]"
    );

  elements.forEach(
    function(el) {

      el.textContent =
        text;

      el.dataset.status =
        type || "";

    }
  );


  const single =
    document.getElementById(
      "syncStatus"
    );

  if (single) {

    single.textContent =
      text;

  }

}


/* =========================================================
   API GET
   ========================================================= */

async function apiGet(
  action
) {

  if (
    !GAS_URL ||
    GAS_URL.indexOf(
      "GANTI_DENGAN"
    ) === 0
  ) {

    throw new Error(
      "GAS_URL belum diisi"
    );

  }


  const url =
    GAS_URL +
    "?action=" +
    encodeURIComponent(
      action
    );


  const response =
    await fetch(
      url,
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


  const data =
    await response.json();


  if (
    data &&
    data.success === false
  ) {

    throw new Error(
      data.error ||
      "GAS error"
    );

  }


  return data;

}


/* =========================================================
   API POST
   ========================================================= */

async function apiPost(
  action,
  data
) {

  if (
    !GAS_URL ||
    GAS_URL.indexOf(
      "GANTI_DENGAN"
    ) === 0
  ) {

    throw new Error(
      "GAS_URL belum diisi"
    );

  }


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
          JSON.stringify({

            action: action,

            data: data

          }),

        cache: "no-store"

      }
    );


  if (!response.ok) {

    throw new Error(
      "HTTP " +
      response.status
    );

  }


  const result =
    await response.json();


  if (
    result &&
    result.success === false
  ) {

    throw new Error(
      result.error ||
      "GAS error"
    );

  }


  return result;

}


/* =========================================================
   REFRESH DARI GAS
   ========================================================= */

async function refreshFromServer() {

  if (
    !isOnline()
  ) {

    return false;

  }


  setSyncStatus(
    "Mengambil data...",
    "loading"
  );


  try {

    const response =
      await apiGet(
        "appData"
      );


    if (
      !response.data
    ) {

      throw new Error(
        "Data GAS kosong"
      );

    }


    localData.transaksi =
      Array.isArray(
        response.data.transaksi
      )
        ? response.data.transaksi
        : [];


    localData.barang =
      Array.isArray(
        response.data.barang
      )
        ? response.data.barang
        : [];


    localData.penjualan =
      Array.isArray(
        response.data.penjualan
      )
        ? response.data.penjualan
        : [];


    localData.dashboard =
      response.data.dashboard ||
      calculateDashboard();


    await saveLocalData();


    renderAll();


    setSyncStatus(
      "Tersinkron",
      "success"
    );


    return true;

  }
  catch (error) {

    console.error(
      "Refresh error:",
      error
    );

    setSyncStatus(
      "Offline / gagal",
      "error"
    );

    return false;

  }

}


/* =========================================================
   TAMBAH QUEUE
   ========================================================= */

async function addToQueue(
  type,
  data
) {

  await initDatabase();


  const item = {

    id:
      uid("SYNC"),

    type:
      type,

    data:
      data,

    createdAt:
      Date.now(),

    retry:
      0

  };


  await queueAdd(
    item
  );


  setSyncStatus(
    "Tersimpan di HP",
    "offline"
  );


  return item;

}


/* =========================================================
   SIMPAN TRANSAKSI
   ========================================================= */

async function saveTransaksi(
  data
) {

  const transaksi = {

    id:
      data.id ||
      uid("TRX"),

    tanggal:
      data.tanggal ||
      today(),

    jenis:
      String(
        data.jenis || ""
      )
      .toLowerCase(),

    kategori:
      data.kategori || "",

    keterangan:
      data.keterangan || "",

    jumlah:
      num(data.jumlah),

    sumber:
      data.sumber ||
      "toko",

    createdAt:
      data.createdAt ||
      new Date().toISOString()

  };


  if (
    transaksi.jenis !==
      "masuk" &&
    transaksi.jenis !==
      "keluar"
  ) {

    throw new Error(
      "Jenis transaksi tidak valid"
    );

  }


  if (
    transaksi.jumlah <= 0
  ) {

    throw new Error(
      "Jumlah harus lebih dari 0"
    );

  }


  const exists =
    localData.transaksi.some(
      function(item) {

        return (
          String(item.id) ===
          String(transaksi.id)
        );

      }
    );


  if (
    exists
  ) {

    return {

      success: true,

      duplicate: true,

      data:
        transaksi

    };

  }


  localData.transaksi.unshift(
    transaksi
  );


  calculateAndSetDashboard();


  await saveLocalData();


  await addToQueue(
    "transaksi",
    transaksi
  );


  renderAll();


  if (
    isOnline()
  ) {

    syncQueue();

  }


  return {

    success: true,

    created: true,

    data:
      transaksi

  };

}


/* =========================================================
   SIMPAN BARANG
   ========================================================= */

async function saveBarang(
  data
) {

  const barang = {

    id:
      data.id ||
      uid("BRG"),

    kode:
      data.kode ||
      "",

    nama:
      String(
        data.nama || ""
      ).trim(),

    stok:
      num(data.stok),

    hargaModal:
      num(data.hargaModal),

    hargaJual:
      num(data.hargaJual),

    terjual:
      num(data.terjual),

    omzet:
      num(data.omzet),

    untung:
      num(data.untung),

    stokMin:
      num(data.stokMin),

    updatedAt:
      new Date().toISOString()

  };


  if (
    !barang.nama
  ) {

    throw new Error(
      "Nama barang wajib diisi"
    );

  }


  const exists =
    localData.barang.some(
      function(item) {

        return (
          String(item.id) ===
          String(barang.id)
        );

      }
    );


  if (
    exists
  ) {

    return updateBarang(
      barang
    );

  }


  /*
    Kode lokal dibuat sementara.
    GAS akan membuat kode resmi bila
    kode masih kosong.
  */

  if (
    !barang.kode
  ) {

    barang.kode =
      generateLocalCode();

  }


  localData.barang.unshift(
    barang
  );


  calculateAndSetDashboard();


  await saveLocalData();


  await addToQueue(
    "barang",
    barang
  );


  renderAll();


  if (
    isOnline()
  ) {

    syncQueue();

  }


  return {

    success: true,

    created: true,

    data:
      barang

  };

}


/* =========================================================
   KODE LOKAL
   ========================================================= */

function generateLocalCode() {

  let terbesar =
    0;

  localData.barang.forEach(
    function(item) {

      const kode =
        String(
          item.kode || ""
        )
        .toUpperCase();

      const match =
        kode.match(
          /^BRG-(\d+)$/
        );

      if (
        match
      ) {

        terbesar =
          Math.max(
            terbesar,
            Number(
              match[1]
            )
          );

      }

    }
  );


  return (
    "BRG-" +
    String(
      terbesar + 1
    ).padStart(
      4,
      "0"
    )
  );

}


/* =========================================================
   UPDATE BARANG
   ========================================================= */

async function updateBarang(
  data
) {

  if (
    !data ||
    !data.id
  ) {

    throw new Error(
      "ID barang wajib"
    );

  }


  const index =
    localData.barang.findIndex(
      function(item) {

        return (
          String(item.id) ===
          String(data.id)
        );

      }
    );


  if (
    index === -1
  ) {

    throw new Error(
      "Barang tidak ditemukan"
    );

  }


  const old =
    localData.barang[index];


  const updated = {

    ...old,

    ...data,

    id:
      old.id,

    kode:
      data.kode !== undefined
        ? String(data.kode)
        : old.kode,

    nama:
      data.nama !== undefined
        ? String(data.nama).trim()
        : old.nama,

    stok:
      data.stok !== undefined
        ? num(data.stok)
        : num(old.stok),

    hargaModal:
      data.hargaModal !== undefined
        ? num(data.hargaModal)
        : num(old.hargaModal),

    hargaJual:
      data.hargaJual !== undefined
        ? num(data.hargaJual)
        : num(old.hargaJual),

    terjual:
      data.terjual !== undefined
        ? num(data.terjual)
        : num(old.terjual),

    omzet:
      data.omzet !== undefined
        ? num(data.omzet)
        : num(old.omzet),

    untung:
      data.untung !== undefined
        ? num(data.untung)
        : num(old.untung),

    stokMin:
      data.stokMin !== undefined
        ? num(data.stokMin)
        : num(old.stokMin),

    updatedAt:
      new Date().toISOString()

  };


  if (
    !updated.nama
  ) {

    throw new Error(
      "Nama barang wajib"
    );

  }


  localData.barang[index] =
    updated;


  calculateAndSetDashboard();


  await saveLocalData();


  await addToQueue(
    "updateBarang",
    updated
  );


  renderAll();


  if (
    isOnline()
  ) {

    syncQueue();

  }


  return {

    success: true,

    updated: true,

    data:
      updated

  };

}


/* =========================================================
   PENJUALAN
   ========================================================= */

async function savePenjualan(
  data
) {

  if (
    !data.barangId
  ) {

    throw new Error(
      "Pilih barang"
    );

  }


  const qty =
    num(data.qty);


  if (
    qty <= 0
  ) {

    throw new Error(
      "Qty harus lebih dari 0"
    );

  }


  const index =
    localData.barang.findIndex(
      function(item) {

        return (
          String(item.id) ===
          String(data.barangId)
        );

      }
    );


  if (
    index === -1
  ) {

    throw new Error(
      "Barang tidak ditemukan"
    );

  }


  const barang =
    localData.barang[index];


  if (
    qty >
    num(barang.stok)
  ) {

    throw new Error(
      "Stok tidak cukup. Tersedia " +
      barang.stok
    );

  }


  const hargaModal =
    data.hargaModal !== undefined
      ? num(data.hargaModal)
      : num(barang.hargaModal);


  const hargaJual =
    data.hargaJual !== undefined
      ? num(data.hargaJual)
      : num(barang.hargaJual);


  const omzet =
    qty *
    hargaJual;

  const modal =
    qty *
    hargaModal;

  const untung =
    omzet -
    modal;


  const penjualan = {

    id:
      data.id ||
      uid("JUAL"),

    tanggal:
      data.tanggal ||
      today(),

    barangId:
      String(data.barangId),

    namaBarang:
      barang.nama,

    qty:
      qty,

    hargaModal:
      hargaModal,

    hargaJual:
      hargaJual,

    omzet:
      omzet,

    modal:
      modal,

    untung:
      untung,

    createdAt:
      data.createdAt ||
      new Date().toISOString()

  };


  /*
    Cegah ID penjualan yang sama.
  */

  const duplicate =
    localData.penjualan.some(
      function(item) {

        return (
          String(item.id) ===
          String(penjualan.id)
        );

      }
    );


  if (
    duplicate
  ) {

    return {

      success: true,

      duplicate: true,

      data:
        penjualan

    };

  }


  /*
    UPDATE LOKAL
  */

  barang.stok =
    num(barang.stok) -
    qty;

  barang.terjual =
    num(barang.terjual) +
    qty;

  barang.omzet =
    num(barang.omzet) +
    omzet;

  barang.untung =
    num(barang.untung) +
    untung;

  barang.updatedAt =
    new Date().toISOString();


  localData.penjualan.unshift(
    penjualan
  );


  calculateAndSetDashboard();


  await saveLocalData();


  await addToQueue(
    "penjualan",
    penjualan
  );


  renderAll();


  if (
    isOnline()
  ) {

    syncQueue();

  }


  return {

    success: true,

    created: true,

    data:
      penjualan

  };

}


/* =========================================================
   DASHBOARD LOKAL
   ========================================================= */

function calculateDashboard() {

  let uangMasuk = 0;
  let uangKeluar = 0;

  let omzet = 0;
  let modal = 0;
  let untung = 0;

  let jumlahBarang =
    localData.barang.length;

  let jumlahStok = 0;
  let nilaiStok = 0;

  let jumlahPenjualan =
    localData.penjualan.length;

  let totalTerjual = 0;


  localData.transaksi.forEach(
    function(item) {

      const jumlah =
        num(item.jumlah);

      if (
        String(item.jenis)
          .toLowerCase() ===
        "masuk"
      ) {

        uangMasuk +=
          jumlah;

      }

      else if (
        String(item.jenis)
          .toLowerCase() ===
        "keluar"
      ) {

        uangKeluar +=
          jumlah;

      }

    }
  );


  localData.penjualan.forEach(
    function(item) {

      totalTerjual +=
        num(item.qty);

      omzet +=
        num(item.omzet);

      modal +=
        num(item.modal);

      untung +=
        num(item.untung);

    }
  );


  localData.barang.forEach(
    function(item) {

      const stok =
        num(item.stok);

      jumlahStok +=
        stok;

      nilaiStok +=
        stok *
        num(item.hargaModal);

    }
  );


  return {

    uangMasuk:
      uangMasuk,

    uangKeluar:
      uangKeluar,

    saldo:
      uangMasuk -
      uangKeluar,

    omzet:
      omzet,

    modal:
      modal,

    untung:
      untung,

    jumlahBarang:
      jumlahBarang,

    jumlahStok:
      jumlahStok,

    nilaiStok:
      nilaiStok,

    jumlahPenjualan:
      jumlahPenjualan,

    totalTerjual:
      totalTerjual

  };

}


/* =========================================================
   SET DASHBOARD
   ========================================================= */

function calculateAndSetDashboard() {

  localData.dashboard =
    calculateDashboard();

}


/* =========================================================
   SYNC QUEUE
   ========================================================= */

let syncing =
  false;


async function syncQueue() {

  if (
    syncing
  ) {

    return;

  }


  if (
    !isOnline()
  ) {

    setSyncStatus(
      "Offline",
      "offline"
    );

    return;

  }


  const queue =
    await queueGetAll();


  if (
    queue.length === 0
  ) {

    setSyncStatus(
      "Tersinkron",
      "success"
    );

    return;

  }


  syncing =
    true;


  setSyncStatus(
    "Sinkronisasi...",
    "loading"
  );


  try {

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
            JSON.stringify({

              action:
                "sync",

              items:
                queue

            }),

          cache:
            "no-store"

        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const result =
      await response.json();


    if (
      !result ||
      result.success === false
    ) {

      throw new Error(
        result &&
        result.error
          ? result.error
          : "Sync gagal"
      );

    }


    const results =
      Array.isArray(
        result.results
      )
        ? result.results
        : [];


    /*
      Hapus hanya queue yang sukses.

      Yang gagal tetap berada di IndexedDB
      supaya bisa dicoba lagi.
    */

    for (
      const itemResult of results
    ) {

      if (
        itemResult.success
      ) {

        await queueDelete(
          itemResult.id
        );

      }

    }


    setSyncStatus(
      "Tersinkron " +
      result.berhasil +
      "/" +
      result.total,
      "success"
    );


    /*
      Setelah server menerima data,
      ambil database server terbaru.
    */

    await refreshFromServer();


  }
  catch (error) {

    console.error(
      "Sync gagal:",
      error
    );

    setSyncStatus(
      "Menunggu koneksi",
      "offline"
    );

  }
  finally {

    syncing =
      false;

  }

}


/* =========================================================
   MANUAL SYNC
   ========================================================= */

async function manualSync() {

  if (
    !isOnline()
  ) {

    setSyncStatus(
      "Tidak ada internet",
      "offline"
    );

    return;

  }


  await syncQueue();

}


/* =========================================================
   LOAD AWAL
   ========================================================= */

async function initApp() {

  try {

    setSyncStatus(
      "Menyiapkan database...",
      "loading"
    );


    /*
      WAJIB:

      IndexedDB harus selesai
      sebelum aplikasi membaca/menulis.
    */

    await initDatabase();


    await loadLocalData();


    setSyncStatus(
      "Siap",
      "success"
    );


    /*
      Kalau online:
      1. kirim queue
      2. ambil server terbaru
    */

    if (
      isOnline()
    ) {

      await syncQueue();

    }

  }
  catch (error) {

    console.error(
      "CATATKU INIT ERROR:",
      error
    );

    setSyncStatus(
      "Database gagal",
      "error"
    );

    alert(
      "Database lokal CatatKu gagal dibuka.\n\n" +
      error.message
    );

  }

}


/* =========================================================
   ONLINE
   ========================================================= */

window.addEventListener(
  "online",
  function() {

    setSyncStatus(
      "Internet kembali",
      "loading"
    );

    syncQueue();

  }
);


/* =========================================================
   OFFLINE
   ========================================================= */

window.addEventListener(
  "offline",
  function() {

    setSyncStatus(
      "Offline",
      "offline"
    );

  }
);


/* =========================================================
   RENDER SEMUA
   ========================================================= */

function renderAll() {

  renderDashboard();

  renderBarang();

  renderPenjualan();

  renderTransaksi();

}


/* =========================================================
   RENDER DASHBOARD
   ========================================================= */

function renderDashboard() {

  const d =
    localData.dashboard;


  setText(
    [
      "saldo",
      "dashboardSaldo"
    ],
    rupiah(d.saldo)
  );


  setText(
    [
      "uangMasuk",
      "dashboardUangMasuk"
    ],
    rupiah(d.uangMasuk)
  );


  setText(
    [
      "uangKeluar",
      "dashboardUangKeluar"
    ],
    rupiah(d.uangKeluar)
  );


  setText(
    [
      "omzet",
      "dashboardOmzet"
    ],
    rupiah(d.omzet)
  );


  setText(
    [
      "modal",
      "dashboardModal"
    ],
    rupiah(d.modal)
  );


  setText(
    [
      "untung",
      "dashboardUntung"
    ],
    rupiah(d.untung)
  );


  setText(
    [
      "jumlahBarang",
      "dashboardJumlahBarang"
    ],
    d.jumlahBarang
  );


  setText(
    [
      "jumlahStok",
      "dashboardJumlahStok"
    ],
    d.jumlahStok
  );


  setText(
    [
      "nilaiStok",
      "dashboardNilaiStok"
    ],
    rupiah(d.nilaiStok)
  );


  setText(
    [
      "jumlahPenjualan",
      "dashboardJumlahPenjualan"
    ],
    d.jumlahPenjualan
  );


  setText(
    [
      "totalTerjual",
      "dashboardTotalTerjual"
    ],
    d.totalTerjual
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
    function(id) {

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
   RENDER BARANG
   ========================================================= */

function renderBarang() {

  const containers =
    document.querySelectorAll(
      "[data-barang-list]"
    );


  containers.forEach(
    function(container) {

      container.innerHTML = "";


      localData.barang.forEach(
        function(item) {

          const div =
            document.createElement(
              "div"
            );

          div.className =
            "barang-item";


          div.innerHTML = `

            <div>
              <strong>
                ${escapeHtml(item.nama)}
              </strong>

              <div>
                ${escapeHtml(item.kode || "")}
              </div>
            </div>

            <div>
              Stok:
              <strong>
                ${num(item.stok)}
              </strong>
            </div>

            <div>
              Modal:
              ${rupiah(item.hargaModal)}
            </div>

            <div>
              Jual:
              ${rupiah(item.hargaJual)}
            </div>

          `;


          container.appendChild(
            div
          );

        }
      );

    }
  );

}


/* =========================================================
   RENDER PENJUALAN
   ========================================================= */

function renderPenjualan() {

  const containers =
    document.querySelectorAll(
      "[data-penjualan-list]"
    );


  containers.forEach(
    function(container) {

      container.innerHTML = "";


      localData.penjualan.forEach(
        function(item) {

          const div =
            document.createElement(
              "div"
            );

          div.className =
            "penjualan-item";


          div.innerHTML = `

            <strong>
              ${escapeHtml(item.namaBarang)}
            </strong>

            <div>
              ${item.tanggal}
            </div>

            <div>
              ${item.qty} ×
              ${rupiah(item.hargaJual)}
            </div>

            <strong>
              ${rupiah(item.omzet)}
            </strong>

          `;


          container.appendChild(
            div
          );

        }
      );

    }
  );

}


/* =========================================================
   RENDER TRANSAKSI
   ========================================================= */

function renderTransaksi() {

  const containers =
    document.querySelectorAll(
      "[data-transaksi-list]"
    );


  containers.forEach(
    function(container) {

      container.innerHTML = "";


      localData.transaksi.forEach(
        function(item) {

          const div =
            document.createElement(
              "div"
            );

          div.className =
            "transaksi-item";


          const tanda =
            String(item.jenis)
              .toLowerCase() ===
              "masuk"
                ? "+"
                : "-";


          div.innerHTML = `

            <strong>
              ${escapeHtml(
                item.keterangan ||
                item.kategori ||
                "Transaksi"
              )}
            </strong>

            <div>
              ${item.tanggal}
            </div>

            <strong>
              ${tanda}
              ${rupiah(item.jumlah)}
            </strong>

          `;


          container.appendChild(
            div
          );

        }
      );

    }
  );

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

  return String(
    value === undefined ||
    value === null
      ? ""
      : value
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
   FORM HELPER
   ========================================================= */

function valueOf(id) {

  const el =
    document.getElementById(id);

  return el
    ? el.value
    : "";

}


/* =========================================================
   FORM TRANSAKSI
   ========================================================= */

async function submitTransaksiForm(
  event
) {

  if (
    event
  ) {

    event.preventDefault();

  }


  try {

    await saveTransaksi({

      tanggal:
        valueOf("tanggal"),

      jenis:
        valueOf("jenis"),

      kategori:
        valueOf("kategori"),

      keterangan:
        valueOf("keterangan"),

      jumlah:
        valueOf("jumlah"),

      sumber:
        valueOf("sumber") ||
        "toko"

    });


    if (
      event &&
      event.target &&
      typeof event.target.reset ===
      "function"
    ) {

      event.target.reset();

    }


    alert(
      "Transaksi tersimpan"
    );

  }
  catch (error) {

    alert(
      error.message
    );

  }

}


/* =========================================================
   FORM BARANG
   ========================================================= */

async function submitBarangForm(
  event
) {

  if (
    event
  ) {

    event.preventDefault();

  }


  try {

    await saveBarang({

      nama:
        valueOf("nama"),

      stok:
        valueOf("stok"),

      hargaModal:
        valueOf("hargaModal"),

      hargaJual:
        valueOf("hargaJual"),

      stokMin:
        valueOf("stokMin")

    });


    if (
      event &&
      event.target &&
      typeof event.target.reset ===
      "function"
    ) {

      event.target.reset();

    }


    alert(
      "Barang tersimpan"
    );

  }
  catch (error) {

    alert(
      error.message
    );

  }

}


/* =========================================================
   FORM PENJUALAN
   ========================================================= */

async function submitPenjualanForm(
  event
) {

  if (
    event
  ) {

    event.preventDefault();

  }


  try {

    await savePenjualan({

      barangId:
        valueOf("barangId"),

      qty:
        valueOf("qty"),

      hargaJual:
        valueOf("hargaJual")

    });


    if (
      event &&
      event.target &&
      typeof event.target.reset ===
      "function"
    ) {

      event.target.reset();

    }


    alert(
      "Penjualan tersimpan"
    );

  }
  catch (error) {

    alert(
      error.message
    );

  }

}


/* =========================================================
   AUTO BIND FORM
   ========================================================= */

function bindForms() {

  const transaksiForm =
    document.getElementById(
      "formTransaksi"
    );

  if (
    transaksiForm
  ) {

    transaksiForm.addEventListener(
      "submit",
      submitTransaksiForm
    );

  }


  const barangForm =
    document.getElementById(
      "formBarang"
    );

  if (
    barangForm
  ) {

    barangForm.addEventListener(
      "submit",
      submitBarangForm
    );

  }


  const penjualanForm =
    document.getElementById(
      "formPenjualan"
    );

  if (
    penjualanForm
  ) {

    penjualanForm.addEventListener(
      "submit",
      submitPenjualanForm
    );

  }


  const syncButtons =
    document.querySelectorAll(
      "[data-sync]"
    );


  syncButtons.forEach(
    function(button) {

      button.addEventListener(
        "click",
        function() {

          manualSync();

        }
      );

    }
  );

}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.CatatKu = {

  db:
    function() {
      return initDatabase();
    },

  data:
    localData,

  transaksi:
    saveTransaksi,

  barang:
    saveBarang,

  updateBarang:
    updateBarang,

  penjualan:
    savePenjualan,

  sync:
    manualSync,

  refresh:
    refreshFromServer,

  dashboard:
    calculateDashboard,

  rupiah:
    rupiah

};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async function() {

    bindForms();

    await initApp();

  }
);
