/* =========================================================
   CATATKU
   app.js - FINAL SYNC + NOTA
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
   - Nomor nota otomatis
   - Cetak nota
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
  3;


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


/* =========================================================
   NOMOR NOTA
   ========================================================= */

function generateNomorNota() {

  const d =
    new Date();

  const tanggal =
    d.getFullYear() +
    String(
      d.getMonth() + 1
    ).padStart(
      2,
      "0"
    ) +
    String(
      d.getDate()
    ).padStart(
      2,
      "0"
    );

  const jam =
    String(
      d.getHours()
    ).padStart(
      2,
      "0"
    );

  const menit =
    String(
      d.getMinutes()
    ).padStart(
      2,
      "0"
    );

  const detik =
    String(
      d.getSeconds()
    ).padStart(
      2,
      "0"
    );

  const random =
    Math.floor(
      Math.random() * 1000
    )
      .toString()
      .padStart(
        3,
        "0"
      );

  return (
    "NOTA-" +
    tanggal +
    "-" +
    jam +
    menit +
    detik +
    random
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

  const n =
    Number(
      String(value)
        .replace(
          /[^\d.-]/g,
          ""
        )
    );

  return Number.isFinite(n)
    ? n
    : 0;

}


/* =========================================================
   RUPIAH
   ========================================================= */

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


/* =========================================================
   TODAY
   ========================================================= */

function today() {

  const d =
    new Date();

  const tahun =
    d.getFullYear();

  const bulan =
    String(
      d.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const tanggal =
    String(
      d.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    tahun +
    "-" +
    bulan +
    "-" +
    tanggal
  );

}


/* =========================================================
   NOW ISO
   ========================================================= */

function nowISO() {

  return new Date()
    .toISOString();

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

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


  /* =======================================================
     DATA PENJUALAN + NOTA
     ======================================================= */

  const penjualan = {

    id:
      data.id ||
      uid("JUAL"),

    nomorNota:
      data.nomorNota ||
      generateNomorNota(),

    tanggal:
      data.tanggal ||
      today(),

    jam:
      new Date().toLocaleTimeString(
        "id-ID",
        {
          hour:
            "2-digit",

          minute:
            "2-digit"
        }
      ),

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


  /* =======================================================
     SIMPAN LOKAL
     ======================================================= */

  await dbPut(
    STORES.penjualan,
    penjualan
  );


  await dbPut(
    STORES.barang,
    barangBaru
  );


  /* =======================================================
     MASUK QUEUE
     ======================================================= */

  await queueAdd(
    "penjualan",
    penjualan
  );


  /* =======================================================
     AUTO SYNC
     ======================================================= */

  if (navigator.onLine) {

    await syncQueue();

  }


  showToast(
    "Penjualan tersimpan • " +
    penjualan.nomorNota
  );


  return penjualan;

}


/* =========================================================
   CETAK NOTA
   ========================================================= */

function cetakNota(
  penjualan
) {

  if (!penjualan) {

    showToast(
      "Data nota tidak ditemukan"
    );

    return;

  }


  const nomorNota =
    penjualan.nomorNota ||
    "-";


  const tanggal =
    penjualan.tanggal ||
    today();


  const jam =
    penjualan.jam ||
    new Date().toLocaleTimeString(
      "id-ID",
      {
        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    );


  const namaBarang =
    penjualan.namaBarang ||
    "Barang";


  const qty =
    number(
      penjualan.qty
    );


  const harga =
    number(
      penjualan.hargaJual
    );


  const total =
    number(
      penjualan.omzet
    );


  const html = `

<!DOCTYPE html>

<html lang="id">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>
  ${escapeHTML(nomorNota)}
</title>

<style>

* {
  box-sizing: border-box;
}

body {

  margin: 0;

  padding: 10px;

  background: #fff;

  color: #000;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

}

.nota {

  width: 100%;

  max-width: 380px;

  margin: auto;

}

.header {

  text-align: center;

  margin-bottom: 12px;

}

.nama-toko {

  font-size: 22px;

  font-weight: 700;

}

.alamat {

  font-size: 12px;

  margin-top: 3px;

}

hr {

  border: 0;

  border-top:
    1px dashed #000;

  margin:
    10px 0;

}

.info {

  font-size: 12px;

  line-height: 1.5;

}

.row {

  display: flex;

  justify-content:
    space-between;

  gap: 10px;

}

.item {

  margin-top: 12px;

}

.item-nama {

  font-weight: 700;

  font-size: 14px;

}

.detail {

  display: flex;

  justify-content:
    space-between;

  font-size: 13px;

  margin-top: 5px;

}

.total {

  display: flex;

  justify-content:
    space-between;

  font-size: 18px;

  font-weight: 700;

  margin-top: 10px;

}

.footer {

  text-align: center;

  font-size: 12px;

  margin-top: 20px;

}

.tombol {

  display: block;

  width: 100%;

  padding: 12px;

  margin-top: 20px;

  background: #2563eb;

  color: white;

  border: 0;

  border-radius: 8px;

  font-size: 16px;

}

@media print {

  body {

    padding: 0;

  }

  .tombol {

    display: none;

  }

  .nota {

    max-width: none;

  }

}

</style>

</head>

<body>

<div class="nota">

  <div class="header">

    <div class="nama-toko">
      CATATKU
    </div>

    <div class="alamat">
      Keuangan & Penjualan
    </div>

  </div>

  <hr>

  <div class="info">

    <div class="row">

      <span>
        No. Nota
      </span>

      <strong>
        ${escapeHTML(nomorNota)}
      </strong>

    </div>

    <div class="row">

      <span>
        Tanggal
      </span>

      <span>
        ${escapeHTML(tanggal)}
      </span>

    </div>

    <div class="row">

      <span>
        Jam
      </span>

      <span>
        ${escapeHTML(jam)}
      </span>

    </div>

  </div>

  <hr>

  <div class="item">

    <div class="item-nama">

      ${escapeHTML(namaBarang)}

    </div>

    <div class="detail">

      <span>
        ${qty} x ${rupiah(harga)}
      </span>

      <strong>
        ${rupiah(total)}
      </strong>

    </div>

  </div>

  <hr>

  <div class="total">

    <span>
      TOTAL
    </span>

    <span>
      ${rupiah(total)}
    </span>

  </div>

  <div class="footer">

    Terima kasih

    <br>

    Barang yang sudah dibeli
    tidak dapat dikembalikan
    kecuali sesuai ketentuan toko.

  </div>

  <button
    class="tombol"
    onclick="window.print()"
  >
    🖨️ CETAK NOTA
  </button>

</div>

</body>

</html>

`;


  const win =
    window.open(
      "",
      "_blank",
      "width=450,height=700"
    );


  if (!win) {

    showToast(
      "Popup diblokir browser. Izinkan popup untuk CatatKu."
    );

    return;

  }


  win.document.open();

  win.document.write(
    html
  );

  win.document.close();

}


/* =========================================================
   CETAK NOTA BERDASARKAN ID
   ========================================================= */

async function cetakNotaById(
  id
) {

  if (!id) {

    showToast(
      "ID penjualan tidak ditemukan"
    );

    return;

  }


  try {

    const penjualan =
      await dbGet(
        STORES.penjualan,
        id
      );


    if (!penjualan) {

      showToast(
        "Data penjualan tidak ditemukan"
      );

      return;

    }


    cetakNota(
      penjualan
    );

  }

  catch (error) {

    console.error(
      "Cetak nota:",
      error
    );

    showToast(
      error.message
    );

  }

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


  /* =======================================================
     DATA YANG MASIH MENUNGGU SYNC
     ======================================================= */

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

/* =========================================================
   RENDER PENJUALAN
   + TOMBOL CETAK NOTA
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

          <div
            class="penjualan-item"
            data-id="${escapeHTML(item.id)}"
          >

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


            <div
              style="
                margin-top:8px;
              "
            >

              <button
                type="button"
                class="btn-cetak-nota"
                onclick="
                  cetakNota(
                    '${String(item.id)
                      .replace(/'/g, "\\'")}'
                  )
                "
              >

                🧾 Cetak Nota

              </button>

            </div>

          </div>

        `;

      }
    ).join("");

}
/* =========================================================
   CETAK NOTA PENJUALAN
   ========================================================= */

/* =========================================================
   CETAK NOTA PENJUALAN
   VERSI AMAN INDEXEDDB
   ========================================================= */

async function cetakNota(penjualanId) {

  try {

    /* =====================================================
       VALIDASI ID
       ===================================================== */

    if (
      penjualanId === undefined ||
      penjualanId === null
    ) {

      showToast(
        "ID penjualan tidak ditemukan"
      );

      return;

    }


    /* =====================================================
       PASTIKAN ID MENJADI STRING
       ===================================================== */

    penjualanId =
      String(
        penjualanId
      ).trim();


    if (!penjualanId) {

      showToast(
        "ID penjualan kosong"
      );

      return;

    }


    console.log(
      "CETAK NOTA ID:",
      penjualanId,
      "TYPE:",
      typeof penjualanId
    );


    /* =====================================================
       AMBIL DATA PENJUALAN DARI INDEXEDDB
       ===================================================== */

    const penjualan =
      await dbGet(
        STORES.penjualan,
        penjualanId
      );


    if (!penjualan) {

      showToast(
        "Data penjualan tidak ditemukan"
      );

      console.warn(
        "Penjualan tidak ditemukan:",
        penjualanId
      );

      return;

    }


    /* =====================================================
       DATA NOTA
       ===================================================== */

    const qty =
      number(
        penjualan.qty
      );


    const hargaJual =
      number(
        penjualan.hargaJual
      );


    const omzet =
      number(
        penjualan.omzet
      );


    const untung =
      number(
        penjualan.untung
      );


    const modal =
      number(
        penjualan.modal
      );


    const nomorNota =
      String(
        penjualan.id ||
        uid("NOTA")
      );


    const tanggal =
      penjualan.tanggal ||
      today();


    let waktu =
      tanggal;


    if (
      penjualan.createdAt
    ) {

      try {

        const tanggalWaktu =
          new Date(
            penjualan.createdAt
          );

        if (
          !isNaN(
            tanggalWaktu.getTime()
          )
        ) {

          waktu =
            tanggalWaktu.toLocaleString(
              "id-ID"
            );

        }

      }

      catch (error) {

        console.warn(
          "Waktu nota tidak valid:",
          error
        );

      }

    }


    /* =====================================================
       HTML NOTA
       ===================================================== */

    const html = `

<!DOCTYPE html>

<html lang="id">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>
  Nota ${escapeHTML(nomorNota)}
</title>

<style>

* {
  box-sizing: border-box;
}

body {

  margin: 0;

  padding: 15px;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  background: #fff;

  color: #111;

}

.nota {

  width: 80mm;

  max-width: 100%;

  margin: 0 auto;

}

.header {

  text-align: center;

  margin-bottom: 12px;

}

.nama-toko {

  font-size: 20px;

  font-weight: 700;

}

.subjudul {

  font-size: 12px;

  margin-top: 3px;

}

.garis {

  border-top:
    1px dashed #000;

  margin:
    10px 0;

}

.info {

  font-size: 12px;

  line-height: 1.6;

}

.item {

  margin-top: 10px;

}

.nama-barang {

  font-size: 14px;

  font-weight: 700;

}

.detail {

  display: flex;

  justify-content: space-between;

  font-size: 12px;

  margin-top: 4px;

}

.total {

  display: flex;

  justify-content: space-between;

  font-size: 16px;

  font-weight: 700;

  margin-top: 8px;

}

.terima {

  text-align: center;

  margin-top: 15px;

  font-size: 12px;

}

.tombol {

  text-align: center;

  margin-top: 20px;

}

button {

  border: 0;

  padding:
    10px 18px;

  border-radius: 8px;

  font-size: 14px;

  cursor: pointer;

}

@media print {

  @page {

    size: 80mm auto;

    margin: 3mm;

  }

  body {

    padding: 0;

  }

  .nota {

    width: 100%;

  }

  .tombol {

    display: none;

  }

}

</style>

</head>

<body>

<div class="nota">

  <div class="header">

    <div class="nama-toko">
      CATATKU
    </div>

    <div class="subjudul">
      Nota Penjualan
    </div>

  </div>


  <div class="garis"></div>


  <div class="info">

    <div>
      No:
      ${escapeHTML(nomorNota)}
    </div>

    <div>
      Tanggal:
      ${escapeHTML(tanggal)}
    </div>

    <div>
      Waktu:
      ${escapeHTML(waktu)}
    </div>

  </div>


  <div class="garis"></div>


  <div class="item">

    <div class="nama-barang">

      ${escapeHTML(
        penjualan.namaBarang ||
        "Barang"
      )}

    </div>


    <div class="detail">

      <span>
        ${qty} x ${rupiah(hargaJual)}
      </span>

      <span>
        ${rupiah(omzet)}
      </span>

    </div>

  </div>


  <div class="garis"></div>


  <div class="total">

    <span>
      TOTAL
    </span>

    <span>
      ${rupiah(omzet)}
    </span>

  </div>


  <div class="garis"></div>


  <div class="terima">

    Terima kasih

    <br>

    atas pembelian Anda.

  </div>


  <div class="tombol">

    <button
      type="button"
      onclick="window.print()"
    >
      🖨 Cetak Nota
    </button>

  </div>

</div>


<script>

window.onload = function() {

  setTimeout(
    function() {

      window.print();

    },
    500
  );

};

</script>

</body>

</html>

`;


    /* =====================================================
       BUKA JENDELA CETAK
       ===================================================== */

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=420,height=700"
      );


    if (!printWindow) {

      showToast(
        "Popup diblokir Chrome. Izinkan popup untuk mencetak nota."
      );

      return;

    }


    printWindow.document.open();

    printWindow.document.write(
      html
    );

    printWindow.document.close();


  }

  catch (error) {

    console.error(
      "Cetak nota:",
      error
    );

    showToast(
      "Gagal mencetak nota: " +
      error.message
    );

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


        /* =================================================
           SIMPAN PENJUALAN
           ================================================= */

        const penjualan =
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


        /* =================================================
           BUKA NOTA
           ================================================= */

        setTimeout(
          function() {

            cetakNota(
              penjualan
            );

          },
          300
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


  /* =================================================
     DATA BARANG
     ================================================= */

  let barangTerpilih =
    null;


  /* =================================================
     HITUNG TOTAL
     ================================================= */

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


  /* =================================================
     SAAT PILIH BARANG
     ================================================= */

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


        nama.textContent =
          barangTerpilih.nama ||
          "-";


        harga.textContent =
          rupiah(
            barangTerpilih.hargaJual
          );


        stok.textContent =
          number(
            barangTerpilih.stok
          );


        info.style.display =
          "grid";


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


  /* =================================================
     SAAT JUMLAH DIKETIK
     ================================================= */

  qty.addEventListener(
    "input",
    function() {

      hitungTotal();

    }
  );


  /* =================================================
     SAAT FORM RESET
     ================================================= */

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


  /* =================================================
     TOTAL AWAL
     ================================================= */

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


    /* =================================================
       1. KIRIM DATA LOKAL
       ================================================= */

    await syncQueue();


    /* =================================================
       2. CEK QUEUE
       ================================================= */

    const queueCount =
      await getQueueCount();


    /* =================================================
       3. DOWNLOAD SERVER
       HANYA JIKA QUEUE HABIS
       ================================================= */

    if (
      queueCount === 0
    ) {

      await downloadData();

    }


    /* =================================================
       4. REFRESH UI
       ================================================= */

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

      /* =================================================
         1. KIRIM DATA LOKAL
         ================================================= */

      await syncQueue();


      /* =================================================
         2. CEK QUEUE
         ================================================= */

      const queueCount =
        await getQueueCount();


      /* =================================================
         3. DOWNLOAD SERVER
         ================================================= */

      if (
        queueCount === 0
      ) {

        await downloadData();

      }

    }


    /* =================================================
       REFRESH LOKAL
       ================================================= */

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

    /* =================================================
       1. BUKA DATABASE
       ================================================= */

    await openDB();


    console.log(
      "IndexedDB siap:",
      DB_NAME
    );


    /* =================================================
       2. STATUS ONLINE
       ================================================= */

    updateOnlineStatus();


    /* =================================================
       3. FORM
       ================================================= */

    initTransaksiForm();

    initBarangForm();

    initPenjualanForm();

    initBarangSelect();


    /* =================================================
       4. LOAD LOKAL DAHULU
       ================================================= */

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


    /* =================================================
       5. ONLINE
       ================================================= */

    if (navigator.onLine) {

      const connected =
        await testGAS();


      if (connected) {

        /* =============================================
           KIRIM QUEUE LOKAL DAHULU
           ============================================= */

        await syncQueue();


        /* =============================================
           CEK QUEUE
           ============================================= */

        const queueCount =
          await getQueueCount();


        /* =============================================
           DOWNLOAD SERVER
           HANYA SETELAH QUEUE SELESAI
           ============================================= */

        if (
          queueCount === 0
        ) {

          await downloadData();

        }


        /* =============================================
           REFRESH TAMPILAN
           ============================================= */

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
    testGAS,

  downloadData:
    downloadData,

  getQueueCount:
    getQueueCount,

  cetakNota:
    cetakNota

};


/* =========================================================
   GLOBAL CETAK NOTA
   ========================================================= */

window.cetakNota =
  cetakNota;


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
