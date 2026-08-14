/* =========================================================
   CATATKU
   app.js

   DATABASE UTAMA :
   Google Sheets melalui Google Apps Script

   DATABASE LOKAL :
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
   - Sync Queue
   - Auto Repair IndexedDB
   ========================================================= */

"use strict";


/* =========================================================
   KONFIGURASI
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbwBeouN8uOCNNrWiV5exaTyf_QcycY-eLMtgqg8VdDfmYofavL7OPFTyOifoQELADSr/exec";


const DB_NAME =
  "CATATKU_DB";


/*
 * Naikkan versi agar IndexedDB lama
 * bisa diperbaiki otomatis.
 */
const DB_VERSION =
  3;


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


let dbPromise =
  null;


let db =
  null;


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


/* ---------------------------------------------------------
   RUPIAH
   --------------------------------------------------------- */

function rupiah(value) {

  const n =
    Number(value || 0);


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
  ).format(n);

}


/* ---------------------------------------------------------
   NUMBER
   --------------------------------------------------------- */

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


/* ---------------------------------------------------------
   TANGGAL
   --------------------------------------------------------- */

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


/* ---------------------------------------------------------
   WAKTU
   --------------------------------------------------------- */

function nowISO() {

  return new Date()
    .toISOString();

}


/* ---------------------------------------------------------
   ESCAPE HTML
   --------------------------------------------------------- */

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

/*
 * Membuat object store jika belum ada.
 */
function createStoreIfMissing(
  database,
  storeName,
  options,
  indexes = []
) {

  if (
    database.objectStoreNames.contains(
      storeName
    )
  ) {

    return;

  }


  const store =
    database.createObjectStore(
      storeName,
      options
    );


  indexes.forEach(
    function(index) {

      try {

        store.createIndex(
          index.name,
          index.keyPath,
          {
            unique:
              !!index.unique
          }
        );

      }

      catch (error) {

        console.warn(
          "Gagal membuat index:",
          index.name,
          error
        );

      }

    }
  );

}


/* ---------------------------------------------------------
   OPEN DATABASE
   --------------------------------------------------------- */

function openDB() {

  if (dbPromise) {

    return dbPromise;

  }


  dbPromise =
    new Promise(
      function(resolve, reject) {

        if (
          !window.indexedDB
        ) {

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

          dbPromise =
            null;

          reject(error);

          return;

        }


        /* -------------------------------------------------
           UPGRADE DATABASE
           ------------------------------------------------- */

        request.onupgradeneeded =
          function(event) {

            const database =
              event.target.result;


            /*
             * TRANSAKSI
             */

            createStoreIfMissing(
              database,
              STORES.transaksi,
              {
                keyPath:
                  "id"
              },
              [
                {
                  name:
                    "tanggal",

                  keyPath:
                    "tanggal",

                  unique:
                    false
                }
              ]
            );


            /*
             * BARANG
             */

            createStoreIfMissing(
              database,
              STORES.barang,
              {
                keyPath:
                  "id"
              },
              [
                {
                  name:
                    "nama",

                  keyPath:
                    "nama",

                  unique:
                    false
                }
              ]
            );


            /*
             * PENJUALAN
             */

            createStoreIfMissing(
              database,
              STORES.penjualan,
              {
                keyPath:
                  "id"
              },
              [
                {
                  name:
                    "tanggal",

                  keyPath:
                    "tanggal",

                  unique:
                    false
                }
              ]
            );


            /*
             * SYNC QUEUE
             */

            createStoreIfMissing(
              database,
              STORES.queue,
              {
                keyPath:
                  "id"
              },
              [
                {
                  name:
                    "createdAt",

                  keyPath:
                    "createdAt",

                  unique:
                    false
                }
              ]
            );

          };


        /* -------------------------------------------------
           SUCCESS
           ------------------------------------------------- */

        request.onsuccess =
          function(event) {

            db =
              event.target.result;


            db.onversionchange =
              function() {

                try {

                  db.close();

                }

                catch (error) {

                  console.warn(
                    error
                  );

                }


                db =
                  null;

                dbPromise =
                  null;

              };


            db.onerror =
              function(event) {

                console.warn(
                  "IndexedDB error:",
                  event.target.error
                );

              };


            resolve(db);

          };


        /* -------------------------------------------------
           ERROR
           ------------------------------------------------- */

        request.onerror =
          function() {

            dbPromise =
              null;


            reject(
              request.error ||
              new Error(
                "Gagal membuka IndexedDB"
              )
            );

          };


        /* -------------------------------------------------
           BLOCKED
           ------------------------------------------------- */

        request.onblocked =
          function() {

            console.warn(
              "IndexedDB sedang diblokir. Tutup tab aplikasi lain."
            );

          };

      }
    );


  return dbPromise;

}


/* =========================================================
   DATABASE HELPER
   ========================================================= */


/* ---------------------------------------------------------
   PASTIKAN STORE ADA
   --------------------------------------------------------- */

async function ensureStore(
  storeName
) {

  const database =
    await openDB();


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


  return database;

}


/* ---------------------------------------------------------
   PUT
   --------------------------------------------------------- */

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
    await ensureStore(
      storeName
    );


  const item = {
    ...data
  };


  /*
   * Set ID otomatis jika belum ada.
   */

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
        store.put(item);


      request.onsuccess =
        function() {

          resolve(item);

        };


      request.onerror =
        function() {

          reject(
            request.error ||
            new Error(
              "Gagal menyimpan ke IndexedDB"
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


/* ---------------------------------------------------------
   GET SATU DATA
   --------------------------------------------------------- */

async function dbGet(
  storeName,
  id
) {

  const database =
    await ensureStore(
      storeName
    );


  return new Promise(
    function(resolve, reject) {

      try {

        const transaction =
          database.transaction(
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
          function() {

            resolve(
              request.result || null
            );

          };


        request.onerror =
          function() {

            reject(
              request.error ||
              new Error(
                "Gagal mengambil data"
              )
            );

          };

      }

      catch (error) {

        reject(error);

      }

    }
  );

}


/* ---------------------------------------------------------
   GET SEMUA DATA
   --------------------------------------------------------- */

async function dbGetAll(
  storeName
) {

  const database =
    await ensureStore(
      storeName
    );


  return new Promise(
    function(resolve, reject) {

      try {

        const transaction =
          database.transaction(
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
          function() {

            resolve(
              request.result || []
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

      catch (error) {

        reject(error);

      }

    }
  );

}


/* ---------------------------------------------------------
   DELETE
   --------------------------------------------------------- */

async function dbDelete(
  storeName,
  id
) {

  const database =
    await ensureStore(
      storeName
    );


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
          store.delete(id);


        request.onsuccess =
          function() {

            resolve(true);

          };


        request.onerror =
          function() {

            reject(
              request.error ||
              new Error(
                "Gagal menghapus IndexedDB"
              )
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


/* ---------------------------------------------------------
   QUEUE COUNT
   --------------------------------------------------------- */

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

  if (
    !GAS_URL
  ) {

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
          JSON.stringify({
            action:
              action,

            data:
              data
          })
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


  let result;


  try {

    result =
      await response.json();

  }

  catch (error) {

    throw new Error(
      "Response GAS bukan JSON"
    );

  }


  if (
    !result ||
    !result.success
  ) {

    throw new Error(
      result?.error ||
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

  if (
    !GAS_URL
  ) {

    throw new Error(
      "GAS_URL belum diisi"
    );

  }


  const separator =
    GAS_URL.includes("?")
      ? "&"
      : "?";


  const url =
    GAS_URL +
    separator +
    "action=" +
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


  if (
    !response.ok
  ) {

    throw new Error(
      "HTTP " +
      response.status
    );

  }


  let result;


  try {

    result =
      await response.json();

  }

  catch (error) {

    throw new Error(
      "Response GAS bukan JSON"
    );

  }


  if (
    !result ||
    !result.success
  ) {

    throw new Error(
      result?.error ||
      "GAS gagal"
    );

  }


  return result;

}


/* =========================================================
   TEST KONEKSI GAS
   ========================================================= */

async function testGAS() {

  if (
    !navigator.onLine
  ) {

    setDatabaseStatus(
      "offline",
      "Offline — data disimpan di perangkat"
    );

    return false;

  }


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

          if (
            ok
          ) {

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

        if (!el) {

          return;

        }


        if (
          APP_STATE.syncing
        ) {

          el.textContent =
            "⟳ Sinkronisasi...";

          el.dataset.status =
            "syncing";

          return;

        }


        if (
          count === 0
        ) {

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

  data =
    data || {};


  const transaksi = {

    id:
      data.id ||
      uid("TRX"),

    tanggal:
      data.tanggal ||
      today(),

    jenis:
      data.jenis ||
      "",

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
    transaksi.jenis !==
      "masuk" &&
    transaksi.jenis !==
      "keluar"
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


  /*
   * 1. Simpan lokal
   */

  await dbPut(
    STORES.transaksi,
    transaksi
  );


  /*
   * 2. Masukkan queue
   */

  await queueAdd(
    "transaksi",
    transaksi
  );


  /*
   * 3. Jika online coba sync
   */

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

  data =
    data || {};


  const barang = {

    id:
      data.id ||
      uid("BRG"),

    kode:
      data.kode ||
      "",

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


  if (
    !barang.nama
  ) {

    throw new Error(
      "Nama barang wajib diisi"
    );

  }


  /*
   * Simpan lokal
   */

  await dbPut(
    STORES.barang,
    barang
  );


  /*
   * Queue
   */

  await queueAdd(
    "barang",
    barang
  );


  /*
   * Sync jika online
   */

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

  data =
    data || {};


  if (
    !data.barangId
  ) {

    throw new Error(
      "Barang belum dipilih"
    );

  }


  const barang =
    await dbGet(
      STORES.barang,
      data.barangId
    );


  if (
    !barang
  ) {

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


  const stokSaatIni =
    number(
      barang.stok
    );


  if (
    qty > stokSaatIni
  ) {

    throw new Error(
      "Stok tidak cukup. Stok tersedia: " +
      stokSaatIni
    );

  }


  const hargaModal =
    number(
      data.hargaModal !==
      undefined
        ? data.hargaModal
        : barang.hargaModal
    );


  const hargaJual =
    number(
      data.hargaJual !==
      undefined
        ? data.hargaJual
        : barang.hargaJual
    );


  if (
    hargaJual <= 0
  ) {

    throw new Error(
      "Harga jual harus lebih dari 0"
    );

  }


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
      data.createdAt ||
      nowISO()

  };


  /*
   * Update barang lokal
   */

  const barangBaru = {

    ...barang,

    stok:
      stokSaatIni -
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


  /*
   * Simpan penjualan
   */

  await dbPut(
    STORES.penjualan,
    penjualan
  );


  /*
   * Update stok
   */

  await dbPut(
    STORES.barang,
    barangBaru
  );


  /*
   * Masuk queue
   */

  await queueAdd(
    "penjualan",
    penjualan
  );


  /*
   * Sync
   */

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


  await updateSyncStatus();


  try {

    const queue =
      await dbGetAll(
        STORES.queue
      );


    /*
     * Urutkan berdasarkan waktu dibuat.
     */

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


    if (
      queue.length === 0
    ) {

      return;

    }


    for (
      const item of queue
    ) {

      /*
       * Jika internet mati di tengah proses
       */

      if (
        !navigator.onLine
      ) {

        break;

      }


      try {

        let result;


        switch (
          item.type
        ) {

          case "transaksi":

            result =
              await postGAS(
                "tambahTransaksi",
                item.data
              );

            break;


          case "barang":

            result =
              await postGAS(
                "tambahBarang",
                item.data
              );

            break;


          case "penjualan":

            result =
              await postGAS(
                "tambahPenjualan",
                item.data
              );

            break;


          default:

            throw new Error(
              "Tipe queue tidak dikenal: " +
              item.type
            );

        }


        if (
          result &&
          result.success
        ) {

          await dbDelete(
            STORES.queue,
            item.id
          );


          console.log(
            "SYNC BERHASIL:",
            item.type,
            item.data.id
          );

        }

        else {

          throw new Error(
            result?.error ||
            "GAS tidak mengembalikan success"
          );

        }

      }

      catch (error) {

        console.warn(
          "SYNC GAGAL:",
          item,
          error
        );


        item.attempts =
          number(
            item.attempts
          ) + 1;


        item.lastError =
          error?.message ||
          String(error);


        item.lastAttempt =
          nowISO();


        await dbPut(
          STORES.queue,
          item
        );


        /*
         * Berhenti sementara.
         * Queue berikutnya akan diproses
         * pada sync berikutnya.
         */

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
    !result ||
    !result.data
  ) {

    throw new Error(
      "Data aplikasi kosong"
    );

  }


  const data =
    result.data;


  /*
   * TRANSAKSI
   */

  if (
    Array.isArray(
      data.transaksi
    )
  ) {

    for (
      const item of data.transaksi
    ) {

      if (
        item &&
        item.id
      ) {

        await dbPut(
          STORES.transaksi,
          item
        );

      }

    }

  }


  /*
   * BARANG
   */

  if (
    Array.isArray(
      data.barang
    )
  ) {

    for (
      const item of data.barang
    ) {

      if (
        item &&
        item.id
      ) {

        await dbPut(
          STORES.barang,
          item
        );

      }

    }

  }


  /*
   * PENJUALAN
   */

  if (
    Array.isArray(
      data.penjualan
    )
  ) {

    for (
      const item of data.penjualan
    ) {

      if (
        item &&
        item.id
      ) {

        await dbPut(
          STORES.penjualan,
          item
        );

      }

    }

  }


  console.log(
    "Data Google Sheets berhasil diambil"
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


  /*
   * TRANSAKSI
   */

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


      else if (
        item.jenis ===
        "keluar"
      ) {

        uangKeluar +=
          jumlah;

      }

    }
  );


  /*
   * PENJUALAN
   */

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


  /*
   * BARANG
   */

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


    throw error;

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


  if (
    el
  ) {

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


  return data.sort(
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


  return data.sort(
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


  if (
    !container
  ) {

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
    barang
      .map(
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
            stok <=
            stokMin;


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
                    ? `
                      <small>
                        Stok menipis
                      </small>
                    `
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
      )
      .join("");

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


  if (
    !container
  ) {

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
    data
      .map(
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
      )
      .join("");

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


  if (
    !container
  ) {

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
    data
      .map(
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
      )
      .join("");

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


  if (
    !toast
  ) {

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


  if (
    !form ||
    form.dataset.initialized
  ) {

    return;

  }


  form.dataset.initialized =
    "true";


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


  if (
    !form ||
    form.dataset.initialized
  ) {

    return;

  }


  form.dataset.initialized =
    "true";


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


  if (
    !form ||
    form.dataset.initialized
  ) {

    return;

  }


  form.dataset.initialized =
    "true";


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


  if (
    !select
  ) {

    return;

  }


  const barang =
    await loadBarang();


  select.innerHTML =
    "";


  const firstOption =
    document.createElement(
      "option"
    );


  firstOption.value =
    "";


  firstOption.textContent =
    "Pilih barang";


  select.appendChild(
    firstOption
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
   AUTO HARGA PENJUALAN
   ========================================================= */

function initBarangSelect() {

  const select =
    document.getElementById(
      "barangId"
    );


  const harga =
    document.querySelector(
      '#penjualanForm [name="hargaJual"], [name="hargaJual"]'
    );


  if (
    !select ||
    !harga
  ) {

    return;

  }


  if (
    select.dataset.initialized
  ) {

    return;

  }


  select.dataset.initialized =
    "true";


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
   MANUAL SYNC
   ========================================================= */

async function manualSync() {

  if (
    !navigator.onLine
  ) {

    showToast(
      "Tidak ada internet"
    );

    return false;

  }


  showToast(
    "Sinkronisasi..."
  );


  try {

    /*
     * Pastikan GAS hidup.
     */

    const connected =
      await testGAS();


    if (
      !connected
    ) {

      throw new Error(
        "Google Sheets tidak terhubung"
      );

    }


    /*
     * Kirim queue dahulu.
     */

    await syncQueue();


    /*
     * Ambil data server.
     */

    await downloadData();


    /*
     * Refresh UI.
     */

    await refreshUI();


    showToast(
      "Sinkronisasi selesai"
    );


    return true;

  }

  catch (error) {

    console.error(
      "Manual sync:",
      error
    );


    showToast(
      "Sync gagal: " +
      error.message
    );


    return false;

  }

}


/* =========================================================
   REFRESH UI
   ========================================================= */

async function refreshUI() {

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

}


/* =========================================================
   REFRESH APP
   ========================================================= */

async function refreshApp() {

  try {

    if (
      navigator.onLine
    ) {

      /*
       * Hanya sync queue.
       * downloadData dilakukan setelah
       * queue selesai diproses.
       */

      await syncQueue();


      /*
       * Coba ambil server.
       */

      try {

        await downloadData();

      }

      catch (error) {

        console.warn(
          "Download data gagal:",
          error
        );

      }

    }


    await refreshUI();

  }

  catch (error) {

    console.error(
      "Refresh:",
      error
    );

  }

}


/* =========================================================
   AUTO SYNC PERIODIK
   ========================================================= */

let autoSyncTimer =
  null;


function startAutoSync() {

  if (
    autoSyncTimer
  ) {

    clearInterval(
      autoSyncTimer
    );

  }


  /*
   * Setiap 30 detik.
   */

  autoSyncTimer =
    setInterval(
      async function() {

        if (
          navigator.onLine &&
          !APP_STATE.syncing
        ) {

          try {

            await syncQueue();

          }

          catch (error) {

            console.warn(
              "Auto sync timer:",
              error
            );

          }

        }

      },
      30000
    );

}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initApp() {

  if (
    APP_STATE.initialized
  ) {

    return;

  }


  console.log(
    "CatatKu mulai..."
  );


  try {

    /*
     * 1. IndexedDB
     */

    await openDB();


    console.log(
      "IndexedDB siap"
    );


    /*
     * 2. Status online
     */

    updateOnlineStatus();


    /*
     * 3. Form
     */

    initTransaksiForm();

    initBarangForm();

    initPenjualanForm();

    initBarangSelect();


    /*
     * 4. Dashboard lokal
     */

    await loadDashboard();


    /*
     * 5. Render lokal
     */

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
     * 6. Tandai initialized
     */

    APP_STATE.initialized =
      true;


    /*
     * 7. Auto sync
     */

    startAutoSync();


    /*
     * 8. Jika online
     */

    if (
      navigator.onLine
    ) {

      const connected =
        await testGAS();


      if (
        connected
      ) {

        /*
         * Queue harus dikirim
         * sebelum mengambil data server.
         */

        await syncQueue();


        try {

          await downloadData();

        }

        catch (error) {

          console.warn(
            "Download awal gagal:",
            error
          );

        }


        await refreshUI();

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


    /*
     * Jangan membuat aplikasi mati total.
     */

    showToast(
      "CatatKu siap dengan mode terbatas"
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

  download:
    downloadData,

  queueCount:
    getQueueCount

};


/* =========================================================
   START APPLICATION
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
