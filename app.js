/* =========================================================
   CATATKU
   app.js

   DATABASE UTAMA :
   Google Sheets melalui Google Apps Script

   OFFLINE :
   IndexedDB

   FITUR :
   - Uang masuk
   - Uang keluar
   - Barang
   - Stok
   - Penjualan
   - Omzet
   - Untung
   - Offline save
   - Auto sync
   - Dashboard
   ========================================================= */

"use strict";


/* =========================================================
   KONFIGURASI
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbwBeouN8uOCNNrWiV5exaTyf_QcycY-eLMtgqg8VdDfmYofavL7OPFTyOifoQELADSr/exec";


const DB_NAME =
  "CATATKU_DB";


const DB_VERSION =
  1;


const STORES = {

  transaksi: "transaksi",

  barang: "barang",

  penjualan: "penjualan",

  queue: "sync_queue"

};


let dbPromise = null;


/* =========================================================
   STATUS APLIKASI
   ========================================================= */

const APP_STATE = {

  online:
    navigator.onLine,

  syncing:
    false

};


/* =========================================================
   UTILITAS
   ========================================================= */

function uid(prefix = "ID") {

  const now =
    Date.now().toString(36);

  const random =
    Math.random()
      .toString(36)
      .substring(2, 8);

  return (
    prefix +
    "-" +
    now +
    "-" +
    random
  ).toUpperCase();

}


function rupiah(value) {

  const number =
    Number(value || 0);

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(number);

}


function number(value) {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : 0;

}


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


function nowISO() {

  return new Date()
    .toISOString();

}


function escapeHTML(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   INDEXED DB
   ========================================================= */

function openDB() {

  if (dbPromise) {

    return dbPromise;

  }


  dbPromise =
    new Promise(
      (resolve, reject) => {

        if (!window.indexedDB) {

          reject(
            new Error(
              "Browser tidak mendukung IndexedDB"
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
              !db.objectStoreNames
                .contains(
                  STORES.transaksi
                )
            ) {

              const store =
                db.createObjectStore(
                  STORES.transaksi,
                  {
                    keyPath: "id"
                  }
                );

              store.createIndex(
                "tanggal",
                "tanggal",
                {
                  unique: false
                }
              );

            }


            if (
              !db.objectStoreNames
                .contains(
                  STORES.barang
                )
            ) {

              const store =
                db.createObjectStore(
                  STORES.barang,
                  {
                    keyPath: "id"
                  }
                );

              store.createIndex(
                "nama",
                "nama",
                {
                  unique: false
                }
              );

            }


            if (
              !db.objectStoreNames
                .contains(
                  STORES.penjualan
                )
            ) {

              const store =
                db.createObjectStore(
                  STORES.penjualan,
                  {
                    keyPath: "id"
                  }
                );

              store.createIndex(
                "tanggal",
                "tanggal",
                {
                  unique: false
                }
              );

            }


            if (
              !db.objectStoreNames
                .contains(
                  STORES.queue
                )
            ) {

              const store =
                db.createObjectStore(
                  STORES.queue,
                  {
                    keyPath: "id"
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

            const db =
              event.target.result;


            db.onversionchange =
              function() {

                db.close();

              };


            resolve(db);

          };


        request.onerror =
          function() {

            dbPromise = null;

            reject(
              request.error ||
              new Error(
                "Gagal membuka IndexedDB"
              )
            );

          };


        request.onblocked =
          function() {

            console.warn(
              "IndexedDB sedang diblokir"
            );

          };

      }
    );


  return dbPromise;

}


/* =========================================================
   DATABASE HELPER
   ========================================================= */

async function dbPut(
  storeName,
  data
) {

  const db =
    await openDB();


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readwrite"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.put(data);


      request.onsuccess =
        () => resolve(data);


      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}


async function dbGet(
  storeName,
  id
) {

  const db =
    await openDB();


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readonly"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.get(id);


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


async function dbDelete(
  storeName,
  id
) {

  const db =
    await openDB();


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readwrite"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.delete(id);


      request.onsuccess =
        () =>
          resolve(true);


      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}


async function dbGetAll(
  storeName
) {

  const db =
    await openDB();


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readonly"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.getAll();


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


async function dbClear(
  storeName
) {

  const db =
    await openDB();


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readwrite"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.clear();


      request.onsuccess =
        () =>
          resolve(true);


      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}


/* =========================================================
   SYNC QUEUE
   ========================================================= */

async function queueAdd(
  type,
  data
) {

  const item = {

    id:
      uid("SYNC"),

    type:
      type,

    data:
      data,

    createdAt:
      nowISO(),

    attempts:
      0

  };


  await dbPut(
    STORES.queue,
    item
  );


  updateSyncStatus();

  return item;

}


/* =========================================================
   JUMLAH ANTRIAN
   ========================================================= */

async function getQueueCount() {

  const items =
    await dbGetAll(
      STORES.queue
    );

  return items.length;

}


/* =========================================================
   KIRIM KE GAS
   ========================================================= */

async function postGAS(
  action,
  data
) {

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
              action,

            data:
              data
          })
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


  if (!result.success) {

    throw new Error(
      result.error ||
      "GAS gagal memproses data"
    );

  }


  return result;

}


/* =========================================================
   GET GAS
   ========================================================= */

async function getGAS(
  action
) {

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


  const result =
    await response.json();


  if (!result.success) {

    throw new Error(
      result.error ||
      "GAS gagal"
    );

  }


  return result;

}


/* =========================================================
   TEST KONEKSI
   ========================================================= */

async function testGAS() {

  try {

    const result =
      await getGAS(
        "ping"
      );


    console.log(
      "GAS:",
      result
    );


    setDatabaseStatus(
      "online",
      "Google Sheets terhubung"
    );


    return true;

  }

  catch (error) {

    console.error(
      "GAS:",
      error
    );


    setDatabaseStatus(
      "offline",
      "Google Sheets tidak terhubung"
    );


    return false;

  }

}


/* =========================================================
   STATUS DATABASE
   ========================================================= */

function setDatabaseStatus(
  type,
  text
) {

  const elements = [

    document.getElementById(
      "dbStatus"
    ),

    document.getElementById(
      "databaseStatus"
    )

  ];


  elements.forEach(
    function(el) {

      if (!el) return;

      el.textContent =
        text;

      el.dataset.status =
        type;

    }
  );

}


/* =========================================================
   STATUS ONLINE
   ========================================================= */

function updateOnlineStatus() {

  APP_STATE.online =
    navigator.onLine;


  const elements = [

    document.getElementById(
      "connectionStatus"
    ),

    document.getElementById(
      "onlineStatus"
    ),

    document.getElementById(
      "networkStatus"
    )

  ];


  elements.forEach(
    function(el) {

      if (!el) return;


      if (
        APP_STATE.online
      ) {

        el.textContent =
          "ONLINE";

        el.dataset.status =
          "online";

      }

      else {

        el.textContent =
          "OFFLINE";

        el.dataset.status =
          "offline";

      }

    }
  );


  if (
    APP_STATE.online
  ) {

    setDatabaseStatus(
      "checking",
      "Mengecek Google Sheets..."
    );


    testGAS()
      .then(
        function(ok) {

          if (ok) {

            syncQueue();

          }

        }
      );

  }

  else {

    setDatabaseStatus(
      "offline",
      "Offline — data disimpan di perangkat"
    );

  }


  updateSyncStatus();

}


window.addEventListener(
  "online",
  updateOnlineStatus
);


window.addEventListener(
  "offline",
  updateOnlineStatus
);


/* =========================================================
   STATUS SYNC
   ========================================================= */

async function updateSyncStatus() {

  try {

    const count =
      await getQueueCount();


    const elements = [

      document.getElementById(
        "syncStatus"
      ),

      document.getElementById(
        "syncBadge"
      )

    ];


    elements.forEach(
      function(el) {

        if (!el) return;


        if (count === 0) {

          el.textContent =
            "✓ Tersinkron";

          el.dataset.status =
            "synced";

        }

        else {

          el.textContent =
            count +
            " menunggu sync";

          el.dataset.status =
            "pending";

        }

      }
    );

  }

  catch (error) {

    console.warn(
      "Sync status:",
      error
    );

  }

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
      data.jenis,

    kategori:
      data.kategori ||
      "",

    keterangan:
      data.keterangan ||
      "",

    jumlah:
      number(
        data.jumlah
      ),

    sumber:
      data.sumber ||
      "toko",

    createdAt:
      data.createdAt ||
      nowISO()

  };


  if (
    transaksi.jenis !== "masuk" &&
    transaksi.jenis !== "keluar"
  ) {

    throw new Error(
      "Jenis harus masuk atau keluar"
    );

  }


  if (
    transaksi.jumlah <= 0
  ) {

    throw new Error(
      "Jumlah harus lebih dari 0"
    );

  }


  /* -------------------------------------------------------
     SIMPAN LOKAL DULU
     ------------------------------------------------------- */

  await dbPut(
    STORES.transaksi,
    transaksi
  );


  /* -------------------------------------------------------
     MASUK QUEUE
     ------------------------------------------------------- */

  await queueAdd(
    "transaksi",
    transaksi
  );


  /* -------------------------------------------------------
     COBA SYNC
     ------------------------------------------------------- */

  if (
    navigator.onLine
  ) {

    await syncQueue();

  }


  showToast(
    "Transaksi tersimpan"
  );


  return transaksi;

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
      data.nama ||
      "",

    stok:
      number(
        data.stok
      ),

    hargaModal:
      number(
        data.hargaModal
      ),

    hargaJual:
      number(
        data.hargaJual
      ),

    terjual:
      number(
        data.terjual
      ),

    omzet:
      number(
        data.omzet
      ),

    untung:
      number(
        data.untung
      ),

    stokMin:
      number(
        data.stokMin
      ),

    updatedAt:
      nowISO()

  };


  if (
    !barang.nama.trim()
  ) {

    throw new Error(
      "Nama barang wajib diisi"
    );

  }


  /* -------------------------------------------------------
     LOKAL
     ------------------------------------------------------- */

  await dbPut(
    STORES.barang,
    barang
  );


  /* -------------------------------------------------------
     QUEUE
     ------------------------------------------------------- */

  await queueAdd(
    "barang",
    barang
  );


  /* -------------------------------------------------------
     ONLINE
     ------------------------------------------------------- */

  if (
    navigator.onLine
  ) {

    await syncQueue();

  }


  showToast(
    "Barang tersimpan"
  );


  return barang;

}


/* =========================================================
   SIMPAN PENJUALAN
   ========================================================= */

async function savePenjualan(
  data
) {

  const barang =
    await dbGet(
      STORES.barang,
      data.barangId
    );


  if (!barang) {

    throw new Error(
      "Barang tidak ditemukan"
    );

  }


  const qty =
    number(
      data.qty
    );


  if (
    qty <= 0
  ) {

    throw new Error(
      "Jumlah penjualan tidak valid"
    );

  }


  if (
    qty > number(barang.stok)
  ) {

    throw new Error(
      "Stok tidak cukup. Stok tersedia: " +
      barang.stok
    );

  }


  const hargaModal =
    number(
      data.hargaModal !== undefined
        ? data.hargaModal
        : barang.hargaModal
    );


  const hargaJual =
    number(
      data.hargaJual !== undefined
        ? data.hargaJual
        : barang.hargaJual
    );


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
      barang.id,

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
      nowISO()

  };


  /* -------------------------------------------------------
     UPDATE BARANG LOKAL
     ------------------------------------------------------- */

  const barangBaru = {

    ...barang,

    stok:
      number(barang.stok) -
      qty,

    terjual:
      number(barang.terjual) +
      qty,

    omzet:
      number(barang.omzet) +
      omzet,

    untung:
      number(barang.untung) +
      untung,

    updatedAt:
      nowISO()

  };


  await dbPut(
    STORES.penjualan,
    penjualan
  );


  await dbPut(
    STORES.barang,
    barangBaru
  );


  /* -------------------------------------------------------
     QUEUE PENJUALAN
     ------------------------------------------------------- */

  await queueAdd(
    "penjualan",
    penjualan
  );


  /* -------------------------------------------------------
     ONLINE
     ------------------------------------------------------- */

  if (
    navigator.onLine
  ) {

    await syncQueue();

  }


  showToast(
    "Penjualan tersimpan"
  );


  return penjualan;

}


/* =========================================================
   SYNC QUEUE
   ========================================================= */

async function syncQueue() {

  if (
    APP_STATE.syncing
  ) {

    return;

  }


  if (
    !navigator.onLine
  ) {

    return;

  }


  APP_STATE.syncing =
    true;


  try {

    const queue =
      await dbGetAll(
        STORES.queue
      );


    if (
      queue.length === 0
    ) {

      updateSyncStatus();

      return;

    }


    for (
      const item of queue
    ) {

      try {

        let result;


        /* -------------------------------------------------
           POST SESUAI TIPE
           ------------------------------------------------- */

        if (
          item.type ===
          "transaksi"
        ) {

          result =
            await postGAS(
              "tambahTransaksi",
              item.data
            );

        }


        else if (
          item.type ===
          "barang"
        ) {

          result =
            await postGAS(
              "tambahBarang",
              item.data
            );

        }


        else if (
          item.type ===
          "penjualan"
        ) {

          result =
            await postGAS(
              "tambahPenjualan",
              item.data
            );

        }


        else {

          throw new Error(
            "Tipe queue tidak dikenal: " +
            item.type
          );

        }


        /* -------------------------------------------------
           BERHASIL
           ------------------------------------------------- */

        if (
          result &&
          result.success
        ) {

          await dbDelete(
            STORES.queue,
            item.id
          );

        }

      }

      catch (error) {

        console.warn(
          "Sync gagal:",
          item,
          error
        );


        item.attempts =
          number(
            item.attempts
          ) + 1;


        item.lastError =
          error.message;


        item.lastAttempt =
          nowISO();


        await dbPut(
          STORES.queue,
          item
        );


        /*
         * Jangan lanjut terlalu agresif.
         * Jika internet/GAS bermasalah,
         * biarkan queue tetap tersimpan.
         */

        break;

      }

    }

  }

  finally {

    APP_STATE.syncing =
      false;


    updateSyncStatus();

  }

}


/* =========================================================
   DOWNLOAD DATA DARI GOOGLE SHEETS
   ========================================================= */

async function downloadData() {

  if (
    !navigator.onLine
  ) {

    throw new Error(
      "Tidak ada internet"
    );

  }


  const result =
    await getGAS(
      "appData"
    );


  if (
    !result.data
  ) {

    throw new Error(
      "Data aplikasi kosong"
    );

  }


  const data =
    result.data;


  /* -------------------------------------------------------
     TRANSAKSI
     ------------------------------------------------------- */

  if (
    Array.isArray(
      data.transaksi
    )
  ) {

    for (
      const item of data.transaksi
    ) {

      await dbPut(
        STORES.transaksi,
        item
      );

    }

  }


  /* -------------------------------------------------------
     BARANG
     ------------------------------------------------------- */

  if (
    Array.isArray(
      data.barang
    )
  ) {

    for (
      const item of data.barang
    ) {

      await dbPut(
        STORES.barang,
        item
      );

    }

  }


  /* -------------------------------------------------------
     PENJUALAN
     ------------------------------------------------------- */

  if (
    Array.isArray(
      data.penjualan
    )
  ) {

    for (
      const item of data.penjualan
    ) {

      await dbPut(
        STORES.penjualan,
        item
      );

    }

  }


  console.log(
    "Data dari Google Sheets berhasil diambil"
  );


  await updateSyncStatus();


  return data;

}


/* =========================================================
   DASHBOARD DARI LOKAL
   ========================================================= */

async function getLocalDashboard() {

  const transaksi =
    await dbGetAll(
      STORES.transaksi
    );


  const barang =
    await dbGetAll(
      STORES.barang
    );


  const penjualan =
    await dbGetAll(
      STORES.penjualan
    );


  let uangMasuk =
    0;


  let uangKeluar =
    0;


  let omzet =
    0;


  let modal =
    0;


  let untung =
    0;


  let jumlahStok =
    0;


  let nilaiStok =
    0;


  transaksi.forEach(
    function(item) {

      const jumlah =
        number(
          item.jumlah
        );


      if (
        item.jenis ===
        "masuk"
      ) {

        uangMasuk +=
          jumlah;

      }


      if (
        item.jenis ===
        "keluar"
      ) {

        uangKeluar +=
          jumlah;

      }

    }
  );


  penjualan.forEach(
    function(item) {

      omzet +=
        number(
          item.omzet
        );

      modal +=
        number(
          item.modal
        );

      untung +=
        number(
          item.untung
        );

    }
  );


  barang.forEach(
    function(item) {

      const stok =
        number(
          item.stok
        );


      const hargaModal =
        number(
          item.hargaModal
        );


      jumlahStok +=
        stok;


      nilaiStok +=
        stok *
        hargaModal;

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
      barang.length,

    jumlahStok:
      jumlahStok,

    nilaiStok:
      nilaiStok

  };

}


/* =========================================================
   LOAD DASHBOARD
   ========================================================= */

async function loadDashboard() {

  try {

    const data =
      await getLocalDashboard();


    setText(
      "saldo",
      rupiah(
        data.saldo
      )
    );


    setText(
      "pemasukan",
      rupiah(
        data.uangMasuk
      )
    );


    setText(
      "pengeluaran",
      rupiah(
        data.uangKeluar
      )
    );


    setText(
      "nilaiStok",
      rupiah(
        data.nilaiStok
      )
    );


    setText(
      "totalHutang",
      "Rp0"
    );


    setText(
      "jumlahBarang",
      data.jumlahBarang
    );


    setText(
      "omzet",
      rupiah(
        data.omzet
      )
    );


    setText(
      "untung",
      rupiah(
        data.untung
      )
    );


    setText(
      "jumlahStok",
      data.jumlahStok
    );


    /* -----------------------------------------------------
       ID TAMBAHAN
       ----------------------------------------------------- */

    setText(
      "uangMasuk",
      rupiah(
        data.uangMasuk
      )
    );


    setText(
      "uangKeluar",
      rupiah(
        data.uangKeluar
      )
    );


  }

  catch (error) {

    console.error(
      "Dashboard:",
      error
    );

  }

}


/* =========================================================
   HELPER SET TEXT
   ========================================================= */

function setText(
  id,
  value
) {

  const el =
    document.getElementById(
      id
    );


  if (el) {

    el.textContent =
      value;

  }

}


/* =========================================================
   LOAD BARANG
   ========================================================= */

async function loadBarang() {

  const data =
    await dbGetAll(
      STORES.barang
    );


  return data
    .sort(
      function(a, b) {

        return String(
          a.nama || ""
        ).localeCompare(
          String(
            b.nama || ""
          ),
          "id"
        );

      }
    );

}


/* =========================================================
   LOAD TRANSAKSI
   ========================================================= */

async function loadTransaksi() {

  const data =
    await dbGetAll(
      STORES.transaksi
    );


  return data
    .sort(
      function(a, b) {

        return String(
          b.tanggal || ""
        ).localeCompare(
          String(
            a.tanggal || ""
          )
        );

      }
    );

}


/* =========================================================
   LOAD PENJUALAN
   ========================================================= */

async function loadPenjualan() {

  const data =
    await dbGetAll(
      STORES.penjualan
    );


  return data
    .sort(
      function(a, b) {

        return String(
          b.tanggal || ""
        ).localeCompare(
          String(
            a.tanggal || ""
          )
        );

      }
    );

}


/* =========================================================
   RENDER BARANG
   ========================================================= */

async function renderBarang(
  containerId
) {

  const container =
    document.getElementById(
      containerId
    );


  if (!container) {
    return;
  }


  const barang =
    await loadBarang();


  if (
    barang.length === 0
  ) {

    container.innerHTML =
      "<p>Belum ada barang.</p>";

    return;

  }


  container.innerHTML =
    barang.map(
      function(item) {

        const stok =
          number(
            item.stok
          );


        const stokMin =
          number(
            item.stokMin
          );


        const lowStock =
          stok <= stokMin;


        return `

          <div class="barang-item">

            <div class="barang-info">

              <strong>
                ${escapeHTML(
                  item.nama
                )}
              </strong>

              <small>
                ${escapeHTML(
                  item.kode
                )}
              </small>

            </div>

            <div class="barang-stok">

              <strong>
                Stok ${stok}
              </strong>

              ${
                lowStock
                  ? `<small>Stok menipis</small>`
                  : ""
              }

            </div>

            <div class="barang-harga">

              Modal:
              ${rupiah(
                item.hargaModal
              )}

              <br>

              Jual:
              ${rupiah(
                item.hargaJual
              )}

            </div>

          </div>

        `;

      }
    ).join("");

}


/* =========================================================
   RENDER TRANSAKSI
   ========================================================= */

async function renderTransaksi(
  containerId
) {

  const container =
    document.getElementById(
      containerId
    );


  if (!container) {
    return;
  }


  const data =
    await loadTransaksi();


  if (
    data.length === 0
  ) {

    container.innerHTML =
      "<p>Belum ada transaksi.</p>";

    return;

  }


  container.innerHTML =
    data.map(
      function(item) {

        const masuk =
          item.jenis ===
          "masuk";


        return `

          <div class="transaksi-item">

            <div>

              <strong>
                ${escapeHTML(
                  item.keterangan ||
                  item.kategori ||
                  "Transaksi"
                )}
              </strong>

              <small>
                ${escapeHTML(
                  item.tanggal
                )}
              </small>

            </div>

            <strong class="${
              masuk
                ? "text-success"
                : "text-danger"
            }">

              ${
                masuk
                  ? "+"
                  : "-"
              }

              ${rupiah(
                item.jumlah
              )}

            </strong>

          </div>

        `;

      }
    ).join("");

}


/* =========================================================
   RENDER PENJUALAN
   ========================================================= */

async function renderPenjualan(
  containerId
) {

  const container =
    document.getElementById(
      containerId
    );


  if (!container) {
    return;
  }


  const data =
    await loadPenjualan();


  if (
    data.length === 0
  ) {

    container.innerHTML =
      "<p>Belum ada penjualan.</p>";

    return;

  }


  container.innerHTML =
    data.map(
      function(item) {

        return `

          <div class="penjualan-item">

            <div>

              <strong>
                ${escapeHTML(
                  item.namaBarang
                )}
              </strong>

              <small>
                ${escapeHTML(
                  item.tanggal
                )}
                ·
                ${item.qty} pcs
              </small>

            </div>

            <div>

              <strong>
                ${rupiah(
                  item.omzet
                )}
              </strong>

              <small>
                Untung:
                ${rupiah(
                  item.untung
                )}
              </small>

            </div>

          </div>

        `;

      }
    ).join("");

}


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


    document.body.appendChild(
      toast
    );

  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  setTimeout(
    function() {

      toast.classList.remove(
        "show"
      );

    },
    2200
  );

}


/* =========================================================
   EVENT FORM TRANSAKSI
   ========================================================= */

function initTransaksiForm() {

  const form =
    document.getElementById(
      "transaksiForm"
    );


  if (!form) {
    return;
  }


  form.addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();


      try {

        const formData =
          new FormData(form);


        await saveTransaksi({

          tanggal:
            formData.get(
              "tanggal"
            ) ||
            today(),

          jenis:
            formData.get(
              "jenis"
            ),

          kategori:
            formData.get(
              "kategori"
            ),

          keterangan:
            formData.get(
              "keterangan"
            ),

          jumlah:
            formData.get(
              "jumlah"
            ),

          sumber:
            formData.get(
              "sumber"
            ) ||
            "toko"

        });


        form.reset();


        await loadDashboard();


        await renderTransaksi(
          "transaksiList"
        );

      }

      catch (error) {

        console.error(
          error
        );


        showToast(
          error.message
        );

      }

    }
  );

}


/* =========================================================
   EVENT FORM BARANG
   ========================================================= */

function initBarangForm() {

  const form =
    document.getElementById(
      "barangForm"
    );


  if (!form) {
    return;
  }


  form.addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();


      try {

        const formData =
          new FormData(form);


        await saveBarang({

          kode:
            formData.get(
              "kode"
            ),

          nama:
            formData.get(
              "nama"
            ),

          stok:
            formData.get(
              "stok"
            ),

          hargaModal:
            formData.get(
              "hargaModal"
            ),

          hargaJual:
            formData.get(
              "hargaJual"
            ),

          stokMin:
            formData.get(
              "stokMin"
            )

        });


        form.reset();


        await loadDashboard();


        await renderBarang(
          "barangList"
        );

      }

      catch (error) {

        console.error(
          error
        );


        showToast(
          error.message
        );

      }

    }
  );

}


/* =========================================================
   EVENT FORM PENJUALAN
   ========================================================= */

function initPenjualanForm() {

  const form =
    document.getElementById(
      "penjualanForm"
    );


  if (!form) {
    return;
  }


  form.addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();


      try {

        const formData =
          new FormData(form);


        await savePenjualan({

          tanggal:
            formData.get(
              "tanggal"
            ),

          barangId:
            formData.get(
              "barangId"
            ),

          qty:
            formData.get(
              "qty"
            ),

          hargaJual:
            formData.get(
              "hargaJual"
            )

        });


        form.reset();


        await loadDashboard();


        await renderBarang(
          "barangList"
        );


        await renderPenjualan(
          "penjualanList"
        );

      }

      catch (error) {

        console.error(
          error
        );


        showToast(
          error.message
        );

      }

    }
  );

}


/* =========================================================
   ISI SELECT BARANG
   ========================================================= */

async function fillBarangSelect(
  selectId
) {

  const select =
    document.getElementById(
      selectId
    );


  if (!select) {
    return;
  }


  const barang =
    await loadBarang();


  select.innerHTML =
    `<option value="">
       Pilih barang
     </option>`;


  barang.forEach(
    function(item) {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        item.id;


      option.textContent =
        item.nama +
        " — stok " +
        item.stok;


      option.dataset.harga =
        item.hargaJual;


      select.appendChild(
        option
      );

    }
  );

}


/* =========================================================
   AUTO HARGA PENJUALAN
   ========================================================= */

function initBarangSelect() {

  const select =
    document.getElementById(
      "barangId"
    );


  const harga =
    document.querySelector(
      '[name="hargaJual"]'
    );


  if (
    !select ||
    !harga
  ) {

    return;

  }


  select.addEventListener(
    "change",
    function() {

      const option =
        select.options[
          select.selectedIndex
        ];


      if (
        option &&
        option.dataset.harga
      ) {

        harga.value =
          option.dataset.harga;

      }

    }
  );

}


/* =========================================================
   FORCE SYNC
   ========================================================= */

async function manualSync() {

  if (
    !navigator.onLine
  ) {

    showToast(
      "Tidak ada internet"
    );

    return;

  }


  showToast(
    "Sinkronisasi..."
  );


  try {

    await syncQueue();


    await downloadData();


    await loadDashboard();


    showToast(
      "Sinkronisasi selesai"
    );

  }

  catch (error) {

    console.error(
      error
    );


    showToast(
      "Sync gagal: " +
      error.message
    );

  }

}


/* =========================================================
   AUTO REFRESH
   ========================================================= */

async function refreshApp() {

  try {

    if (
      navigator.onLine
    ) {

      await syncQueue();

      await downloadData();

    }


    await loadDashboard();


    await renderBarang(
      "barangList"
    );


    await renderTransaksi(
      "transaksiList"
    );


    await renderPenjualan(
      "penjualanList"
    );


    await fillBarangSelect(
      "barangId"
    );


  }

  catch (error) {

    console.error(
      "Refresh:",
      error
    );

  }

}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initApp() {

  console.log(
    "CatatKu mulai..."
  );


  try {

    /* -----------------------------------------------------
       Pastikan IndexedDB siap
       ----------------------------------------------------- */

    await openDB();


    console.log(
      "IndexedDB siap"
    );


    /* -----------------------------------------------------
       Status
       ----------------------------------------------------- */

    updateOnlineStatus();


    /* -----------------------------------------------------
       Form
       ----------------------------------------------------- */

    initTransaksiForm();

    initBarangForm();

    initPenjualanForm();

    initBarangSelect();


    /* -----------------------------------------------------
       Dashboard lokal
       ----------------------------------------------------- */

    await loadDashboard();


    /* -----------------------------------------------------
       Render
       ----------------------------------------------------- */

    await renderBarang(
      "barangList"
    );

    await renderTransaksi(
      "transaksiList"
    );

    await renderPenjualan(
      "penjualanList"
    );

    await fillBarangSelect(
      "barangId"
    );


    /* -----------------------------------------------------
       Jika online
       ----------------------------------------------------- */

    if (
      navigator.onLine
    ) {

      const connected =
        await testGAS();


      if (connected) {

        await syncQueue();

        await downloadData();

        await loadDashboard();

        await renderBarang(
          "barangList"
        );

        await renderTransaksi(
          "transaksiList"
        );

        await renderPenjualan(
          "penjualanList"
        );

        await fillBarangSelect(
          "barangId"
        );

      }

    }


    console.log(
      "CatatKu siap digunakan"
    );

  }

  catch (error) {

    console.error(
      "INIT ERROR:",
      error
    );


    setDatabaseStatus(
      "error",
      "Database lokal gagal: " +
      error.message
    );

  }

}


/* =========================================================
   GLOBAL API
   Supaya HTML bisa memanggil fungsi
   ========================================================= */

window.CatatKu = {

  saveTransaksi:
    saveTransaksi,

  saveBarang:
    saveBarang,

  savePenjualan:
    savePenjualan,

  loadBarang:
    loadBarang,

  loadTransaksi:
    loadTransaksi,

  loadPenjualan:
    loadPenjualan,

  loadDashboard:
    loadDashboard,

  sync:
    manualSync,

  refresh:
    refreshApp,

  testGAS:
    testGAS

};


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initApp
  );

}

else {

  initApp();

}
