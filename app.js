/* =========================================================
   CATATKU
   app.js
   FRONTEND PWA
   GAS + INDEXEDDB OFFLINE FIRST
   ========================================================= */

"use strict";


/* =========================================================
   KONFIGURASI GAS
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzEyUC9gtpQ3vZG0mvz0RTx0zFAPEWAk3DGE-E8qEwslG0y1ELCJxdj6yZx1dA1zDha/exec";


/* =========================================================
   INDEXED DB
   ========================================================= */

const DB_NAME = "CatatKuDB";
const DB_VERSION = 1;

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

  barangSearch: "",

  historySearch: ""

};


/* =========================================================
   INDEXED DB INSTANCE
   ========================================================= */

let dbInstance = null;
let dbPromise = null;


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function () {

    initApp();

  }
);


/* =========================================================
   INIT APP
   ========================================================= */

async function initApp() {

  setTodayDefaults();

  setupForms();

  setupCalculations();

  updateConnectionStatus();

  /*
   * DATABASE HARUS SELESAI DULU
   */

  try {

    await initDB();

    await loadLocalData();

  } catch (error) {

    console.error(
      "IndexedDB initialization error:",
      error
    );

    setSyncText(
      "Database lokal bermasalah"
    );

  }

  await updateSyncBadge();

  /*
   * COBA SERVER
   */

  if (navigator.onLine) {

    await refreshApp();

  } else {

    renderAll();

    hideLoading();

    setSyncText(
      "Offline — data lokal"
    );

  }


  /* =======================================================
     ONLINE EVENT
     ======================================================= */

  window.addEventListener(
    "online",
    async function () {

      state.online = true;

      updateConnectionStatus();

      setSyncText(
        "Koneksi kembali..."
      );

      try {

        await syncOffline();

        await refreshApp();

      } catch (error) {

        console.error(
          "Online sync error:",
          error
        );

      }

    }
  );


  /* =======================================================
     OFFLINE EVENT
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
     SYNC BERKALA
     ======================================================= */

  setInterval(
    async function () {

      if (
        navigator.onLine &&
        !state.syncing
      ) {

        try {

          const count =
            await queueCount();

          if (count > 0) {

            await syncOffline();

          }

        } catch (error) {

          console.error(
            "Auto sync:",
            error
          );

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

  const trxForm =
    document.getElementById(
      "transactionForm"
    );

  if (trxForm) {

    trxForm.addEventListener(
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


  const jualForm =
    document.getElementById(
      "penjualanForm"
    );

  if (jualForm) {

    jualForm.addEventListener(
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

        const barang =
          state.barang.find(
            function (b) {

              return String(b.id) ===
                String(jualBarang.value);

            }
          );

        if (barang) {

          const harga =
            document.getElementById(
              "jualHarga"
            );

          if (harga) {

            harga.value =
              Number(barang.jual || 0);

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
    function (id) {

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
    function (id) {

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
      document.getElementById(
        "jualQty"
      )?.value || 0
    );

  const harga =
    Number(
      document.getElementById(
        "jualHarga"
      )?.value || 0
    );

  const total =
    qty * harga;

  const el =
    document.getElementById(
      "jualTotalPreview"
    );

  if (el) {

    el.textContent =
      rupiah(total);

  }

}


function updateBelanjaTotal() {

  const qty =
    Number(
      document.getElementById(
        "belanjaQty"
      )?.value || 0
    );

  const harga =
    Number(
      document.getElementById(
        "belanjaHarga"
      )?.value || 0
    );

  const total =
    qty * harga;

  const el =
    document.getElementById(
      "belanjaTotalPreview"
    );

  if (el) {

    el.textContent =
      rupiah(total);

  }

}


/* =========================================================
   TODAY
   ========================================================= */

function today() {

  const d =
    new Date();

  return dateInput(d);

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

  const date =
    today();

  const trxTanggal =
    document.getElementById(
      "trxTanggal"
    );

  if (trxTanggal) {

    trxTanggal.value =
      date;

  }


  const start =
    document.getElementById(
      "reportStart"
    );

  const end =
    document.getElementById(
      "reportEnd"
    );

  if (
    start &&
    !start.value
  ) {

    const d =
      new Date();

    d.setDate(
      d.getDate() - 30
    );

    start.value =
      dateInput(d);

  }

  if (
    end &&
    !end.value
  ) {

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

  Object.keys(params)
    .forEach(
      function (key) {

        if (
          params[key] !== undefined &&
          params[key] !== null
        ) {

          url.searchParams.set(
            key,
            typeof params[key] === "object"
              ? JSON.stringify(params[key])
              : params[key]
          );

        }

      }
    );

  console.log(
    "GAS GET:",
    url.toString()
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

  const text =
    await response.text();

  console.log(
    "GAS GET RESPONSE:",
    text
  );

  if (!response.ok) {

    throw new Error(
      "HTTP " +
      response.status
    );

  }

  let json;

  try {

    json =
      JSON.parse(text);

  } catch (error) {

    throw new Error(
      "GAS tidak mengirim JSON: " +
      text.substring(0, 300)
    );

  }

  if (
    json &&
    json.success === false
  ) {

    throw new Error(
      json.error ||
      json.message ||
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

    action:
      action,

    ...data

  };


  console.log(
    "GAS POST PAYLOAD:",
    payload
  );


  try {

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


    const text =
      await response.text();


    console.log(
      "GAS POST RESPONSE:",
      text
    );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    let json;

    try {

      json =
        JSON.parse(text);

    } catch (error) {

      throw new Error(
        "POST GAS bukan JSON: " +
        text.substring(0, 300)
      );

    }


    if (
      json &&
      json.success === false
    ) {

      throw new Error(
        json.error ||
        json.message ||
        "GAS POST error"
      );

    }


    return json;

  } catch (postError) {

    console.warn(
      "POST GAS gagal:",
      postError
    );


    /*
     * FALLBACK GET
     */

    try {

      const url =
        new URL(GAS_URL);

      url.searchParams.set(
        "action",
        action
      );

      url.searchParams.set(
        "payload",
        JSON.stringify(payload)
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


      const text =
        await response.text();


      console.log(
        "GAS FALLBACK RESPONSE:",
        text
      );


      if (!response.ok) {

        throw new Error(
          "HTTP " +
          response.status
        );

      }


      let json;

      try {

        json =
          JSON.parse(text);

      } catch (error) {

        throw new Error(
          "GET fallback bukan JSON: " +
          text.substring(0, 300)
        );

      }


      if (
        json &&
        json.success === false
      ) {

        throw new Error(
          json.error ||
          json.message ||
          "GAS fallback error"
        );

      }


      return json;

    } catch (getError) {

      console.error(
        "POST dan GET GAS gagal:",
        {
          postError,
          getError
        }
      );


      throw new Error(
        "Server GAS tidak dapat dihubungi. " +
        "POST: " +
        postError.message +
        " | GET: " +
        getError.message
      );

    }

  }

}


/* =========================================================
   LOAD REMOTE APP DATA
   ========================================================= */

async function loadRemoteAppData() {

  const result =
    await apiGet(
      "appData"
    );


  console.log(
    "REMOTE APP DATA:",
    result
  );


  if (!result) {

    throw new Error(
      "Data dari GAS kosong"
    );

  }


  applyAppData(
    result
  );


  await saveLocalData(
    result
  );


  renderAll();


  setSyncText(
    "✓ Data tersinkron"
  );


  return result;

}


/* =========================================================
   APPLY APP DATA
   ========================================================= */

function applyAppData(
  result
) {

  if (!result) return;


  const source =
    result.appData &&
    result.appData.success
      ? result.appData
      : result;


  if (
    source.dashboard
  ) {

    state.dashboard =
      source.dashboard;

  }


  if (
    source.kategori
  ) {

    state.kategori =
      source.kategori;

  }


  if (
    Array.isArray(
      source.barang
    )
  ) {

    state.barang =
      source.barang;

  }


  if (
    Array.isArray(
      source.history
    )
  ) {

    state.history =
      source.history;

  }


  if (
    Array.isArray(
      source.hutang
    )
  ) {

    state.hutang =
      source.hutang;

  }

}


/* =========================================================
   REFRESH APP
   ========================================================= */

async function refreshApp() {

  updateConnectionStatus();


  if (!navigator.onLine) {

    renderAll();

    setSyncText(
      "Offline — memakai data lokal"
    );

    hideLoading();

    return;

  }


  try {

    setSyncText(
      "Menghubungkan ke server..."
    );


    const queue =
      await dbGetAll(
        STORE_QUEUE
      );


    if (
      queue.length > 0
    ) {

      setSyncText(
        "Mengirim " +
        queue.length +
        " data..."
      );

      await syncOffline();

    }


    setSyncText(
      "Mengambil data dari server..."
    );


    const result =
      await apiGet(
        "appData"
      );


    console.log(
      "APP DATA:",
      result
    );


    if (!result) {

      throw new Error(
        "GAS mengembalikan data kosong"
      );

    }


    applyAppData(
      result
    );


    await saveLocalData(
      result
    );


    renderAll();

    hideLoading();


    setSyncText(
      "✓ Terhubung ke server"
    );


  } catch (error) {

    console.error(
      "REFRESH ERROR:",
      error
    );


    try {

      await loadLocalData();

    } catch (dbError) {

      console.error(
        "LOCAL DATA ERROR:",
        dbError
      );

    }


    renderAll();

    hideLoading();


    setSyncText(
      "Server tidak tersedia — data lokal digunakan"
    );

  }

}


/* =========================================================
   LOCAL DATA
   ========================================================= */

async function loadLocalData() {

  const data =
    await dbGet(
      STORE_DATA,
      "main"
    );


  if (data) {

    applyAppData(
      data
    );

  }


  renderAll();

}


/* =========================================================
   SAVE LOCAL DATA
   ========================================================= */

async function saveLocalData(
  data
) {

  if (!data) return;


  await dbPut(
    STORE_DATA,
    {
      key:
        "main",

      ...data
    }
  );

}


/* =========================================================
   INDEXED DB
   FIX DATABASE BELUM SIAP
   ========================================================= */

function initDB() {

  if (dbInstance) {

    return Promise.resolve(
      dbInstance
    );

  }


  if (dbPromise) {

    return dbPromise;

  }


  dbPromise =
    new Promise(
      function (
        resolve,
        reject
      ) {

        if (
          !("indexedDB" in window)
        ) {

          reject(
            new Error(
              "IndexedDB tidak tersedia di browser."
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

            const db =
              event.target.result;


            /*
             * APP DATA
             */

            if (
              !db.objectStoreNames.contains(
                STORE_DATA
              )
            ) {

              db.createObjectStore(
                STORE_DATA,
                {
                  keyPath:
                    "key"
                }
              );

            }


            /*
             * OFFLINE QUEUE
             */

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
                  unique:
                    false
                }
              );

            }

          };


        request.onsuccess =
          function (event) {

            dbInstance =
              event.target.result;


            dbInstance.onclose =
              function () {

                console.warn(
                  "IndexedDB ditutup."
                );

                dbInstance =
                  null;

                dbPromise =
                  null;

              };


            dbInstance.onerror =
              function (event) {

                console.warn(
                  "IndexedDB error:",
                  event.target.error
                );

              };


            console.log(
              "✓ IndexedDB siap:",
              DB_NAME
            );


            resolve(
              dbInstance
            );

          };


        request.onerror =
          function (event) {

            dbInstance =
              null;

            dbPromise =
              null;


            reject(
              event.target.error ||
              new Error(
                "Gagal membuka IndexedDB."
              )
            );

          };


        request.onblocked =
          function () {

            console.warn(
              "IndexedDB sedang diblokir."
            );

          };

      }
    );


  return dbPromise;

}


/* =========================================================
   DB PUT
   ========================================================= */

async function dbPut(
  storeName,
  value
) {

  if (!dbInstance) {

    await initDB();

  }


  if (!dbInstance) {

    throw new Error(
      "Database belum siap"
    );

  }


  return new Promise(
    function (
      resolve,
      reject
    ) {

      try {

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
          store.put(
            value
          );


        request.onsuccess =
          function () {

            resolve(
              request.result
            );

          };


        request.onerror =
          function () {

            reject(
              request.error ||
              new Error(
                "Gagal menyimpan database"
              )
            );

          };


        tx.onerror =
          function () {

            reject(
              tx.error ||
              new Error(
                "Transaksi IndexedDB gagal"
              )
            );

          };

      } catch (error) {

        dbInstance =
          null;

        dbPromise =
          null;

        reject(
          error
        );

      }

    }
  );

}


/* =========================================================
   DB GET
   ========================================================= */

async function dbGet(
  storeName,
  key
) {

  if (!dbInstance) {

    await initDB();

  }


  if (!dbInstance) {

    throw new Error(
      "Database belum siap"
    );

  }


  return new Promise(
    function (
      resolve,
      reject
    ) {

      try {

        const tx =
          dbInstance.transaction(
            storeName,
            "readonly"
          );


        const store =
          tx.objectStore(
            storeName
          );


        const request =
          store.get(
            key
          );


        request.onsuccess =
          function () {

            resolve(
              request.result ||
              null
            );

          };


        request.onerror =
          function () {

            reject(
              request.error
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
   DB DELETE
   ========================================================= */

async function dbDelete(
  storeName,
  key
) {

  if (!dbInstance) {

    await initDB();

  }


  if (!dbInstance) {

    throw new Error(
      "Database belum siap"
    );

  }


  return new Promise(
    function (
      resolve,
      reject
    ) {

      try {

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
          store.delete(
            key
          );


        request.onsuccess =
          function () {

            resolve();

          };


        request.onerror =
          function () {

            reject(
              request.error
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
   DB GET ALL
   ========================================================= */

async function dbGetAll(
  storeName
) {

  if (!dbInstance) {

    await initDB();

  }


  if (!dbInstance) {

    throw new Error(
      "Database belum siap"
    );

  }


  return new Promise(
    function (
      resolve,
      reject
    ) {

      try {

        const tx =
          dbInstance.transaction(
            storeName,
            "readonly"
          );


        const store =
          tx.objectStore(
            storeName
          );


        const request =
          store.getAll();


        request.onsuccess =
          function () {

            resolve(
              request.result ||
              []
            );

          };


        request.onerror =
          function () {

            reject(
              request.error
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
   OFFLINE QUEUE
   ========================================================= */

async function addToQueue(
  action,
  data
) {

  await initDB();


  const queueId =
    data.id ||
    makeLocalId(
      "QUEUE"
    );


  await dbPut(
    STORE_QUEUE,
    {

      queueId:
        queueId,

      action:
        action,

      data:
        data,

      createdAt:
        Date.now(),

      attempts:
        0

    }
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

  let count = 0;

  try {

    count =
      await queueCount();

  } catch (error) {

    console.error(
      "Badge DB:",
      error
    );

  }


  const badge =
    document.getElementById(
      "syncBadge"
    );


  if (!badge) return;


  badge.textContent =
    String(count);


  badge.classList.toggle(
    "hidden",
    count <= 0
  );


  if (count > 0) {

    setSyncText(
      count +
      " transaksi menunggu sinkronisasi"
    );

  }

}


/* =========================================================
   SYNC OFFLINE
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

    setSyncText(
      "Semua data sudah sinkron"
    );

    await updateSyncBadge();

    return;

  }


  state.syncing =
    true;


  setSyncText(
    "Sinkronisasi " +
    items.length +
    " transaksi..."
  );


  try {

    const payload =
      items.map(
        function (item) {

          return {

            id:
              item.queueId,

            action:
              item.action,

            data:
              item.data

          };

        }
      );


    console.log(
      "SYNC PAYLOAD:",
      payload
    );


    const result =
      await apiPost(
        "sync",
        {
          items:
            payload
        }
      );


    console.log(
      "SYNC RESULT:",
      result
    );


    const results =
      Array.isArray(
        result.results
      )
        ? result.results
        : [];


    for (
      const item of items
    ) {

      const response =
        results.find(
          function (r) {

            return (
              String(r.id) ===
              String(item.queueId)
            );

          }
        );


      if (
        response &&
        (
          response.success === true ||
          response.ok === true
        )
      ) {

        await dbDelete(
          STORE_QUEUE,
          item.queueId
        );

        continue;

      }


      /*
       * DUPLICATE
       */

      if (
        response &&
        response.result &&
        response.result.duplicate
      ) {

        await dbDelete(
          STORE_QUEUE,
          item.queueId
        );

      }

    }


    /*
     * APP DATA DARI SERVER
     */

    if (
      result.appData
    ) {

      applyAppData(
        result.appData
      );

      await saveLocalData(
        result.appData
      );

    }


    renderAll();


    const remaining =
      await queueCount();


    if (
      remaining > 0
    ) {

      setSyncText(
        remaining +
        " data belum tersinkron"
      );

    } else {

      setSyncText(
        "✓ Semua data tersinkron"
      );

    }

  } catch (error) {

    console.error(
      "SYNC ERROR:",
      error
    );


    setSyncText(
      "Gagal sinkron — data tetap tersimpan di HP"
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
    !nominal ||
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

    tanggal:
      tanggal,

    jenis:
      state.currentType,

    kategori:
      kategori,

    keterangan:
      keterangan,

    nominal:
      nominal,

    rekening:
      rekening

  };


  try {

    await addToQueue(
      "tambahTransaksi",
      data
    );


    resetTransactionForm();


    showToast(
      navigator.onLine
        ? "Transaksi disimpan"
        : "Disimpan offline"
    );


    if (navigator.onLine) {

      await syncOffline();

      await refreshApp();

    }

  } catch (error) {

    console.error(
      "SAVE TRANSACTION:",
      error
    );

    showToast(
      "Gagal menyimpan: " +
      error.message
    );

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
    jual < 0
  ) {

    showToast(
      "Harga tidak valid"
    );

    return;

  }


  const data = {

    id:
      makeLocalId(
        "BRG"
      ),

    nama:
      nama,

    kategori:
      "Lainnya",

    modal:
      modal,

    jual:
      jual,

    stok:
      Math.max(
        0,
        stok
      ),

    minimum:
      0,

    supplier:
      ""

  };


  try {

    await addToQueue(
      "tambahBarang",
      data
    );


    /*
     * OPTIMISTIC LOCAL DATA
     */

    state.barang.push(
      data
    );


    renderBarang();

    fillBarangSelects();


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

      await refreshApp();

    }

  } catch (error) {

    console.error(
      "SAVE BARANG:",
      error
    );

    showToast(
      "Gagal menyimpan barang: " +
      error.message
    );

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
      function (b) {

        return String(b.id) ===
          String(barangId);

      }
    );


  if (!barang) {

    showToast(
      "Pilih barang"
    );

    return;

  }


  if (
    qty <= 0
  ) {

    showToast(
      "Jumlah tidak valid"
    );

    return;

  }


  if (
    harga <= 0
  ) {

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
      "Stok tidak cukup. Tersedia " +
      Number(barang.stok || 0)
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

    qty:
      qty,

    harga:
      harga,

    pelanggan:
      pelanggan,

    tanggal:
      today()

  };


  try {

    await addToQueue(
      "tambahPenjualan",
      data
    );


    /*
     * OPTIMISTIC STOCK
     */

    barang.stok =
      Number(
        barang.stok || 0
      ) - qty;


    renderBarang();

    fillBarangSelects();


    document
      .getElementById(
        "penjualanForm"
      )
      ?.reset();


    const qtyEl =
      document.getElementById(
        "jualQty"
      );

    if (qtyEl) {

      qtyEl.value =
        1;

    }


    const preview =
      document.getElementById(
        "jualTotalPreview"
      );

    if (preview) {

      preview.textContent =
        "Rp 0";

    }


    showToast(
      navigator.onLine
        ? "Penjualan disimpan"
        : "Penjualan disimpan offline"
    );


    if (navigator.onLine) {

      await syncOffline();

      await refreshApp();

    }

  } catch (error) {

    console.error(
      "SAVE PENJUALAN:",
      error
    );

    showToast(
      "Gagal menyimpan: " +
      error.message
    );

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
      function (b) {

        return String(b.id) ===
          String(barangId);

      }
    );


  if (!barang) {

    showToast(
      "Pilih barang"
    );

    return;

  }


  if (
    qty <= 0
  ) {

    showToast(
      "Jumlah tidak valid"
    );

    return;

  }


  if (
    harga <= 0
  ) {

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

    barangId:
      barangId,

    qty:
      qty,

    harga:
      harga,

    supplier:
      supplier,

    tanggal:
      today()

  };


  try {

    await addToQueue(
      "tambahBelanja",
      data
    );


    barang.stok =
      Number(
        barang.stok || 0
      ) + qty;


    renderBarang();

    fillBarangSelects();


    document
      .getElementById(
        "belanjaForm"
      )
      ?.reset();


    const qtyEl =
      document.getElementById(
        "belanjaQty"
      );

    if (qtyEl) {

      qtyEl.value =
        1;

    }


    const preview =
      document.getElementById(
        "belanjaTotalPreview"
      );

    if (preview) {

      preview.textContent =
        "Rp 0";

    }


    showToast(
      navigator.onLine
        ? "Belanja disimpan"
        : "Belanja disimpan offline"
    );


    if (navigator.onLine) {

      await syncOffline();

      await refreshApp();

    }

  } catch (error) {

    console.error(
      "SAVE BELANJA:",
      error
    );

    showToast(
      "Gagal menyimpan: " +
      error.message
    );

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

    nama:
      nama,

    nominal:
      nominal,

    jatuhTempo:
      jatuhTempo,

    keterangan:
      keterangan

  };


  try {

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

      await refreshApp();

    }

  } catch (error) {

    console.error(
      "SAVE HUTANG:",
      error
    );

    showToast(
      "Gagal menyimpan: " +
      error.message
    );

  }

}


/* =========================================================
   TRANSACTION TYPE
   ========================================================= */

function setTransactionType(
  type
) {

  state.currentType =
    String(type)
      .toUpperCase();


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
    state.dashboard || {};


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
      .sort(
        sortNewest
      )
      .slice(
        0,
        5
      );


  if (!list.length) {

    recent.innerHTML =
      `
      <div class="empty">
        Belum ada transaksi
      </div>
      `;

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
    state.kategori[jenis] ||
    [];


  if (!Array.isArray(categories)) {

    categories = [];

  }


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
    `
    <option value="">
      Pilih kategori
    </option>
    ` +
    categories
      .map(
        function (k) {

          return (
            `<option value="${esc(k)}">` +
            esc(k) +
            `</option>`
          );

        }
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
    Array.isArray(
      state.barang
    )
      ? state.barang
      : [];


  if (search) {

    list =
      list.filter(
        function (b) {

          return (
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
      );

  }


  if (!list.length) {

    container.innerHTML =
      `
      <div class="empty">
        Belum ada barang.
      </div>
      `;

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
          min-width:0
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


/* =========================================================
   FILTER BARANG
   ========================================================= */

function filterBarang(
  text
) {

  state.barangSearch =
    text || "";

  renderBarang();

}


/* =========================================================
   SELECT BARANG
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
    function (select) {

      if (!select) return;


      const current =
        select.value;


      select.innerHTML =
        `
        <option value="">
          Pilih barang
        </option>
        ` +
        state.barang
          .map(
            function (b) {

              return (
                `<option value="${esc(b.id)}">` +
                `${esc(b.nama)}` +
                ` — Stok ${Number(
                  b.stok || 0
                )}` +
                `</option>`
              );

            }
          )
          .join("");


      if (
        state.barang.some(
          function (b) {

            return String(b.id) ===
              String(current);

          }
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
    Array.isArray(
      state.history
    )
      ? state.history
          .slice()
          .sort(
            sortNewest
          )
      : [];


  if (search) {

    list =
      list.filter(
        function (x) {

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
      `
      <div class="empty">
        Belum ada transaksi.
      </div>
      `;

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
    )
      .toUpperCase();


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

          <div class="small"
               style="margin-top:4px;">

            ${esc(
              x.tanggal || "-"
            )}

            ·

            ${esc(
              x.kategori || ""
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
              style="margin-top:10px;"
            >

              Barang:
              ${esc(
                x.barangNama
              )}

              ${
                x.qty
                  ? " × " + x.qty
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
              style="margin-top:4px;"
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
      `
      <div class="empty">
        Belum ada hutang.
      </div>
      `;

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
            style="margin-top:5px;"
          >
            ${esc(
              h.keterangan ||
              "Hutang"
            )}
          </div>

        </div>


        <strong>
          ${rupiah(
            h.sisa
          )}
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
        Number(h.sisa || 0) > 0
          ? `
            <button
              type="button"
              class="primary-btn"
              style="
                width:100%;
                margin-top:13px;
              "
              onclick="bayarHutangPrompt('${escAttr(h.id)}')"
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
   BAYAR HUTANG
   ========================================================= */

async function bayarHutangPrompt(
  id
) {

  const h =
    state.hutang.find(
      function (x) {

        return String(x.id) ===
          String(id);

      }
    );


  if (!h) return;


  const input =
    prompt(
      "Nominal pembayaran:\nSisa " +
      rupiah(h.sisa),
      h.sisa
    );


  if (
    input === null
  ) return;


  const nominal =
    Number(
      input
    );


  if (
    !nominal ||
    nominal <= 0
  ) {

    showToast(
      "Nominal tidak valid"
    );

    return;

  }


  if (
    nominal >
    Number(h.sisa || 0)
  ) {

    showToast(
      "Pembayaran melebihi sisa hutang"
    );

    return;

  }


  const data = {

    id:
      id,

    nominal:
      nominal

  };


  try {

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

      await refreshApp();

    }

  } catch (error) {

    console.error(
      "BAYAR HUTANG:",
      error
    );

    showToast(
      "Gagal menyimpan: " +
      error.message
    );

  }

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

    let result;


    if (
      navigator.onLine
    ) {

      result =
        await apiGet(
          "laporan",
          {
            start:
              start,

            end:
              end
          }
        );

    } else {

      result =
        buildLocalReport(
          start,
          end
        );

    }


    renderReport(
      result
    );

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
      function (x) {

        const t =
          x.tanggal || "";


        return (
          (!start ||
            t >= start) &&
          (!end ||
            t <= end)
        );

      }
    );


  transaksi.forEach(
    function (x) {

      const jenis =
        String(
          x.jenis || ""
        )
          .toUpperCase();


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

    success:
      true,

    laporan: {

      start:
        start,

      end:
        end,

      pemasukan:
        pemasukan,

      pengeluaran:
        pengeluaran,

      penjualan:
        penjualan,

      saldo:
        pemasukan -
        pengeluaran,

      jumlahTransaksi:
        transaksi.length,

      transaksi:
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


  box.innerHTML =
    `

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
        style="margin-top:6px;"
      >

        ${Number(
          r.jumlahTransaksi || 0
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
      function (el) {

        el.classList.remove(
          "active"
        );

      }
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
      function (el) {

        el.classList.remove(
          "active"
        );

      }
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

  }

  else if (
    page ===
    "add"
  ) {

    navItems[1]
      ?.classList.add(
        "active"
      );

  }

  else if (
    page ===
    "barang"
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
    page ===
    "barang"
  ) {

    renderBarang();

  }

}


/* =========================================================
   MORE MENU
   ========================================================= */

function showMoreMenu() {

  const menu =
    document.getElementById(
      "moreMenu"
    );


  if (menu) {

    menu.classList.remove(
      "hidden"
    );

  }

}


function closeMoreMenu() {

  const menu =
    document.getElementById(
      "moreMenu"
    );


  if (menu) {

    menu.classList.add(
      "hidden"
    );

  }

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

  const el =
    document.getElementById(
      id
    );


  if (!el) return;


  el.classList.remove(
    "hidden"
  );

}


function closeModal(
  id
) {

  const el =
    document.getElementById(
      id
    );


  if (!el) return;


  el.classList.add(
    "hidden"
  );

}


/* =========================================================
   RESET TRANSACTION
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

  const el =
    document.getElementById(
      "loading"
    );


  if (el) {

    el.classList.add(
      "hidden"
    );

  }

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


  if (!el) return;


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
      function () {

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
    )
      ?.value
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
      a.tanggal ||
      0
    ).getTime();


  const db =
    new Date(
      b.tanggalDibuat ||
      b.tanggal ||
      0
    ).getTime();


  return db - da;

}


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
    value ?? ""
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
  "serviceWorker" in navigator
) {

  window.addEventListener(
    "load",
    function () {

      navigator.serviceWorker
        .register(
          "./sw.js",
          {
            scope:
              "./"
          }
        )
        .then(
          function () {

            console.log(
              "✓ Service Worker terdaftar"
            );

          }
        )
        .catch(
          function (error) {

            console.warn(
              "SW:",
              error
            );

          }
        );

    }
  );

}
