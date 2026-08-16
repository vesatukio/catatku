/* =========================================================
   CATATKU
   app.js - FINAL SYNC
   =========================================================

   DATABASE UTAMA
   Google Sheets melalui Google Apps Script

   DATABASE LOKAL
   IndexedDB

   FITUR
   - Uang masuk
   - Uang keluar
   - Barang
   - Stok
   - Penjualan
   - Omzet
   - Untung
   - Offline save
   - Auto sync
   - Manual sync
   - Dashboard
   - Auto repair IndexedDB
   - Chrome HP
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
  4;


/* =========================================================
   OBJECT STORE
   ========================================================= */

const STORES = {

  transaksi:
    "transaksi",

  barang:
    "barang",

  penjualan:
    "penjualan",

  nota:
    "nota",

  notaDetail:
    "nota_detail",

  queue:
    "sync_queue"

};


/* =========================================================
   DATABASE GLOBAL
   ========================================================= */

let db = null;

let dbPromise = null;


/* =========================================================
   STATUS APLIKASI
   ========================================================= */

const APP_STATE = {

  online:
    navigator.onLine,

  syncing:
    false,

  initialized:
    false

};


/* =========================================================
   UTILITAS
   ========================================================= */

function uid(prefix = "ID") {

  const waktu =
    Date.now()
      .toString(36);

  const acak =
    Math.random()
      .toString(36)
      .substring(2, 9);

  return (
    prefix +
    "-" +
    waktu +
    "-" +
    acak
  ).toUpperCase();

}


function number(value) {

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

  return Number.isFinite(n)
    ? n
    : 0;

}


function rupiah(value) {

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
    number(value)
  );

}


function today() {

  const d =
    new Date();

  const tahun =
    d.getFullYear();

  const bulan =
    String(
      d.getMonth() + 1
    ).padStart(2, "0");

  const tanggal =
    String(
      d.getDate()
    ).padStart(2, "0");

  return (
    tahun +
    "-" +
    bulan +
    "-" +
    tanggal
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
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   INDEXED DB
   ========================================================= */

function openDB() {

  if (
    db &&
    db.objectStoreNames
  ) {

    return Promise.resolve(
      db
    );

  }


  if (dbPromise) {

    return dbPromise;

  }


  dbPromise =
    new Promise(
      function(resolve, reject) {

        if (
          !window.indexedDB
        ) {

          dbPromise = null;

          reject(
            new Error(
              "Browser tidak mendukung IndexedDB"
            )
          );

          return;

        }


        let request;


        try {

          request =
            indexedDB.open(
              DB_NAME,
              DB_VERSION
            );

        }

        catch (error) {

          dbPromise = null;

          reject(error);

          return;

        }


        /* =================================================
           UPGRADE DATABASE
           ================================================= */

        request.onupgradeneeded =
          function(event) {

            const database =
              event.target.result;
/* ---------------------------------------------
   NOTA
   --------------------------------------------- */

if (
  !database.objectStoreNames.contains(
    STORES.nota
  )
) {

  const store =
    database.createObjectStore(
      STORES.nota,
      {
        keyPath:
          "id"
      }
    );


  store.createIndex(
    "tanggal",
    "tanggal",
    {
      unique:
        false
    }
  );


  store.createIndex(
    "nomorNota",
    "nomorNota",
    {
      unique:
        false
    }
  );

}


/* ---------------------------------------------
   NOTA DETAIL
   --------------------------------------------- */

if (
  !database.objectStoreNames.contains(
    STORES.notaDetail
  )
) {

  const store =
    database.createObjectStore(
      STORES.notaDetail,
      {
        keyPath:
          "id"
      }
    );


  store.createIndex(
    "notaId",
    "notaId",
    {
      unique:
        false
    }
  );

}

            /* ---------------------------------------------
               TRANSAKSI
               --------------------------------------------- */

            if (
              !database.objectStoreNames.contains(
                STORES.transaksi
              )
            ) {

              const store =
                database.createObjectStore(
                  STORES.transaksi,
                  {
                    keyPath:
                      "id"
                  }
                );


              store.createIndex(
                "tanggal",
                "tanggal",
                {
                  unique:
                    false
                }
              );

            }


            /* ---------------------------------------------
               BARANG
               --------------------------------------------- */

            if (
              !database.objectStoreNames.contains(
                STORES.barang
              )
            ) {

              const store =
                database.createObjectStore(
                  STORES.barang,
                  {
                    keyPath:
                      "id"
                  }
                );


              store.createIndex(
                "nama",
                "nama",
                {
                  unique:
                    false
                }
              );

            }


            /* ---------------------------------------------
               PENJUALAN
               --------------------------------------------- */

            if (
              !database.objectStoreNames.contains(
                STORES.penjualan
              )
            ) {

              const store =
                database.createObjectStore(
                  STORES.penjualan,
                  {
                    keyPath:
                      "id"
                  }
                );


              store.createIndex(
                "tanggal",
                "tanggal",
                {
                  unique:
                    false
                }
              );

            }


            /* ---------------------------------------------
               SYNC QUEUE
               --------------------------------------------- */

            if (
              !database.objectStoreNames.contains(
                STORES.queue
              )
            ) {

              const store =
                database.createObjectStore(
                  STORES.queue,
                  {
                    keyPath:
                      "id"
                  }
                );


              store.createIndex(
                "createdAt",
                "createdAt",
                {
                  unique:
                    false
                }
              );

            }

          };


        /* =================================================
           DATABASE BERHASIL DIBUKA
           ================================================= */

        request.onsuccess =
          function(event) {

            db =
              event.target.result;


            db.onversionchange =
              function() {

                db.close();

                db = null;

                dbPromise = null;

              };


            db.onerror =
              function(event) {

                console.warn(
                  "IndexedDB error:",
                  event
                );

              };


            db.onclose =
              function() {

                db = null;

                dbPromise = null;

              };


            resolve(
              db
            );

          };


        /* =================================================
           ERROR
           ================================================= */

        request.onerror =
          function() {

            db = null;

            dbPromise = null;

            reject(
              request.error ||
              new Error(
                "Gagal membuka IndexedDB"
              )
            );

          };


        /* =================================================
           BLOCKED
           ================================================= */

        request.onblocked =
          function() {

            console.warn(
              "IndexedDB diblokir. Tutup tab CatatKu lain."
            );

          };

      }
    );


  return dbPromise;

}


/* =========================================================
   CEK DATABASE
   ========================================================= */

async function ensureDB() {

  const database =
    await openDB();


  if (!database) {

    throw new Error(
      "Database lokal belum siap"
    );

  }


  return database;

}


/* =========================================================
   DB PUT
   ========================================================= */

async function dbPut(
  storeName,
  data
) {

  if (
    !data ||
    typeof data !== "object"
  ) {

    throw new Error(
      "Data IndexedDB tidak valid"
    );

  }


  const database =
    await ensureDB();


  if (
    !database.objectStoreNames.contains(
      storeName
    )
  ) {

    throw new Error(
      "Object store tidak ditemukan: " +
      storeName
    );

  }


  const item = {
    ...data
  };


  if (
    item.id === undefined ||
    item.id === null ||
    String(item.id).trim() === ""
  ) {

    item.id =
      uid(
        storeName
          .replace(
            /[^a-zA-Z0-9]/g,
            ""
          )
          .substring(
            0,
            8
          )
          .toUpperCase() ||
        "LOCAL"
      );

  }


  return new Promise(
    function(resolve, reject) {

      let transaction;


      try {

        transaction =
          database.transaction(
            storeName,
            "readwrite"
          );

      }

      catch (error) {

        reject(error);

        return;

      }


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.put(
          item
        );


      request.onsuccess =
        function() {

          resolve(
            item
          );

        };


      request.onerror =
        function() {

          reject(
            request.error ||
            new Error(
              "Gagal menyimpan data ke IndexedDB"
            )
          );

        };


      transaction.onerror =
        function() {

          reject(
            transaction.error ||
            new Error(
              "Transaksi IndexedDB gagal"
            )
          );

        };


      transaction.onabort =
        function() {

          reject(
            transaction.error ||
            new Error(
              "Transaksi IndexedDB dibatalkan"
            )
          );

        };

    }
  );

}


/* =========================================================
   DB GET
   ========================================================= */

async function dbGet(
  storeName,
  id
) {

  const database =
    await ensureDB();


  if (
    !database.objectStoreNames.contains(
      storeName
    )
  ) {

    throw new Error(
      "Object store tidak ditemukan: " +
      storeName
    );

  }


  return new Promise(
    function(resolve, reject) {

      let transaction;


      try {

        transaction =
          database.transaction(
            storeName,
            "readonly"
          );

      }

      catch (error) {

        reject(error);

        return;

      }


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.get(
          id
        );


      request.onsuccess =
        function() {

          resolve(
            request.result ||
            null
          );

        };


      request.onerror =
        function() {

          reject(
            request.error ||
            new Error(
              "Gagal mengambil data IndexedDB"
            )
          );

        };

    }
  );

}


/* =========================================================
   DB GET ALL
   ========================================================= */

async function dbGetAll(
  storeName
) {

  const database =
    await ensureDB();


  if (
    !database.objectStoreNames.contains(
      storeName
    )
  ) {

    throw new Error(
      "Object store tidak ditemukan: " +
      storeName
    );

  }


  return new Promise(
    function(resolve, reject) {

      let transaction;


      try {

        transaction =
          database.transaction(
            storeName,
            "readonly"
          );

      }

      catch (error) {

        reject(error);

        return;

      }


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.getAll();


      request.onsuccess =
        function() {

          resolve(
            Array.isArray(
              request.result
            )
              ? request.result
              : []
          );

        };


      request.onerror =
        function() {

          reject(
            request.error ||
            new Error(
              "Gagal mengambil semua data IndexedDB"
            )
          );

        };

    }
  );

}


/* =========================================================
   DB DELETE
   ========================================================= */

async function dbDelete(
  storeName,
  id
) {

  const database =
    await ensureDB();


  return new Promise(
    function(resolve, reject) {

      let transaction;


      try {

        transaction =
          database.transaction(
            storeName,
            "readwrite"
          );

      }

      catch (error) {

        reject(error);

        return;

      }


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.delete(
          id
        );


      request.onsuccess =
        function() {

          resolve(true);

        };


      request.onerror =
        function() {

          reject(
            request.error ||
            new Error(
              "Gagal menghapus data IndexedDB"
            )
          );

        };

    }
  );

}


/* =========================================================
   DB CLEAR
   ========================================================= */

async function dbClear(
  storeName
) {

  const database =
    await ensureDB();


  return new Promise(
    function(resolve, reject) {

      try {

        const transaction =
          database.transaction(
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
          function() {

            resolve(true);

          };


        request.onerror =
          function() {

            reject(
              request.error
            );

          };

      }

      catch (error) {

        reject(error);

      }

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

  if (!type) {

    throw new Error(
      "Tipe queue kosong"
    );

  }


  if (
    !data ||
    typeof data !== "object"
  ) {

    throw new Error(
      "Data queue tidak valid"
    );

  }


  const item = {

    id:
      uid("SYNC"),

    type:
      type,

    data:
      {
        ...data
      },

    createdAt:
      nowISO(),

    attempts:
      0,

    lastError:
      "",

    lastAttempt:
      ""

  };


  await dbPut(
    STORES.queue,
    item
  );


  await updateSyncStatus();


  return item;

}


/* =========================================================
   JUMLAH QUEUE
   ========================================================= */

async function getQueueCount() {

  const items =
    await dbGetAll(
      STORES.queue
    );


  return items.length;

}


/* =========================================================
   KIRIM POST KE GAS
   ========================================================= */

async function postGAS(
  action,
  data
) {

  if (!GAS_URL) {

    throw new Error(
      "GAS_URL belum diisi"
    );

  }


  const response =
    await fetch(
      GAS_URL,
      {
        method:
          "POST",

        headers:
          {
            "Content-Type":
              "text/plain;charset=utf-8"
          },

        body:
          JSON.stringify(
            {
              action:
                action,

              data:
                data
            }
          ),

        cache:
          "no-store"
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


  let result;


  try {

    result =
      JSON.parse(
        text
      );

  }

  catch (error) {

    console.error(
      "Response GAS bukan JSON:",
      text
    );

    throw new Error(
      "Response Google Apps Script tidak valid"
    );

  }


  if (
    result &&
    (
      result.success === false ||
      result.ok === false
    )
  ) {

    throw new Error(
      result.error ||
      result.message ||
      "Google Apps Script gagal"
    );

  }


  return (
    result || {
      success:
        true
    }
  );

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
        method:
          "GET",

        cache:
          "no-store"
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


  let result;


  try {

    result =
      JSON.parse(
        text
      );

  }

  catch (error) {

    console.error(
      "Response GAS bukan JSON:",
      text
    );

    throw new Error(
      "Response Google Apps Script tidak valid"
    );

  }


  if (
    result &&
    (
      result.success === false ||
      result.ok === false
    )
  ) {

    throw new Error(
      result.error ||
      result.message ||
      "Google Apps Script gagal"
    );

  }


  return (
    result || {
      success:
        true
    }
  );

}


/* =========================================================
   TEST GAS
   ========================================================= */

async function testGAS() {

  try {

    const result =
      await getGAS(
        "ping"
      );


    console.log(
      "GAS PING:",
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
      "GAS PING ERROR:",
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

      if (!el) {
        return;
      }


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

      if (!el) {
        return;
      }


      if (APP_STATE.online) {

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


  if (APP_STATE.online) {

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
      )
      .catch(
        function(error) {

          console.warn(
            "Auto sync:",
            error
          );

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


/* =========================================================
   ONLINE / OFFLINE
   ========================================================= */

window.addEventListener(
  "online",
  function() {

    APP_STATE.online =
      true;

    updateOnlineStatus();

  }
);


window.addEventListener(
  "offline",
  function() {

    APP_STATE.online =
      false;

    updateOnlineStatus();

  }
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

        if (!el) {
          return;
        }


        if (APP_STATE.syncing) {

          el.textContent =
            "⟳ Sinkronisasi...";

          el.dataset.status =
            "syncing";

          return;

        }


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
      "Update sync status:",
      error
    );

  }

}


/* =========================================================
   SIMPAN TRANSAKSI
   ========================================================= */

async function saveTransaksi(
  data = {}
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
        data.jenis ||
        ""
      ).toLowerCase(),

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


  await dbPut(
    STORES.transaksi,
    transaksi
  );


  await queueAdd(
    "transaksi",
    transaksi
  );


  if (navigator.onLine) {

    await syncQueue();

  }


  showToast(
    "Transaksi tersimpan"
  );


  return transaksi;

}


/* =========================================================
   GENERATE KODE BARANG
   ========================================================= */

async function generateLocalKodeBarang() {

  const semuaBarang =
    await dbGetAll(
      STORES.barang
    );


  let nomorTerbesar =
    0;


  semuaBarang.forEach(
    function(item) {

      const kode =
        String(
          item.kode || ""
        )
          .trim()
          .toUpperCase();


      const match =
        kode.match(
          /^BRG-(\d+)$/
        );


      if (match) {

        const nomor =
          Number(
            match[1]
          );


        if (
          nomor >
          nomorTerbesar
        ) {

          nomorTerbesar =
            nomor;

        }

      }

    }
  );


  return (
    "BRG-" +
    String(
      nomorTerbesar + 1
    ).padStart(
      4,
      "0"
    )
  );

}


/* =========================================================
   SIMPAN BARANG
   ========================================================= */

async function saveBarang(
  data = {}
) {

  const barang = {

    id:
      data.id ||
      uid("BRG"),

    kode:
      data.kode ||
      await generateLocalKodeBarang(),

    nama:
      String(
        data.nama ||
        ""
      ).trim(),

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


  if (!barang.nama) {

    throw new Error(
      "Nama barang wajib diisi"
    );

  }


  await dbPut(
    STORES.barang,
    barang
  );


  await queueAdd(
    "barang",
    barang
  );


  if (navigator.onLine) {

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
  data = {}
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


  if (qty <= 0) {

    throw new Error(
      "Jumlah penjualan tidak valid"
    );

  }


  if (
    qty >
    number(
      barang.stok
    )
  ) {

    throw new Error(
      "Stok tidak cukup. Stok tersedia: " +
      number(
        barang.stok
      )
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
    barang.hargaJual
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


  const barangBaru = {

    ...barang,

    stok:
      number(
        barang.stok
      ) -
      qty,

    terjual:
      number(
        barang.terjual
      ) +
      qty,

    omzet:
      number(
        barang.omzet
      ) +
      omzet,

    untung:
      number(
        barang.untung
      ) +
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


  await queueAdd(
    "penjualan",
    penjualan
  );


  if (navigator.onLine) {

    await syncQueue();

  }


  showToast(
    "Penjualan tersimpan"
  );


  return penjualan;

}


/* =========================================================
   SYNC SATU ITEM
   ========================================================= */

async function syncQueueItem(
  item
) {

  if (
    !item ||
    !item.type ||
    !item.data
  ) {

    throw new Error(
      "Data queue tidak valid"
    );

  }


  let action =
    "";


  switch (
  item.type
) {

  case "transaksi":

    action =
      "tambahTransaksi";

    break;


  case "barang":

    action =
      "tambahBarang";

    break;


  case "penjualan":

    action =
      "tambahPenjualan";

    break;


  case "nota":

    action =
      "buatNota";

    break;


  case "hapusNota":

    action =
      "hapusNota";

    break;


  default:

    throw new Error(
      "Tipe queue tidak dikenal: " +
      item.type
    );

}


  const result =
    await postGAS(
      action,
      item.data
    );


  if (
    result &&
    (
      result.success === false ||
      result.ok === false
    )
  ) {

    throw new Error(
      result.error ||
      result.message ||
      "Google Apps Script gagal"
    );

  }


  return result;

}


/* =========================================================
   SYNC QUEUE
   ========================================================= */

async function syncQueue() {

  if (APP_STATE.syncing) {

    return;

  }


  if (!navigator.onLine) {

    return;

  }


  APP_STATE.syncing =
    true;


  await updateSyncStatus();


  try {

    const queue =
      await dbGetAll(
        STORES.queue
      );


    if (
      !Array.isArray(queue) ||
      queue.length === 0
    ) {

      return;

    }


    queue.sort(
      function(a, b) {

        return String(
          a.createdAt || ""
        ).localeCompare(
          String(
            b.createdAt || ""
          )
        );

      }
    );


    for (
      const item
      of queue
    ) {

      if (!navigator.onLine) {

        break;

      }


      item.attempts =
        number(
          item.attempts
        ) + 1;


      item.lastAttempt =
        nowISO();


      try {

        await syncQueueItem(
          item
        );


        await dbDelete(
          STORES.queue,
          item.id
        );


        console.log(
          "SYNC BERHASIL:",
          item.type,
          item.data?.id
        );

      }

      catch (error) {

        item.lastError =
          error?.message ||
          String(
            error
          );


        await dbPut(
          STORES.queue,
          item
        );


        console.warn(
          "SYNC GAGAL:",
          item.type,
          error
        );


        break;

      }

    }

  }

  catch (error) {

    console.error(
      "SYNC QUEUE ERROR:",
      error
    );

  }

  finally {

    APP_STATE.syncing =
      false;


    await updateSyncStatus();

  }

}


/* =========================================================
   DOWNLOAD DATA DARI GOOGLE SHEETS
   ========================================================= */

async function downloadData() {

  if (!navigator.onLine) {

    throw new Error(
      "Tidak ada internet"
    );

  }


  const result =
    await getGAS(
      "appData"
    );


  if (
    !result ||
    !result.data
  ) {

    throw new Error(
      "Data aplikasi kosong dari GAS"
    );

  }


  const data =
    result.data;


  /*
   * DATA YANG MASIH MENUNGGU SYNC
   */

  const queue =
    await dbGetAll(
      STORES.queue
    );


  const pendingIds =
    new Set();


  queue.forEach(
    function(item) {

      if (
        item &&
        item.data &&
        item.data.id
      ) {

        pendingIds.add(
          String(
            item.data.id
          )
        );

      }

    }
  );


  /* =======================================================
     TRANSAKSI
     ======================================================= */

  if (
    Array.isArray(
      data.transaksi
    )
  ) {

    for (
      const item
      of data.transaksi
    ) {

      if (
        !item ||
        !item.id
      ) {

        continue;

      }


      if (
        pendingIds.has(
          String(
            item.id
          )
        )
      ) {

        continue;

      }


      await dbPut(
        STORES.transaksi,
        item
      );

    }

  }


  /* =======================================================
     BARANG
     ======================================================= */

  if (
    Array.isArray(
      data.barang
    )
  ) {

    for (
      const item
      of data.barang
    ) {

      if (
        !item ||
        !item.id
      ) {

        continue;

      }


      if (
        pendingIds.has(
          String(
            item.id
          )
        )
      ) {

        continue;

      }


      await dbPut(
        STORES.barang,
        item
      );

    }

  }


  /* =======================================================
     PENJUALAN
     ======================================================= */

  if (
    Array.isArray(
      data.penjualan
    )
  ) {

    for (
      const item
      of data.penjualan
    ) {

      if (
        !item ||
        !item.id
      ) {

        continue;

      }


      if (
        pendingIds.has(
          String(
            item.id
          )
        )
      ) {

        continue;

      }


      await dbPut(
        STORES.penjualan,
        item
      );

    }

  }


  console.log(
    "DATA SERVER BERHASIL DISINKRONKAN"
  );


  await updateSyncStatus();


  return data;

}


/* =========================================================
   DASHBOARD LOKAL
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


    return data;

  }

  catch (error) {

    console.error(
      "Dashboard:",
      error
    );


    return null;

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


  return data.sort(
    function(a, b) {

      return String(
        a.nama ||
        ""
      ).localeCompare(
        String(
          b.nama ||
          ""
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


  return data.sort(
    function(a, b) {

      return String(
        b.tanggal ||
        ""
      ).localeCompare(
        String(
          a.tanggal ||
          ""
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


  return data.sort(
    function(a, b) {

      return String(
        b.tanggal ||
        ""
      ).localeCompare(
        String(
          a.tanggal ||
          ""
        )
      );

    }
  );

}
/* =========================================================
   NOTA
   ========================================================= */

const NOTA_STATE = {

  selected:
    new Set(),

  current:
    null

};


/* =========================================================
   GENERATE NOMOR NOTA
   ========================================================= */

async function generateNomorNota() {

  const data =
    await dbGetAll(
      STORES.nota
    );


  const tanggal =
    today()
      .replaceAll(
        "-",
        ""
      );


  let nomorTerbesar =
    0;


  data.forEach(
    function(item) {

      const nomor =
        String(
          item.nomorNota ||
          ""
        );


      const match =
        nomor.match(
          new RegExp(
            "^NOTA-" +
            tanggal +
            "-(\\d+)$"
          )
        );


      if (match) {

        const angka =
          Number(
            match[1]
          );


        if (
          angka >
          nomorTerbesar
        ) {

          nomorTerbesar =
            angka;

        }

      }

    }
  );


  return (
    "NOTA-" +
    tanggal +
    "-" +
    String(
      nomorTerbesar + 1
    ).padStart(
      3,
      "0"
    )
  );

}


/* =========================================================
   PILIH PENJUALAN UNTUK NOTA
   ========================================================= */

function toggleNotaItem(
  penjualanId,
  checked
) {

  const id =
    String(
      penjualanId ||
      ""
    );


  if (!id) {

    return;

  }


  if (checked) {

    NOTA_STATE.selected.add(
      id
    );

  }

  else {

    NOTA_STATE.selected.delete(
      id
    );

  }


  updateNotaSummary();

}


/* =========================================================
   PILIH / BATAL SEMUA
   ========================================================= */

async function toggleSemuaNota(
  checked
) {

  const data =
    await loadPenjualan();


  if (checked) {

    data.forEach(
      function(item) {

        if (item.id) {

          NOTA_STATE.selected.add(
            String(
              item.id
            )
          );

        }

      }
    );

  }

  else {

    NOTA_STATE.selected.clear();

  }


  updateNotaSummary();

}


/* =========================================================
   AMBIL PENJUALAN TERPILIH
   ========================================================= */

async function getPenjualanTerpilihUntukNota() {

  const data =
    await loadPenjualan();


  return data.filter(
    function(item) {

      return NOTA_STATE.selected.has(
        String(
          item.id
        )
      );

    }
  );

}


/* =========================================================
   HITUNG TOTAL PILIHAN
   ========================================================= */

async function updateNotaSummary() {

  const data =
    await getPenjualanTerpilihUntukNota();


  let total =
    0;


  let qty =
    0;


  data.forEach(
    function(item) {

      total +=
        number(
          item.omzet
        );


      qty +=
        number(
          item.qty
        );

    }
  );


  setText(
    "notaSelectedCount",
    data.length
  );


  setText(
    "notaSelectedQty",
    qty
  );


  setText(
    "notaSelectedTotal",
    rupiah(
      total
    )
  );


  const button =
    document.getElementById(
      "btnBuatNota"
    );


  if (button) {

    button.disabled =
      data.length === 0;

  }


  return {

    data:
      data,

    count:
      data.length,

    qty:
      qty,

    total:
      total

  };

}


/* =========================================================
   BUAT NOTA
   ========================================================= */

async function buatNota() {

  const selected =
    await getPenjualanTerpilihUntukNota();


  if (
    selected.length === 0
  ) {

    showToast(
      "Pilih minimal 1 penjualan"
    );

    return null;

  }


  const nomorNota =
    await generateNomorNota();


  const notaId =
    uid(
      "NOTA"
    );


  let total =
    0;


  let totalQty =
    0;


  selected.forEach(
    function(item) {

      total +=
        number(
          item.omzet
        );


      totalQty +=
        number(
          item.qty
        );

    }
  );


  const nota = {

    id:
      notaId,

    nomorNota:
      nomorNota,

    tanggal:
      today(),

    total:
      total,

    totalQty:
      totalQty,

    jumlahItem:
      selected.length,

    createdAt:
      nowISO()

  };


  /*
   * SIMPAN KEPALA NOTA
   */

  await dbPut(
    STORES.nota,
    nota
  );


  /*
   * SIMPAN DETAIL
   */

  for (
    const item
    of selected
  ) {

    const detail = {

      id:
        uid(
          "NDET"
        ),

      notaId:
        notaId,

      penjualanId:
        item.id,

      barangId:
        item.barangId,

      namaBarang:
        item.namaBarang,

      qty:
        number(
          item.qty
        ),

      hargaModal:
        number(
          item.hargaModal
        ),

      hargaJual:
        number(
          item.hargaJual
        ),

      omzet:
        number(
          item.omzet
        ),

      modal:
        number(
          item.modal
        ),

      untung:
        number(
          item.untung
        ),

      subtotal:
        number(
          item.omzet
        ),

      createdAt:
        nowISO()

    };


    await dbPut(
      STORES.notaDetail,
      detail
    );

  }


  /*
   * MASUK QUEUE UNTUK DIKIRIM KE GAS
   */

  await queueAdd(
    "nota",
    {

      nota:
        nota,

      detail:
        selected.map(
          function(item) {

            return {

              id:
                uid(
                  "NDET"
                ),

              notaId:
                notaId,

              penjualanId:
                item.id,

              barangId:
                item.barangId,

              namaBarang:
                item.namaBarang,

              qty:
                number(
                  item.qty
                ),

              hargaModal:
                number(
                  item.hargaModal
                ),

              hargaJual:
                number(
                  item.hargaJual
                ),

              omzet:
                number(
                  item.omzet
                ),

              modal:
                number(
                  item.modal
                ),

              untung:
                number(
                  item.untung
                ),

              subtotal:
                number(
                  item.omzet
                )

            };

          }
        )

    }
  );


  /*
   * HAPUS PILIHAN
   */

  NOTA_STATE.selected.clear();


  await updateNotaSummary();


  /*
   * SYNC JIKA ONLINE
   */

  if (
    navigator.onLine
  ) {

    await syncQueue();

  }


  showToast(
    "Nota " +
    nomorNota +
    " tersimpan"
  );


  /*
   * REFRESH DAFTAR NOTA
   */

  if (
    typeof renderDaftarNota ===
    "function"
  ) {

    await renderDaftarNota();

  }


  return nota;

}


/* =========================================================
   LOAD DAFTAR NOTA
   ========================================================= */

async function loadNota() {

  const data =
    await dbGetAll(
      STORES.nota
    );


  return data.sort(
    function(a, b) {

      return String(
        b.createdAt ||
        b.tanggal ||
        ""
      ).localeCompare(
        String(
          a.createdAt ||
          a.tanggal ||
          ""
        )
      );

    }
  );

}


/* =========================================================
   LOAD DETAIL NOTA
   ========================================================= */

async function loadNotaDetail(
  notaId
) {

  const semua =
    await dbGetAll(
      STORES.notaDetail
    );


  return semua.filter(
    function(item) {

      return String(
        item.notaId
      ) ===
      String(
        notaId
      );

    }
  );

}


/* =========================================================
   BUKA NOTA
   ========================================================= */

async function bukaNota(
  notaId
) {

  const nota =
    await dbGet(
      STORES.nota,
      notaId
    );


  if (!nota) {

    showToast(
      "Nota tidak ditemukan"
    );

    return null;

  }


  const detail =
    await loadNotaDetail(
      notaId
    );


  NOTA_STATE.current = {

    nota:
      nota,

    detail:
      detail

  };


  const container =
    document.getElementById(
      "detailNota"
    );


  if (!container) {

    console.warn(
      "Element #detailNota tidak ditemukan"
    );

    showToast(
      "Tampilan detail nota belum tersedia"
    );

    return NOTA_STATE.current;

  }


  const total =
    detail.reduce(
      function(sum, item) {

        return (
          sum +
          number(
            item.subtotal ||
            item.omzet
          )
        );

      },
      0
    );


  container.innerHTML = `

    <div class="nota-print">

      <!-- =========================================
           HEADER NOTA
           ========================================= -->

      <div class="nota-header">

        <div class="nota-title">
          DETAIL NOTA
        </div>

        <div class="nota-number">
          ${escapeHTML(
            nota.nomorNota
          )}
        </div>

        <div class="nota-date">
          ${escapeHTML(
            nota.tanggal
          )}
        </div>

      </div>


      <div class="nota-line"></div>


      <!-- =========================================
           HEADER KOLOM
           ========================================= -->

      <div class="nota-table-header">

        <span>Barang</span>

        <span>Qty</span>

        <span>Harga</span>

        <span>Jumlah</span>

      </div>


      <div class="nota-line"></div>


      <!-- =========================================
           DETAIL BARANG
           ========================================= -->

      <div class="nota-items">

        ${
          detail.map(
            function(item) {

              const qty =
                number(
                  item.qty
                );


              const harga =
                number(
                  item.hargaJual
                );


              const subtotal =
                number(
                  item.subtotal ||
                  item.omzet
                );


              return `

                <div class="nota-row">

                  <div class="nota-name">

                    ${escapeHTML(
                      item.namaBarang ||
                      "-"
                    )}

                  </div>


                  <div class="nota-qty">

                    ${qty}

                  </div>


                  <div class="nota-price">

                    ${rupiah(
                      harga
                    )}

                  </div>


                  <div class="nota-subtotal">

                    ${rupiah(
                      subtotal
                    )}

                  </div>

                </div>

              `;

            }
          ).join("")

        }

      </div>


      <div class="nota-line"></div>


      <!-- =========================================
           TOTAL
           ========================================= -->

      <div class="nota-total">

        <span>
          TOTAL
        </span>

        <strong>
          ${rupiah(
            total
          )}
        </strong>

      </div>


    </div>


    <!-- =========================================
         TOMBOL
         ========================================= -->

    <div class="nota-actions no-print">

      <button
        type="button"
        class="btn-cetak-nota"
        onclick="printNota()"
      >
        🖨️ Cetak Nota
      </button>

      <button
        type="button"
        class="btn-tutup-nota"
        onclick="tutupDetailNota()"
      >
        Tutup
      </button>

    </div>

  `;


  /*
   * Scroll ke detail nota
   */

  container.scrollIntoView({
    behavior:
      "smooth",

    block:
      "start"
  });


  return NOTA_STATE.current;

}
/* =========================================================
   CETAK NOTA
   ========================================================= */

function printNota() {

  if (
    !NOTA_STATE.current ||
    !NOTA_STATE.current.nota
  ) {

    showToast(
      "Belum ada nota yang dibuka"
    );

    return;

  }


  window.print();

}


/* =========================================================
   TUTUP DETAIL NOTA
   ========================================================= */

function tutupDetailNota() {

  const container =
    document.getElementById(
      "detailNota"
    );


  if (!container) {

    return;

  }


  container.innerHTML =
    "";

}
/* =========================================================
   HAPUS NOTA
   ========================================================= */

async function hapusNota(
  notaId
) {

  if (!notaId) {

    return false;

  }


  const nota =
    await dbGet(
      STORES.nota,
      notaId
    );


  if (!nota) {

    showToast(
      "Nota tidak ditemukan"
    );

    return false;

  }


  const yakin =
    confirm(
      "Hapus " +
      nota.nomorNota +
      "?\n\n" +
      "Data penjualan tetap aman dan tidak akan ikut terhapus."
    );


  if (!yakin) {

    return false;

  }


  /*
   * HAPUS DETAIL
   */

  const detail =
    await loadNotaDetail(
      notaId
    );


  for (
    const item
    of detail
  ) {

    await dbDelete(
      STORES.notaDetail,
      item.id
    );

  }


  /*
   * HAPUS NOTA
   */

  await dbDelete(
    STORES.nota,
    notaId
  );


  /*
   * QUEUE PENGHAPUSAN
   */

  await queueAdd(
    "hapusNota",
    {

      notaId:
        notaId

    }
  );


  if (
    navigator.onLine
  ) {

    await syncQueue();

  }


  showToast(
    "Nota berhasil dihapus"
  );


  if (
    typeof renderDaftarNota ===
    "function"
  ) {

    await renderDaftarNota();

  }


  return true;

}


/* =========================================================
   RENDER DAFTAR NOTA
   ========================================================= */

async function renderDaftarNota(
  containerId = "daftarNota"
) {

  const container =
    document.getElementById(
      containerId
    );


  if (!container) {

    return;

  }


  const data =
    await loadNota();


  if (
    data.length === 0
  ) {

    container.innerHTML = `
      <p>
        Belum ada nota.
      </p>
    `;

    return;

  }


  container.innerHTML =
    data.map(
      function(item) {

        return `

          <div
            class="nota-item"
            data-nota-id="${escapeHTML(
              item.id
            )}"
          >

            <div>

              <strong>
                ${escapeHTML(
                  item.nomorNota
                )}
              </strong>

              <small>
                ${escapeHTML(
                  item.tanggal
                )}
              </small>

              <span>
                ${number(
                  item.jumlahItem
                )}
                item ·
                ${rupiah(
                  item.total
                )}
              </span>

            </div>

            <div>

              <button
                type="button"
                onclick="bukaNota('${escapeHTML(
                  item.id
                )}')"
              >
                Buka
              </button>

              <button
                type="button"
                onclick="hapusNota('${escapeHTML(
                  item.id
                )}')"
              >
                Hapus
              </button>

            </div>

          </div>

        `;

      }
    ).join("");

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


  if (barang.length === 0) {

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


  if (data.length === 0) {

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


  if (data.length === 0) {

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
                ${number(
                  item.qty
                )}
                pcs
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


  clearTimeout(
    toast._timer
  );


  toast._timer =
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
   FORM TRANSAKSI
   ========================================================= */

function initTransaksiForm() {

  const form =
    document.getElementById(
      "transaksiForm"
    );


  if (!form) {

    return;

  }


  if (
    form.dataset.initialized ===
    "1"
  ) {

    return;

  }


  form.dataset.initialized =
    "1";


  form.addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();


      try {

        const formData =
          new FormData(
            form
          );


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
          "Simpan transaksi:",
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
   FORM BARANG
   ========================================================= */

function initBarangForm() {

  const form =
    document.getElementById(
      "barangForm"
    );


  if (!form) {

    return;

  }


  if (
    form.dataset.initialized ===
    "1"
  ) {

    return;

  }


  form.dataset.initialized =
    "1";


  form.addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();


      try {

        const formData =
          new FormData(
            form
          );


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


        await fillBarangSelect(
          "barangId"
        );

      }

      catch (error) {

        console.error(
          "Simpan barang:",
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
   FORM PENJUALAN
   ========================================================= */

function initPenjualanForm() {

  const form =
    document.getElementById(
      "penjualanForm"
    );


  if (!form) {

    return;

  }


  if (
    form.dataset.initialized ===
    "1"
  ) {

    return;

  }


  form.dataset.initialized =
    "1";


  form.addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();


      try {

        const formData =
          new FormData(
            form
          );


        await savePenjualan({

  tanggal:
    formData.get(
      "tanggal"
    ) ||
    today(),

  barangId:
    formData.get(
      "barangId"
    ),

  qty:
    formData.get(
      "qty"
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


        await fillBarangSelect(
          "barangId"
        );

      }

      catch (error) {

        console.error(
          "Simpan penjualan:",
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
   SELECT BARANG
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
    "";


  const defaultOption =
    document.createElement(
      "option"
    );


  defaultOption.value =
    "";


  defaultOption.textContent =
    "Pilih barang";


  select.appendChild(
    defaultOption
  );


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
        number(
          item.stok
        );


      option.dataset.harga =
        number(
          item.hargaJual
        );


      option.dataset.modal =
        number(
          item.hargaModal
        );


      select.appendChild(
        option
      );

    }
  );

}


/* =========================================================
   SELECT BARANG PENJUALAN
   NAMA + HARGA + STOK + TOTAL
   ========================================================= */

function initBarangSelect() {

  const select =
    document.getElementById(
      "barangId"
    );


  const qty =
    document.getElementById(
      "qtyPenjualan"
    );


  const nama =
    document.getElementById(
      "namaBarangPenjualan"
    );


  const harga =
    document.getElementById(
      "hargaBarangPenjualan"
    );


  const stok =
    document.getElementById(
      "stokBarangPenjualan"
    );


  const info =
    document.getElementById(
      "infoBarangPenjualan"
    );


  const total =
    document.getElementById(
      "totalPenjualan"
    );


  if (
    !select ||
    !qty ||
    !nama ||
    !harga ||
    !stok ||
    !info ||
    !total
  ) {

    console.warn(
      "Form penjualan belum lengkap"
    );

    return;

  }


  const totalValue =
    total.querySelector(
      "strong"
    );


  /*
   * DATA BARANG YANG DIPILIH
   */

  let barangTerpilih =
    null;


  /*
   * HITUNG TOTAL
   */

  function hitungTotal() {

    const jumlah =
      number(
        qty.value
      );


    const hargaJual =
      barangTerpilih
        ? number(
            barangTerpilih.hargaJual
          )
        : 0;


    const hasil =
      jumlah *
      hargaJual;


    if (totalValue) {

      totalValue.textContent =
        rupiah(
          hasil
        );

    }


    total.dataset.value =
      String(
        hasil
      );


    return hasil;

  }


  /*
   * SAAT PILIH BARANG
   */

  select.addEventListener(
    "change",
    async function() {

      const barangId =
        select.value;


      if (!barangId) {

        barangTerpilih =
          null;


        info.style.display =
          "none";


        nama.textContent =
          "-";


        harga.textContent =
          "Rp0";


        stok.textContent =
          "0";


        hitungTotal();

        return;

      }


      try {

        barangTerpilih =
          await dbGet(
            STORES.barang,
            barangId
          );


        if (!barangTerpilih) {

          throw new Error(
            "Data barang tidak ditemukan"
          );

        }


        /*
         * TAMPILKAN NAMA
         */

        nama.textContent =
          barangTerpilih.nama ||
          "-";


        /*
         * TAMPILKAN HARGA
         */

        harga.textContent =
          rupiah(
            barangTerpilih.hargaJual
          );


        /*
         * TAMPILKAN STOK
         */

        stok.textContent =
          number(
            barangTerpilih.stok
          );


        /*
         * TAMPILKAN INFO
         */

        info.style.display =
          "grid";


        /*
         * HITUNG TOTAL
         */

        hitungTotal();

      }

      catch (error) {

        console.error(
          "Pilih barang:",
          error
        );


        barangTerpilih =
          null;


        info.style.display =
          "none";


        showToast(
          error.message
        );

      }

    }
  );


  /*
   * SAAT JUMLAH DIKETIK
   */

  qty.addEventListener(
    "input",
    function() {

      hitungTotal();

    }
  );


  /*
   * SAAT FORM RESET
   */

  const form =
    document.getElementById(
      "penjualanForm"
    );


  if (form) {

    form.addEventListener(
      "reset",
      function() {

        setTimeout(
          function() {

            barangTerpilih =
              null;


            info.style.display =
              "none";


            nama.textContent =
              "-";


            harga.textContent =
              "Rp0";


            stok.textContent =
              "0";


            if (totalValue) {

              totalValue.textContent =
                "Rp0";

            }

          },
          0
        );

      }
    );

  }


  /*
   * TOTAL AWAL
   */

  hitungTotal();

}
/* =========================================================
   MANUAL SYNC
   ========================================================= */

async function manualSync() {

  if (!navigator.onLine) {

    showToast(
      "Tidak ada internet"
    );

    return;

  }


  if (APP_STATE.syncing) {

    showToast(
      "Sinkronisasi sedang berjalan"
    );

    return;

  }


  try {

    showToast(
      "Sinkronisasi..."
    );


    /*
     * 1. KIRIM DATA LOKAL
     */

    await syncQueue();


    /*
     * 2. CEK QUEUE
     */

    const queueCount =
      await getQueueCount();


    /*
     * 3. DOWNLOAD SERVER
     * HANYA JIKA QUEUE SUDAH HABIS
     */

    if (
      queueCount === 0
    ) {

      await downloadData();

    }


    /*
     * 4. REFRESH UI
     */

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


    await updateSyncStatus();


    const sisa =
      await getQueueCount();


    if (sisa === 0) {

      showToast(
        "✓ Semua data sudah sinkron"
      );

    }

    else {

      showToast(
        sisa +
        " data masih menunggu sync"
      );

    }

  }

  catch (error) {

    console.error(
      "MANUAL SYNC ERROR:",
      error
    );


    showToast(
      "Sync gagal: " +
      error.message
    );

  }

}


/* =========================================================
   REFRESH APP
   ========================================================= */

async function refreshApp() {

  try {

    if (navigator.onLine) {

      /*
       * 1. KIRIM DATA LOKAL
       */

      await syncQueue();


      /*
       * 2. CEK QUEUE
       */

      const queueCount =
        await getQueueCount();


      /*
       * 3. DOWNLOAD SERVER
       */

      if (
        queueCount === 0
      ) {

        await downloadData();

      }

    }


    /*
     * REFRESH LOKAL
     */

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


    await updateSyncStatus();


    console.log(
      "APP BERHASIL DIREFRESH"
    );

  }

  catch (error) {

    console.error(
      "REFRESH ERROR:",
      error
    );

  }

}


/* =========================================================
   INIT APP
   ========================================================= */

async function initApp() {

  if (
    APP_STATE.initialized
  ) {

    return;

  }


  APP_STATE.initialized =
    true;


  console.log(
    "CatatKu mulai..."
  );


  try {

    /*
     * 1. BUKA DATABASE
     */

    await openDB();


    console.log(
      "IndexedDB siap:",
      DB_NAME
    );


    /*
     * 2. STATUS ONLINE
     */

    updateOnlineStatus();


    /*
     * 3. FORM
     */

    initTransaksiForm();

    initBarangForm();

    initPenjualanForm();

    initBarangSelect();


    /*
     * 4. LOAD LOKAL DAHULU
     */

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


    /*
     * 5. ONLINE
     */

    if (navigator.onLine) {

      const connected =
        await testGAS();


      if (connected) {

        /*
         * KIRIM QUEUE LOKAL DAHULU
         */

        await syncQueue();


        /*
         * CEK QUEUE
         */

        const queueCount =
          await getQueueCount();


        /*
         * DOWNLOAD SERVER
         * HANYA SETELAH QUEUE SELESAI
         */

        if (
          queueCount === 0
        ) {

          await downloadData();

        }


        /*
         * REFRESH TAMPILAN
         */

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
   ========================================================= */

window.CatatKu = {

  saveTransaksi:
    saveTransaksi,

  saveBarang:
    saveBarang,

  savePenjualan:
    savePenjualan,

  buatNota:
    buatNota,

  loadNota:
    loadNota,

  loadNotaDetail:
    loadNotaDetail,

  bukaNota:
    bukaNota,
  printNota:
    printNota,

  tutupDetailNota:
    tutupDetailNota,
   
  hapusNota:
    hapusNota,

  renderDaftarNota:
    renderDaftarNota,

  toggleNotaItem:
    toggleNotaItem,

  toggleSemuaNota:
    toggleSemuaNota,

  updateNotaSummary:
    updateNotaSummary,

  loadBarang:
    loadBarang,

  loadTransaksi:
    loadTransaksi,

  loadPenjualan:
    loadPenjualan,

  loadDashboard:
    loadDashboard,
  pilihPeriodeRingkasan:
    pilihPeriodeRingkasan,
   
  sync:
    manualSync,

  refresh:
    refreshApp,

  testGAS:
    testGAS,

  downloadData:
    downloadData,

  getQueueCount:
    getQueueCount

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
    initApp,
    {
      once:
        true
    }
  );

}

else {

  initApp();

}
/* =========================================================
   DASHBOARD PERIODE
   HARI INI / KEMARIN / MINGGU INI
   ========================================================= */

CatatKu.dashboardPeriod =
  "hariIni";


CatatKu.setDashboardPeriod =
  async function(period) {

    CatatKu.dashboardPeriod =
      period;


    /*
     * Tombol aktif
     */

    document
      .querySelectorAll(
        ".period-btn"
      )
      .forEach(
        function(button) {

          button.classList.toggle(
            "active",
            button.dataset.period === period
          );

        }
      );


    /*
     * Hitung ulang dashboard
     */

    await CatatKu.renderDashboardPeriod();

  };


CatatKu.renderDashboardPeriod =
  async function() {

    try {

      /*
       * Ambil transaksi
       */

      const transaksi =
        await dbGetAll(
          STORES.transaksi
        );


      const penjualan =
        await dbGetAll(
          STORES.penjualan
        );


      /*
       * Tentukan tanggal
       */

      const sekarang =
        new Date();


      const hariIni =
        new Date(
          sekarang.getFullYear(),
          sekarang.getMonth(),
          sekarang.getDate()
        );


      const kemarin =
        new Date(
          hariIni
        );

      kemarin.setDate(
        kemarin.getDate() - 1
      );


      /*
       * Awal minggu
       * Senin
       */

      const awalMinggu =
        new Date(
          hariIni
        );


      const hari =
        awalMinggu.getDay();


      const selisih =
        hari === 0
          ? 6
          : hari - 1;


      awalMinggu.setDate(
        awalMinggu.getDate() - selisih
      );


      /*
       * Akhir minggu
       */

      const akhirMinggu =
        new Date(
          awalMinggu
        );

      akhirMinggu.setDate(
        akhirMinggu.getDate() + 7
      );


      /*
       * Fungsi tanggal
       */

      function tanggalObj(
        value
      ) {

        if (!value) {

          return null;

        }


        const d =
          new Date(
            value
          );


        if (
          Number.isNaN(
            d.getTime()
          )
        ) {

          return null;

        }


        return new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate()
        );

      }


      /*
       * Filter transaksi
       */

      function masukPeriode(
        value
      ) {

        const tanggal =
          tanggalObj(
            value
          );


        if (!tanggal) {

          return false;

        }


        if (
          CatatKu.dashboardPeriod ===
          "hariIni"
        ) {

          return (
            tanggal.getTime() ===
            hariIni.getTime()
          );

        }


        if (
          CatatKu.dashboardPeriod ===
          "kemarin"
        ) {

          return (
            tanggal.getTime() ===
            kemarin.getTime()
          );

        }


        if (
          CatatKu.dashboardPeriod ===
          "mingguIni"
        ) {

          return (
            tanggal >= awalMinggu &&
            tanggal < akhirMinggu
          );

        }


        return false;

      }


      /*
       * Hitung uang masuk
       */

      let pemasukan =
        0;


      let pengeluaran =
        0;


      transaksi
        .filter(
          function(item) {

            return masukPeriode(
              item.tanggal
            );

          }
        )
        .forEach(
          function(item) {

            const jumlah =
              Number(
                item.jumlah
              ) || 0;


            if (
              String(
                item.jenis
              ).toLowerCase() ===
              "masuk"
            ) {

              pemasukan +=
                jumlah;

            }


            if (
              String(
                item.jenis
              ).toLowerCase() ===
              "keluar"
            ) {

              pengeluaran +=
                jumlah;

            }

          }
        );


      /*
       * Hitung omzet
       */

      let omzet =
        0;


      let untung =
        0;


      penjualan
        .filter(
          function(item) {

            return masukPeriode(
              item.tanggal
            );

          }
        )
        .forEach(
          function(item) {

            const total =
              Number(
                item.omzet
              ) ||
              Number(
                item.total
              ) ||
              0;


            const modal =
              Number(
                item.totalModal
              ) ||
              (
                Number(
                  item.hargaModal
                ) || 0
              ) *
              (
                Number(
                  item.qty
                ) || 0
              );


            omzet +=
              total;


            untung +=
              total - modal;

          }
        );


      /*
       * Tampilkan
       */

      setDashboardValue(
        "summaryPemasukan",
        pemasukan
      );


      setDashboardValue(
        "summaryPengeluaran",
        pengeluaran
      );


      setDashboardValue(
        "omzet",
        omzet
      );


      setDashboardValue(
        "untung",
        untung
      );

    }

    catch (error) {

      console.error(
        "Dashboard periode:",
        error
      );

    }

  };


/* =========================================================
   FORMAT DASHBOARD
   ========================================================= */

function setDashboardValue(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (!element) {

    return;

  }


  element.textContent =
    formatRupiah(
      Number(value) || 0
    );

}
/* =========================================================
   RINGKASAN DASHBOARD
   ========================================================= */

CatatKu.pilihPeriodeRingkasan = async function (
  periode
) {

  try {

    /* -----------------------------------------
       tombol aktif
       ----------------------------------------- */

    document
      .querySelectorAll(
        ".periode-btn"
      )
      .forEach(
        function(button) {

          button.classList.toggle(
            "active",
            button.dataset.periode === periode
          );

        }
      );


    /* -----------------------------------------
       nama periode
       ----------------------------------------- */

    const namaPeriode = {

      hariIni: "Hari Ini",

      kemarin: "Kemarin",

      mingguIni: "Minggu Ini",

      bulanIni: "Bulan Ini"

    };


    const label =
      document.getElementById(
        "ringkasanPeriode"
      );


    if (label) {

      label.textContent =
        namaPeriode[periode] ||
        "Hari Ini";

    }


    /* -----------------------------------------
       ambil data
       ----------------------------------------- */

    const semuaTransaksi =
      await dbGetAll(
        STORES.transaksi
      );


    const semuaPenjualan =
      await dbGetAll(
        STORES.penjualan
      );


    const sekarang =
      new Date();


    const tanggalHariIni =
      tanggalLocal(
        sekarang
      );


    const kemarinDate =
      new Date(
        sekarang
      );

    kemarinDate.setDate(
      kemarinDate.getDate() - 1
    );


    const tanggalKemarin =
      tanggalLocal(
        kemarinDate
      );


    function tanggalLocal(date) {

      const y =
        date.getFullYear();

      const m =
        String(
          date.getMonth() + 1
        ).padStart(2, "0");

      const d =
        String(
          date.getDate()
        ).padStart(2, "0");

      return (
        y +
        "-" +
        m +
        "-" +
        d
      );

    }


    function awalMinggu(date) {

      const d =
        new Date(date);

      const hari =
        d.getDay();

      const selisih =
        hari === 0
          ? 6
          : hari - 1;

      d.setDate(
        d.getDate() - selisih
      );

      return tanggalLocal(d);

    }


    function awalBulan(date) {

      return (
        date.getFullYear() +
        "-" +
        String(
          date.getMonth() + 1
        ).padStart(2, "0") +
        "-01"
      );

    }


    const awalMingguIni =
      awalMinggu(
        sekarang
      );


    const awalBulanIni =
      awalBulan(
        sekarang
      );


    function masukPeriode(
      tanggal
    ) {

      const t =
        String(
          tanggal || ""
        ).slice(0, 10);


      if (periode === "hariIni") {

        return t ===
          tanggalHariIni;

      }


      if (periode === "kemarin") {

        return t ===
          tanggalKemarin;

      }


      if (periode === "mingguIni") {

        return t >=
          awalMingguIni &&
          t <=
          tanggalHariIni;

      }


      if (periode === "bulanIni") {

        return t >=
          awalBulanIni &&
          t <=
          tanggalHariIni;

      }


      return false;

    }


    /* -----------------------------------------
       HITUNG UANG
       ----------------------------------------- */

    let uangMasuk = 0;
    let uangKeluar = 0;


    semuaTransaksi.forEach(
      function(item) {

        if (
          !masukPeriode(
            item.tanggal
          )
        ) {

          return;

        }


        const jumlah =
          Number(
            item.jumlah
          ) || 0;


        if (
          item.jenis === "masuk"
        ) {

          uangMasuk +=
            jumlah;

        }


        if (
          item.jenis === "keluar"
        ) {

          uangKeluar +=
            jumlah;

        }

      }
    );


    /* -----------------------------------------
       HITUNG PENJUALAN
       ----------------------------------------- */

    let omzet = 0;
    let untung = 0;


    semuaPenjualan.forEach(
      function(item) {

        if (
          !masukPeriode(
            item.tanggal
          )
        ) {

          return;

        }


        omzet +=
          Number(
            item.omzet
          ) || 0;


        untung +=
          Number(
            item.untung
          ) || 0;

      }
    );


    /* -----------------------------------------
       TAMPILKAN
       ----------------------------------------- */

    setRingkasanValue(
      "ringkasanUangMasuk",
      uangMasuk
    );

    setRingkasanValue(
      "ringkasanUangKeluar",
      uangKeluar
    );

    setRingkasanValue(
      "ringkasanOmzet",
      omzet
    );

    setRingkasanValue(
      "ringkasanUntung",
      untung
    );


    /* -----------------------------------------
       DATA STOK
       ----------------------------------------- */

    const barang =
      await dbGetAll(
        STORES.barang
      );


    let jumlahStok = 0;
    let nilaiStok = 0;


    barang.forEach(
      function(item) {

        const stok =
          Number(
            item.stok
          ) || 0;

        const modal =
          Number(
            item.hargaModal
          ) || 0;


        jumlahStok +=
          stok;

        nilaiStok +=
          stok * modal;

      }
    );


    setRingkasanValue(
      "ringkasanNilaiStok",
      nilaiStok
    );


    setRingkasanNumber(
      "ringkasanJumlahBarang",
      barang.length
    );


    setRingkasanNumber(
      "ringkasanJumlahStok",
      jumlahStok
    );


    /* -----------------------------------------
       HUTANG
       ----------------------------------------- */

    let totalHutang = 0;


    try {

      const hutang =
        await dbGetAll(
          STORES.hutang
        );


      hutang.forEach(
        function(item) {

          const total =
            Number(
              item.total ||
              item.jumlah ||
              item.nominal
            ) || 0;


          const bayar =
            Number(
              item.dibayar ||
              item.bayar
            ) || 0;


          totalHutang +=
            Math.max(
              0,
              total - bayar
            );

        }
      );

    }
    catch (e) {

      console.warn(
        "Data hutang belum tersedia",
        e
      );

    }


    setRingkasanValue(
      "ringkasanHutang",
      totalHutang
    );

  }
  catch (error) {

    console.error(
      "Ringkasan:",
      error
    );

  }

};


/* =========================================================
   HELPER RINGKASAN
   ========================================================= */

function setRingkasanValue(
  id,
  value
) {

  const element =
    document.getElementById(id);


  if (!element) {

    return;

  }


  element.textContent =
    formatRupiah(
      Number(value) || 0
    );

}


function setRingkasanNumber(
  id,
  value
) {

  const element =
    document.getElementById(id);


  if (!element) {

    return;

  }


  element.textContent =
    Number(value) || 0;

}
let periodeRingkasanAktif = "hariIni";


function pilihPeriodeRingkasan(periode) {

  periodeRingkasanAktif = periode;


  /* ===============================
     UPDATE TOMBOL
     =============================== */

  document
    .querySelectorAll(".periode-btn")
    .forEach(btn => {

      btn.classList.toggle(
        "active",
        btn.dataset.periode === periode
      );

    });


  /* ===============================
     LABEL PERIODE
     =============================== */

  const label = {

    hariIni:
      "Hari Ini",

    kemarin:
      "Kemarin",

    mingguIni:
      "Minggu Ini",

    bulanIni:
      "Bulan Ini"

  };


  const labelElement =
    document.getElementById(
      "ringkasanPeriode"
    );


  if (labelElement) {

    labelElement.textContent =
      label[periode] ||
      "Hari Ini";

  }


  /* ===============================
     RENDER DATA
     =============================== */

  renderRingkasanPeriode(
    periode
  );

}
