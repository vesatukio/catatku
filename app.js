/* =========================================================
   CATATKU
   app.js - FRONTEND PWA + GOOGLE APPS SCRIPT
   OFFLINE FIRST + INDEXEDDB AUTO REPAIR
   VERSI STABIL
   ========================================================= */

"use strict";

/* =========================================================
   KONFIGURASI
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxrgQIppwaphvBIQjMbV6e5EO18C6O066k0jbBvRWPCKKV1rp9A7TQhZfM9_I01lL6a/exec";

const API_KEY =
  "CATATKU-2026-PRIBADI";

const DB_NAME =
  "CatatKuDB";

/*
 * JANGAN diturunkan.
 *
 * Database pengguna yang sudah v4 tidak boleh
 * dibuka dengan version 2 atau 3.
 */
const DB_VERSION = 4;

const QUEUE_STORE =
  "syncQueue";

const CACHE_STORE =
  "appCache";


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

let transactionType =
  "PEMASUKAN";

let db = null;

let currentBarangList = [];

let currentHistoryList = [];

let syncRunning = false;

let toastTimer = null;

let databaseOpening = null;


/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async function () {

    console.log(
      "CatatKu mulai..."
    );

    try {

      initDates();

      initEvents();

      updateOnlineStatus();

      await openDatabase();

      await ensureDatabaseStores();

      await loadLocalCache();

      await updateSyncBadge();

      renderAll();

      if (navigator.onLine) {

        setSyncText(
          "Online — mengambil data..."
        );

        await loadAppData();

        await syncOffline();

      } else {

        setSyncText(
          "Offline — menggunakan data tersimpan"
        );

      }

    } catch (error) {

      console.error(
        "Startup error:",
        error
      );

      /*
       * Jika IndexedDB gagal total,
       * aplikasi tetap boleh berjalan online.
       */

      setSyncText(
        navigator.onLine
          ? "Online"
          : "Mode offline"
      );

      try {

        renderAll();

      } catch (e) {

        console.warn(
          "Render offline gagal:",
          e
        );

      }

      showToast(
        "Aplikasi tetap dibuka. Database sedang diperbaiki."
      );

    } finally {

      hideLoading();

    }

  }
);


/* =========================================================
   ONLINE / OFFLINE EVENTS
   ========================================================= */

window.addEventListener(
  "online",
  async function () {

    console.log(
      "Koneksi online"
    );

    updateOnlineStatus();

    setSyncText(
      "Online — sinkronisasi..."
    );

    try {

      await openDatabase();

      await ensureDatabaseStores();

      await syncOffline();

      await loadAppData();

    } catch (error) {

      console.error(
        "Online sync error:",
        error
      );

      setSyncText(
        "Online — sinkronisasi tertunda"
      );

    }

  }
);


window.addEventListener(
  "offline",
  function () {

    console.log(
      "Koneksi offline"
    );

    updateOnlineStatus();

    setSyncText(
      "Offline — data disimpan di perangkat"
    );

  }
);


/* =========================================================
   INITIAL EVENTS
   ========================================================= */

function initEvents() {

  const transactionForm =
    document.getElementById(
      "transactionForm"
    );

  if (transactionForm) {

    transactionForm.addEventListener(
      "submit",
      submitTransaction
    );

  }


  const barangForm =
    document.getElementById(
      "barangForm"
    );

  if (barangForm) {

    barangForm.addEventListener(
      "submit",
      submitBarang
    );

  }


  const penjualanForm =
    document.getElementById(
      "penjualanForm"
    );

  if (penjualanForm) {

    penjualanForm.addEventListener(
      "submit",
      submitPenjualan
    );

  }


  const belanjaForm =
    document.getElementById(
      "belanjaForm"
    );

  if (belanjaForm) {

    belanjaForm.addEventListener(
      "submit",
      submitBelanja
    );

  }


  const hutangForm =
    document.getElementById(
      "hutangForm"
    );

  if (hutangForm) {

    hutangForm.addEventListener(
      "submit",
      submitHutang
    );

  }


  const jualQty =
    document.getElementById(
      "jualQty"
    );

  if (jualQty) {

    jualQty.addEventListener(
      "input",
      updateJualTotal
    );

  }


  const jualHarga =
    document.getElementById(
      "jualHarga"
    );

  if (jualHarga) {

    jualHarga.addEventListener(
      "input",
      updateJualTotal
    );

  }


  const belanjaQty =
    document.getElementById(
      "belanjaQty"
    );

  if (belanjaQty) {

    belanjaQty.addEventListener(
      "input",
      updateBelanjaTotal
    );

  }


  const belanjaHarga =
    document.getElementById(
      "belanjaHarga"
    );

  if (belanjaHarga) {

    belanjaHarga.addEventListener(
      "input",
      updateBelanjaTotal
    );

  }


  const jualBarang =
    document.getElementById(
      "jualBarang"
    );

  if (jualBarang) {

    jualBarang.addEventListener(
      "change",
      autoHargaJual
    );

  }


  const belanjaBarang =
    document.getElementById(
      "belanjaBarang"
    );

  if (belanjaBarang) {

    belanjaBarang.addEventListener(
      "change",
      autoHargaModal
    );

  }


  const searchBarang =
    document.getElementById(
      "searchBarang"
    );

  if (searchBarang) {

    searchBarang.addEventListener(
      "input",
      function (event) {

        filterBarang(
          event.target.value
        );

      }
    );

  }


  /*
   * Tutup menu saat klik di luar.
   */

  document.addEventListener(
    "click",
    function (event) {

      const moreMenu =
        document.getElementById(
          "moreMenu"
        );

      const quickMenu =
        document.getElementById(
          "quickAddMenu"
        );


      if (
        moreMenu &&
        !moreMenu.contains(event.target) &&
        !event.target.closest(
          "[onclick*='toggleMoreMenu']"
        )
      ) {

        moreMenu.style.display =
          "none";

      }


      if (
        quickMenu &&
        !quickMenu.contains(event.target) &&
        !event.target.closest(
          "[onclick*='QuickAdd']"
        )
      ) {

        quickMenu.style.display =
          "none";

      }

    }
  );


  /*
   * ESC = tutup semua.
   */

  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key ===
        "Escape"
      ) {

        closeModal(
          "barangModal"
        );

        closeModal(
          "hutangModal"
        );

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

  const today =
    getLocalDate();


  const trxTanggal =
    document.getElementById(
      "trxTanggal"
    );

  if (
    trxTanggal &&
    !trxTanggal.value
  ) {

    trxTanggal.value =
      today;

  }


  const reportStart =
    document.getElementById(
      "reportStart"
    );

  const reportEnd =
    document.getElementById(
      "reportEnd"
    );


  if (
    reportEnd &&
    !reportEnd.value
  ) {

    reportEnd.value =
      today;

  }


  if (
    reportStart &&
    !reportStart.value
  ) {

    const date =
      new Date();

    date.setDate(
      date.getDate() - 30
    );

    reportStart.value =
      formatDateInput(
        date
      );

  }

}


function getLocalDate() {

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


function formatDateInput(
  date
) {

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
   INDEXEDDB CORE
   ========================================================= */

/*
 * Membuka IndexedDB dengan aman.
 *
 * Penting:
 * - Tidak pernah meminta versi lebih rendah.
 * - Database v4 tetap v4.
 * - Store dibuat pada onupgradeneeded.
 */

function openDatabase() {

  if (db) {

    if (
      hasStore(
        QUEUE_STORE
      ) &&
      hasStore(
        CACHE_STORE
      )
    ) {

      return Promise.resolve(
        db
      );

    }

  }


  if (databaseOpening) {

    return databaseOpening;

  }


  databaseOpening =
    new Promise(
      function (
        resolve,
        reject
      ) {

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


        let request;


        try {

          request =
            indexedDB.open(
              DB_NAME,
              DB_VERSION
            );

        } catch (error) {

          databaseOpening =
            null;

          reject(error);

          return;

        }


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
                "Store dibuat:",
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
                "Store dibuat:",
                CACHE_STORE
              );

            }

          };


        request.onsuccess =
          function (event) {

            db =
              event.target.result;


            console.log(
              "IndexedDB aktif:",
              DB_NAME,
              "v" +
              db.version
            );


            db.onclose =
              function () {

                console.warn(
                  "IndexedDB ditutup"
                );

                db = null;

              };


            db.onversionchange =
              function () {

                console.warn(
                  "Versi IndexedDB berubah"
                );

                try {

                  db.close();

                } catch (e) {}

                db = null;

              };


            db.onerror =
              function (event) {

                console.warn(
                  "IndexedDB error:",
                  event
                );

              };


            databaseOpening =
              null;


            resolve(
              db
            );

          };


        request.onerror =
          function () {

            const error =
              request.error;


            console.error(
              "IndexedDB open error:",
              error
            );


            databaseOpening =
              null;


            /*
             * VersionError berarti ada kode lain
             * yang mencoba membuka versi lebih rendah.
             *
             * Kita tidak menurunkan versi.
             */

            reject(
              error ||
              new Error(
                "Gagal membuka IndexedDB"
              )
            );

          };


        request.onblocked =
          function () {

            console.warn(
              "IndexedDB diblokir oleh koneksi lama."
            );

          };

      }
    );


  return databaseOpening;

}


/* =========================================================
   HAS STORE
   ========================================================= */

function hasStore(
  storeName
) {

  return (
    db &&
    db.objectStoreNames &&
    db.objectStoreNames.contains(
      storeName
    )
  );

}


/* =========================================================
   ENSURE DATABASE STORES
   ========================================================= */

async function ensureDatabaseStores() {

  if (!db) {

    await openDatabase();

  }


  if (
    hasStore(
      QUEUE_STORE
    ) &&
    hasStore(
      CACHE_STORE
    )
  ) {

    return true;

  }


  console.warn(
    "Object store tidak lengkap. Repair database..."
  );


  try {

    db.close();

  } catch (e) {}


  db = null;


  await deleteDatabase();


  await openDatabase();


  return (
    hasStore(
      QUEUE_STORE
    ) &&
    hasStore(
      CACHE_STORE
    )
  );

}


/* =========================================================
   DELETE DATABASE
   ========================================================= */

function deleteDatabase() {

  return new Promise(
    function (
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
              "Delete database diblokir."
            );

            /*
             * Tidak langsung resolve terlalu cepat.
             */

            setTimeout(
              function () {

                resolve();

              },
              1000
            );

          };

      } catch (error) {

        reject(
          error
        );

      }

    }
  );

}


/* =========================================================
   SAVE CACHE
   ========================================================= */

async function saveCache(
  key,
  value
) {

  try {

    if (!db) {

      await openDatabase();

    }


    if (
      !hasStore(
        CACHE_STORE
      )
    ) {

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

          console.warn(
            "saveCache transaction error:",
            error
          );


          db = null;


          openDatabase()
            .then(
              function () {

                return saveCache(
                  key,
                  value
                );

              }
            )
            .then(resolve)
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

async function getCache(
  key
) {

  try {

    if (!db) {

      await openDatabase();

    }


    if (
      !hasStore(
        CACHE_STORE
      )
    ) {

      await ensureDatabaseStores();

    }


    return new Promise(
      function (
        resolve
      ) {

        let transaction;


        try {

          transaction =
            db.transaction(
              CACHE_STORE,
              "readonly"
            );

        } catch (error) {

          console.warn(
            "getCache transaction error:",
            error
          );

          resolve(
            null
          );

          return;

        }


        const store =
          transaction.objectStore(
            CACHE_STORE
          );


        const request =
          store.get(
            key
          );


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

            resolve(
              null
            );

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
      "loadLocalCache:",
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


    if (
      !hasStore(
        QUEUE_STORE
      )
    ) {

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
            "Queue transaction error:",
            error
          );


          db = null;


          openDatabase()
            .then(
              function () {

                return addToQueue(
                  action,
                  payload
                );

              }
            )
            .then(resolve)
            .catch(reject);


          return;

        }


        const store =
          transaction.objectStore(
            QUEUE_STORE
          );


        store.add({

          action:
            action,

          payload:
            payload,

          createdAt:
            Date.now()

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


    if (
      !hasStore(
        QUEUE_STORE
      )
    ) {

      await ensureDatabaseStores();

    }


    return new Promise(
      function (
        resolve
      ) {

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

async function removeFromQueue(
  id
) {

  try {

    if (!db) {

      await openDatabase();

    }


    if (
      !hasStore(
        QUEUE_STORE
      )
    ) {

      await ensureDatabaseStores();

    }


    return new Promise(
      function (
        resolve
      ) {

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


        store.delete(
          id
        );


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
      "removeFromQueue:",
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


    if (!badge) {

      return;

    }


    if (
      queue.length > 0
    ) {

      badge.textContent =
        queue.length;

      badge.style.display =
        "inline-block";

    } else {

      badge.textContent =
        "";

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

  /*
   * Coba online dahulu.
   */

  if (
    navigator.onLine
  ) {

    try {

      const result =
        await gasRequest(
          action,
          payload
        );


      showToast(
        "✅ Berhasil disimpan"
      );


      /*
       * Ambil data terbaru.
       */

      await loadAppData();


      return result;

    } catch (error) {

      console.warn(
        "Gagal online. Masuk antrean:",
        error
      );


      await addToQueue(
        action,
        payload
      );


      showToast(
        "⚠️ Disimpan offline — akan disinkronkan"
      );


      return {

        success:
          true,

        offline:
          true

      };

    }

  }


  /*
   * OFFLINE
   */

  await addToQueue(
    action,
    payload
  );


  showToast(
    "📁 Disimpan di perangkat — Offline"
  );


  return {

    success:
      true,

    offline:
      true

  };

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


  syncRunning =
    true;


  try {

    const queue =
      await getQueue();


    if (
      !queue.length
    ) {

      setSyncText(
        "Online — Data Terkini"
      );

      await updateSyncBadge();

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

      if (
        !item ||
        !item.action
      ) {

        console.warn(
          "Queue tanpa action:",
          item
        );


        if (
          item &&
          item.id
        ) {

          await removeFromQueue(
            item.id
          );

        }

        continue;

      }


      try {

        const result =
          await gasRequest(
            item.action,
            item.payload
          );


        /*
         * Hapus dari antrean hanya jika
         * GAS berhasil.
         */

        if (
          result &&
          result.success === false
        ) {

          throw new Error(
            result.error ||
            "GAS gagal"
          );

        }


        await removeFromQueue(
          item.id
        );


      } catch (error) {

        console.error(
          "Gagal sinkron ID:",
          item.id,
          error
        );


        /*
         * Jangan hapus.
         * Biarkan antrean untuk retry berikutnya.
         */

        break;

      }

    }


    const remaining =
      await getQueue();


    if (
      remaining.length > 0
    ) {

      setSyncText(
        "⚠️ " +
        remaining.length +
        " data tertunda"
      );

    } else {

      /*
       * Setelah queue kosong,
       * ambil data terbaru dari GAS.
       */

      await loadAppData();


      setSyncText(
        "Online — Data Terkini"
      );


      showToast(
        "🔄 Sinkronisasi selesai"
      );

    }


    await updateSyncBadge();

  } catch (error) {

    console.error(
      "Sync error:",
      error
    );


    setSyncText(
      "Gagal sinkronisasi"
    );

  } finally {

    syncRunning =
      false;

  }

}


/* =========================================================
   GAS REQUEST
   ========================================================= */

async function gasRequest(
  action,
  params = {},
  method = "GET"
) {

  /*
   * method dipertahankan untuk kompatibilitas.
   * Backend saat ini memakai GET.
   */

  const data = {

    action:
      action,

    key:
      API_KEY,

    ...params

  };


  let url =
    GAS_URL;


  const query =
    new URLSearchParams();


  Object.keys(
    data
  ).forEach(
    function (key) {

      if (
        data[key] !==
          undefined &&
        data[key] !==
          null
      ) {

        /*
         * Object / Array dibuat JSON.
         */

        let value =
          data[key];


        if (
          typeof value ===
            "object"
        ) {

          value =
            JSON.stringify(
              value
            );

        }


        query.append(
          key,
          String(value)
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
        method:
          "GET",

        redirect:
          "follow",

        cache:
          "no-store"
      }
    );


  if (
    !response.ok
  ) {

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
      JSON.parse(
        text
      );

  } catch (error) {

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
    result.success ===
      false
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

  if (
    !navigator.onLine
  ) {

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
      result &&
      result.data
        ? result.data
        : result;


    appData =
      normalizeAppData(
        data
      );


    /*
     * Simpan cache.
     */

    await saveCache(
      "appData",
      appData
    );


    /*
     * Render.
     */

    renderAll();


    setSyncText(
      "Data tersinkron"
    );


    await updateSyncBadge();

  } catch (error) {

    console.error(
      "loadAppData:",
      error
    );


    setSyncText(
      "Gagal terhubung — data lokal digunakan"
    );


    /*
     * Jangan lempar error lagi agar
     * aplikasi tetap hidup.
     */

  }

}


/* =========================================================
   NORMALIZE APP DATA
   ========================================================= */

function normalizeAppData(
  data
) {

  data =
    data || {};


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
   RENDER ALL
   ========================================================= */

function renderAll() {

  try {
    renderDashboard();
  } catch (e) {
    console.warn("renderDashboard:", e);
  }

  try {
    renderKategori();
  } catch (e) {
    console.warn("renderKategori:", e);
  }

  try {
    renderBarang();
  } catch (e) {
    console.warn("renderBarang:", e);
  }

  try {
    renderBarangSelects();
  } catch (e) {
    console.warn("renderBarangSelects:", e);
  }

  try {
    renderHistory();
  } catch (e) {
    console.warn("renderHistory:", e);
  }

  try {
    renderHutang();
  } catch (e) {
    console.warn("renderHutang:", e);
  }

  try {
    renderLaporan();
  } catch (e) {
    console.warn("renderLaporan:", e);
  }

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


  setText(
    "nilaiStok",
    rupiah(
      numberValue(
        d.nilaiStok
      )
    )
  );


  setText(
    "jumlahBarang",
    formatNumber(
      numberValue(
        d.jumlahBarang
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


  if (!container) {

    return;

  }


  const list =
    Array.isArray(
      appData.history
    )
      ? appData.history
      : [];


  if (
    !list.length
  ) {

    container.innerHTML =
      `<div class="empty">
        Belum ada transaksi
      </div>`;

    return;

  }


  container.innerHTML =
    list
      .slice(
        0,
        5
      )
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


  if (!select) {

    return;

  }


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
        typeof item ===
          "string"
          ? item
          : (
              item.nama ||
              item.kategori ||
              item.name ||
              ""
            );


      let jenis =
        typeof item ===
          "object"
          ? String(
              item.jenis ||
              item.type ||
              ""
            ).toUpperCase()
          : "";


      if (!nama) {

        return;

      }


      if (
        jenis &&
        jenis !==
          transactionType &&
        jenis !==
          "SEMUA"
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


  showPage(
    "add"
  );


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
   QUICK ADD
   FIX ERROR openQuickAdd
   ========================================================= */

/*
 * HTML lama Anda memanggil:
 *
 * onclick="openQuickAdd()"
 *
 * Sebelumnya fungsi ini tidak ada.
 */

function openQuickAdd() {

  toggleQuickAdd();

}


/*
 * Alias tambahan.
 */

function showQuickAdd() {

  openQuickAdd();

}


/* =========================================================
   BARANG
   ========================================================= */

function renderBarang() {

  const container =
    document.getElementById(
      "barangList"
    );


  if (!container) {

    return;

  }


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
      .map(
        barangHTML
      )
      .join("");

}


/* =========================================================
   BARANG HTML
   ========================================================= */

function barangHTML(
  item
) {

  item =
    item || {};


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
      style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
      "
    >

      <div
        style="min-width:0;"
      >

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

      <div
        style="text-align:right;"
      >

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


  if (!container) {

    return;

  }


  if (
    !filtered.length
  ) {

    container.innerHTML =
      `<div class="empty">
        Barang tidak ditemukan.
      </div>`;

    return;

  }


  container.innerHTML =
    filtered
      .map(
        barangHTML
      )
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
    function (
      selectEl
    ) {

      if (!selectEl) {

        return;

      }


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

          item =
            item || {};


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


  populateSelect(
    jual
  );

  populateSelect(
    belanja
  );

}


/* =========================================================
   FIND BARANG
   ========================================================= */

function findBarang(
  id
) {

  const list =
    Array.isArray(
      appData.barang
    )
      ? appData.barang
      : [];


  return list.find(
    function (
      item,
      index
    ) {

      item =
        item || {};


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
    findBarang(
      id
    );


  if (!barang) {

    return;

  }


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
    findBarang(
      id
    );


  if (!barang) {

    return;

  }


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


  if (!container) {

    return;

  }


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
      .map(
        transactionHTML
      )
      .join("");

}


/* =========================================================
   TRANSACTION HTML
   ========================================================= */

function transactionHTML(
  item
) {

  item =
    item || {};


  const jenis =
    String(
      item.jenis ||
      item.type ||
      "PEMASUKAN"
    ).toUpperCase();


  const isIncome =
    jenis ===
      "PEMASUKAN" ||
    jenis ===
      "PENJUALAN";


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

      <div
        style="text-align:right;"
      >

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


  if (!container) {

    return;

  }


  const list =
    Array.isArray(
      appData.hutang
    )
      ? appData.hutang
      : [];


  if (
    !list.length
  ) {

    container.innerHTML =
      `<div class="empty">
        Tidak ada catatan hutang/piutang.
      </div>`;

    return;

  }


  container.innerHTML =
    list
      .map(
        function (item) {

          item =
            item || {};


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
                    item.nama ||
                    item.kontak ||
                    "Tanpa Nama"
                  )}
                </strong>

                <div
                  class="small"
                  style="margin-top:4px;"
                >
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
                      item.nominal ||
                      item.jumlah ||
                      item.total
                    )
                  )}
                </strong>

              </div>

            </div>
          `;

        }
      )
      .join("");

}


/* =========================================================
   LAPORAN
   ========================================================= */

function renderLaporan() {

  const laporan =
    appData.laporan || {};


  setText(
    "laporanPemasukan",
    rupiah(
      numberValue(
        laporan.pemasukan ||
        laporan.totalPemasukan
      )
    )
  );


  setText(
    "laporanPengeluaran",
    rupiah(
      numberValue(
        laporan.pengeluaran ||
        laporan.totalPengeluaran
      )
    )
  );


  setText(
    "laporanSaldo",
    rupiah(
      numberValue(
        laporan.saldo
      )
    )
  );

}


/* =========================================================
   LOAD LAPORAN
   ========================================================= */

async function loadLaporan() {

  if (
    !navigator.onLine
  ) {

    showToast(
      "Laporan online membutuhkan koneksi."
    );

    return;

  }


  const start =
    valueOf(
      "reportStart"
    );


  const end =
    valueOf(
      "reportEnd"
    );


  try {

    setSyncText(
      "Mengambil laporan..."
    );


    const result =
      await gasRequest(
        "laporan",
        {
          start:
            start,

          end:
            end
        }
      );


    appData.laporan =
      result.data ||
      result.laporan ||
      result ||
      {};


    renderLaporan();


    setSyncText(
      "Laporan siap"
    );


  } catch (error) {

    console.error(
      "loadLaporan:",
      error
    );


    showToast(
      "❌ Gagal mengambil laporan"
    );

  }

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


  const button =
    event.submitter ||
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    button,
    "Menyimpan..."
  );


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

  } catch (error) {

    console.error(
      "submitTransaction:",
      error
    );


    showToast(
      "❌ " +
      (
        error.message ||
        "Gagal menyimpan"
      )
    );

  } finally {

    restoreButton(
      button
    );

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

    nama:
      nama,

    hargaModal:
      modal,

    hargaJual:
      jual,

    stok:
      stok

  };


  const button =
    event.submitter ||
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    button,
    "Menyimpan..."
  );


  try {

    await saveOrQueue(
      "tambahBarang",
      payload
    );


    event.target.reset();


    closeModal(
      "barangModal"
    );

  } catch (error) {

    console.error(
      "submitBarang:",
      error
    );


    showToast(
      "❌ " +
      (
        error.message ||
        "Gagal menambah barang"
      )
    );

  } finally {

    restoreButton(
      button
    );

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


  setButtonLoading(
    button,
    "Menyimpan..."
  );


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

    restoreButton(
      button
    );

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


  setButtonLoading(
    button,
    "Menyimpan..."
  );


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

    restoreButton(
      button
    );

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

    nama:
      nama,

    nominal:
      nominal,

    keterangan:
      keterangan,

    tanggal:
      getLocalDate()

  };


  const button =
    event.submitter ||
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    button,
    "Menyimpan..."
  );


  try {

    await saveOrQueue(
      "tambahHutang",
      payload
    );


    event.target.reset();


    closeModal(
      "hutangModal"
    );

  } catch (error) {

    console.error(
      "submitHutang:",
      error
    );


    showToast(
      "❌ " +
      (
        error.message ||
        "Gagal menyimpan hutang"
      )
    );

  } finally {

    restoreButton(
      button
    );

  }

}


/* =========================================================
   BUTTON HELPERS
   ========================================================= */

function setButtonLoading(
  button,
  text
) {

  if (!button) {

    return;

  }


  if (
    button.dataset.oldText ===
    undefined
  ) {

    button.dataset.oldText =
      button.textContent;

  }


  button.disabled =
    true;


  button.textContent =
    text;

}


function restoreButton(
  button
) {

  if (!button) {

    return;

  }


  button.disabled =
    false;


  if (
    button.dataset.oldText
  ) {

    button.textContent =
      button.dataset.oldText;

  }

}


/* =========================================================
   SHOW PAGE
   ========================================================= */

function showPage(
  pageId
) {

  const pages =
    document.querySelectorAll(
      ".page"
    );


  pages.forEach(
    function (page) {

      page.classList.remove(
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

  } else {

    console.warn(
      "Halaman tidak ditemukan:",
      pageId + "Page"
    );

  }


  const navs =
    document.querySelectorAll(
      ".nav-item"
    );


  navs.forEach(
    function (nav) {

      nav.classList.remove(
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


  closeMoreMenu();

  closeQuickAdd();


  window.scrollTo(
    {
      top: 0,
      behavior: "smooth"
    }
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


  if (!modal) {

    console.warn(
      "Modal tidak ditemukan:",
      id
    );

    return;

  }


  modal.style.display =
    "flex";


  /*
   * class tambahan untuk CSS
   */

  modal.classList.add(
    "show",
    "active"
  );

}


function closeModal(
  id
) {

  const modal =
    document.getElementById(
      id
    );


  if (!modal) {

    return;

  }


  modal.style.display =
    "none";


  modal.classList.remove(
    "show",
    "active"
  );

}


/* =========================================================
   MORE MENU
   ========================================================= */

function toggleMoreMenu() {

  const menu =
    document.getElementById(
      "moreMenu"
    );


  if (!menu) {

    console.warn(
      "moreMenu tidak ditemukan"
    );

    return;

  }


  const visible =
    menu.style.display ===
    "block";


  closeQuickAdd();


  menu.style.display =
    visible
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
   QUICK ADD MENU
   ========================================================= */

function toggleQuickAdd() {

  const menu =
    document.getElementById(
      "quickAddMenu"
    );


  if (!menu) {

    console.warn(
      "quickAddMenu tidak ditemukan"
    );

    return;

  }


  const visible =
    menu.style.display ===
    "block";


  closeMoreMenu();


  menu.style.display =
    visible
      ? "none"
      : "block";

}


/*
 * FIX UTAMA:
 *
 * HTML memanggil openQuickAdd()
 *
 * Sekarang fungsi tersebut tersedia.
 */

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


  if (!statusEl) {

    return;

  }


  if (
    navigator.onLine
  ) {

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


  if (!loader) {

    return;

  }


  loader.style.display =
    "none";


  loader.classList.add(
    "hidden"
  );

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


  if (!el) {

    return "";

  }


  return String(
    el.value ||
    ""
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


  if (
    val ===
      null ||
    val ===
      undefined ||
    val ===
      ""
  ) {

    return 0;

  }


  /*
   * Format Indonesia:
   * 1.500.000
   * 1,5
   */

  let text =
    String(
      val
    ).trim();


  /*
   * Hilangkan Rp.
   */

  text =
    text.replace(
      /Rp/gi,
      ""
    );


  /*
   * Jika ada koma desimal dan titik ribuan.
   */

  if (
    text.includes(",") &&
    text.includes(".")
  ) {

    text =
      text.replace(
        /\./g,
        ""
      );

    text =
      text.replace(
        ",",
        "."
      );

  } else if (
    text.includes(".") &&
    !text.includes(",")
  ) {

    /*
     * Untuk nilai rupiah umum,
     * titik dianggap separator ribuan.
     */

    const parts =
      text.split(".");


    if (
      parts.length > 1 &&
      parts.every(
        function (part) {
          return /^\d+$/.test(part);
        }
      )
    ) {

      text =
        parts.join("");

    }

  } else if (
    text.includes(",")
  ) {

    /*
     * 1,5 → 1.5
     */

    text =
      text.replace(
        ",",
        "."
      );

  }


  /*
   * Sisakan angka, titik, minus.
   */

  text =
    text.replace(
      /[^0-9.-]/g,
      ""
    );


  const num =
    parseFloat(
      text
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
    numberValue(
      num
    ).toLocaleString(
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

  return numberValue(
    num
  ).toLocaleString(
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
    str ===
      undefined ||
    str ===
      null
      ? ""
      : str
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
    str ===
      undefined ||
    str ===
      null
      ? ""
      : str
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    );

}


/* =========================================================
   DATABASE REPAIR
   ========================================================= */

async function repairDatabase() {

  try {

    console.log(
      "Memulai repair IndexedDB..."
    );


    if (db) {

      try {

        db.close();

      } catch (e) {}

    }


    db =
      null;


    databaseOpening =
      null;


    await deleteDatabase();


    await openDatabase();


    await ensureDatabaseStores();


    await updateSyncBadge();


    showToast(
      "✅ Database CatatKu berhasil diperbaiki"
    );


    return true;

  } catch (error) {

    console.error(
      "Repair DB gagal:",
      error
    );


    showToast(
      "❌ Database gagal diperbaiki"
    );


    return false;

  }

}


/* =========================================================
   FORCE REFRESH DATA
   ========================================================= */

async function refreshData() {

  if (
    !navigator.onLine
  ) {

    showToast(
      "📴 Tidak bisa refresh saat offline"
    );

    return;

  }


  try {

    setSyncText(
      "Memperbarui data..."
    );


    await syncOffline();

    await loadAppData();


    showToast(
      "✅ Data diperbarui"
    );

  } catch (error) {

    console.error(
      "refreshData:",
      error
    );


    showToast(
      "❌ Gagal memperbarui data"
    );

  }

}


/* =========================================================
   MANUAL SYNC
   ========================================================= */

async function manualSync() {

  try {

    if (
      !navigator.onLine
    ) {

      showToast(
        "📴 Saat ini offline"
      );

      return;

    }


    await syncOffline();

    await loadAppData();

  } catch (error) {

    console.error(
      "manualSync:",
      error
    );

  }

}


/* =========================================================
   GLOBAL API
   ========================================================= */

/*
 * PENTING:
 *
 * Fungsi HTML inline:
 *
 * onclick="openQuickAdd()"
 * onclick="showPage('dashboard')"
 * onclick="toggleMoreMenu()"
 *
 * harus benar-benar tersedia di window.
 *
 * Ini juga membuat kode aman apabila index.html
 * menggunakan <script type="module">.
 */

window.openQuickAdd =
  openQuickAdd;

window.showQuickAdd =
  showQuickAdd;

window.toggleQuickAdd =
  toggleQuickAdd;

window.closeQuickAdd =
  closeQuickAdd;

window.quickTransaction =
  quickTransaction;

window.toggleMoreMenu =
  toggleMoreMenu;

window.closeMoreMenu =
  closeMoreMenu;

window.showPage =
  showPage;

window.openModal =
  openModal;

window.closeModal =
  closeModal;

window.setTransactionType =
  setTransactionType;

window.updateJualTotal =
  updateJualTotal;

window.updateBelanjaTotal =
  updateBelanjaTotal;

window.autoHargaJual =
  autoHargaJual;

window.autoHargaModal =
  autoHargaModal;

window.filterBarang =
  filterBarang;

window.submitTransaction =
  submitTransaction;

window.submitBarang =
  submitBarang;

window.submitPenjualan =
  submitPenjualan;

window.submitBelanja =
  submitBelanja;

window.submitHutang =
  submitHutang;

window.syncOffline =
  syncOffline;

window.manualSync =
  manualSync;

window.refreshData =
  refreshData;

window.loadAppData =
  loadAppData;

window.loadLaporan =
  loadLaporan;

window.updateSyncBadge =
  updateSyncBadge;

window.repairDatabase =
  repairDatabase;


/* =========================================================
   DEBUG OBJECT
   ========================================================= */

window.CatatKu = {

  getDB:
    function () {

      return db;

    },


  getDBVersion:
    function () {

      return db
        ? db.version
        : null;

    },


  getAppData:
    function () {

      return appData;

    },


  getQueue:
    async function () {

      return await getQueue();

    },


  sync:
    async function () {

      return await syncOffline();

    },


  reload:
    async function () {

      return await loadAppData();

    },


  refresh:
    async function () {

      return await refreshData();

    },


  repairDB:
    async function () {

      return await repairDatabase();

    },


  clearLocalDatabase:
    async function () {

      return await repairDatabase();

    }

};


/* =========================================================
   STARTUP LOG
   ========================================================= */

console.log(
  "CatatKu app.js aktif"
);

console.log(
  "IndexedDB target version:",
  DB_VERSION
);

console.log(
  "openQuickAdd:",
  typeof window.openQuickAdd
);

console.log(
  "showPage:",
  typeof window.showPage
);

console.log(
  "syncOffline:",
  typeof window.syncOffline
);
