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
  "https://script.google.com/macros/s/AKfycbxxLldieVxzRZQqYKz9WvSbN0ZUKTqvV7YtMe-qhpr69QuftnzkFs4KONSCkj3Qi8CQ/exec";


/* =========================================================
   INDEXED DB
   ========================================================= */

const DB_NAME =
  "CatatKuDB";

const DB_VERSION =
  1;

const STORE_DATA =
  "appData";

const STORE_QUEUE =
  "offlineQueue";


/* =========================================================
   STATE
   ========================================================= */

const state = {

  dashboard: {},

  kategori: {},

  barang: [],

  history: [],

  hutang: [],

  currentType:
    "PEMASUKAN",

  online:
    navigator.onLine,

  syncing:
    false,

  barangSearch:
    "",

  historySearch:
    ""

};


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
   INIT
   ========================================================= */

async function initApp() {

  setTodayDefaults();

  setupForms();

  setupCalculations();

  updateConnectionStatus();

  await initDB();

  await loadLocalData();

  updateSyncBadge();

  /*
   * Coba ambil data terbaru dari GAS.
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

  /*
   * Sinkronisasi otomatis.
   */

  window.addEventListener(
    "online",
    async function () {

      updateConnectionStatus();

      setSyncText(
        "Koneksi kembali..."
      );

      await syncOffline();

      await refreshApp();

    }
  );


  window.addEventListener(
    "offline",
    function () {

      updateConnectionStatus();

      setSyncText(
        "Offline — transaksi disimpan di HP"
      );

    }
  );


  /*
   * Sync berkala.
   */

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
            b =>
              b.id ===
              jualBarang.value
          );

        if (barang) {

          const harga =
            document.getElementById(
              "jualHarga"
            );

          if (harga) {

            harga.value =
              barang.jual || 0;

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
  ]
  .forEach(function(id) {

    const el =
      document.getElementById(id);

    if (el) {

      el.addEventListener(
        "input",
        updateJualTotal
      );

    }

  });


  [
    "belanjaQty",
    "belanjaHarga"
  ]
  .forEach(function(id) {

    const el =
      document.getElementById(id);

    if (el) {

      el.addEventListener(
        "input",
        updateBelanjaTotal
      );

    }

  });

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
    .forEach(function(key) {

      if (
        params[key] !== undefined &&
        params[key] !== null
      ) {

        url.searchParams.set(
          key,
          params[key]
        );

      }

    });

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

  const text =
    await response.text();

  let json;

  try {

    json =
      JSON.parse(text);

  } catch (_) {

    throw new Error(
      "Response GAS bukan JSON."
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

  /*
   * Menggunakan URLSearchParams.
   * Ini membantu menghindari masalah preflight CORS.
   */

  const payload = {

    action:
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

  let json;

  try {

    json =
      JSON.parse(text);

  } catch (_) {

    throw new Error(
      "Response GAS bukan JSON."
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
   LOAD APP DATA
   ========================================================= */

async function loadRemoteAppData() {

  const result =
    await apiGet(
      "appData"
    );

  applyAppData(
    result
  );

  await saveLocalData(
    result
  );

  renderAll();

  setSyncText(
    "Data tersinkron"
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

  /*
   * appData bisa datang langsung atau
   * dari response sync.
   */

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
   REFRESH
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
      "Mengambil data..."
    );

    await syncOffline();

    await loadRemoteAppData();

    hideLoading();

    showToast(
      "Data berhasil diperbarui"
    );

  } catch (error) {

    console.error(
      error
    );

    await loadLocalData();

    renderAll();

    setSyncText(
      "Gagal terhubung — data lokal digunakan"
    );

    hideLoading();

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
   ========================================================= */

let dbInstance = null;


function initDB() {

  return new Promise(
    function(resolve, reject) {

      if (dbInstance) {

        resolve(
          dbInstance
        );

        return;

      }

      if (
        !("indexedDB" in window)
      ) {

        reject(
          new Error(
            "IndexedDB tidak tersedia."
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
                keyPath:
                  "key"
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
                    "queueId",
                  autoIncrement:
                    false
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


function dbPut(
  storeName,
  value
) {

  return new Promise(
    function(resolve, reject) {

      if (!dbInstance) {

        resolve(
          null
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
        store.put(
          value
        );

      request.onsuccess =
        () => resolve(
          request.result
        );

      request.onerror =
        () => reject(
          request.error
        );

    }
  );

}


function dbGet(
  storeName,
  key
) {

  return new Promise(
    function(resolve, reject) {

      if (!dbInstance) {

        resolve(
          null
        );

        return;

      }

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
        () => resolve(
          request.result
        );

      request.onerror =
        () => reject(
          request.error
        );

    }
  );

}


function dbDelete(
  storeName,
  key
) {

  return new Promise(
    function(resolve, reject) {

      if (!dbInstance) {

        resolve();

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
        store.delete(
          key
        );

      request.onsuccess =
        () => resolve();

      request.onerror =
        () => reject(
          request.error
        );

    }
  );

}


function dbGetAll(
  storeName
) {

  return new Promise(
    function(resolve, reject) {

      if (!dbInstance) {

        resolve([]);

        return;

      }

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
        () => resolve(
          request.result || []
        );

      request.onerror =
        () => reject(
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

  updateSyncBadge();

  return queueId;

}


async function queueCount() {

  const items =
    await dbGetAll(
      STORE_QUEUE
    );

  return items.length;

}


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
      items.map(function(item) {

        return {

          id:
            item.queueId,

          action:
            item.action,

          data:
            item.data

        };

      });

    const result =
      await apiPost(
        "sync",
        {
          items:
            payload
        }
      );


    const results =
      result.results || [];


    for (
      const item of items
    ) {

      const response =
        results.find(
          r =>
            String(r.id)
            ===
            String(item.queueId)
        );

      if (
        response &&
        response.success
      ) {

        await dbDelete(
          STORE_QUEUE,
          item.queueId
        );

      } else {

        /*
         * Jika server mengatakan duplicate,
         * tetap hapus dari antrean.
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

    }


    /*
     * Update data lokal dari server.
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

    setSyncText(
      "Sinkronisasi selesai"
    );

  } catch (error) {

    console.error(
      "Sync error:",
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
    value("trxTanggal");

  const kategori =
    value("trxKategori");

  const keterangan =
    value("trxKeterangan");

  const nominal =
    Number(
      value("trxNominal")
    );

  const rekening =
    value("trxRekening")
    || "Kas";

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


  /*
   * Simpan langsung ke antrean.
   * Jadi offline maupun online aman.
   */

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

}


/* =========================================================
   SAVE BARANG
   ========================================================= */

async function saveBarang(
  event
) {

  event.preventDefault();

  const nama =
    value("barangNama");

  const modal =
    Number(
      value("barangModalPrice")
    );

  const jual =
    Number(
      value("barangJualPrice")
    );

  const stok =
    Number(
      value("barangStok")
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

    await refreshApp();

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
    value("jualBarang");

  const qty =
    Number(
      value("jualQty")
    );

  const harga =
    Number(
      value("jualHarga")
    );

  const pelanggan =
    value("jualPelanggan")
    || "Umum";


  const barang =
    state.barang.find(
      b =>
        b.id === barangId
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

  /*
   * Cek stok hanya jika data lokal tersedia.
   */

  if (
    Number(barang.stok) < qty
  ) {

    showToast(
      "Stok tidak cukup. Tersedia " +
      barang.stok
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


  await addToQueue(
    "tambahPenjualan",
    data
  );


  /*
   * Optimistic update.
   * Stok lokal langsung berkurang.
   */

  barang.stok =
    Number(barang.stok)
    - qty;

  renderBarang();
  fillBarangSelects();


  document
    .getElementById(
      "penjualanForm"
    )
    ?.reset();


  document
    .getElementById(
      "jualQty"
    )
    .value = 1;


  document
    .getElementById(
      "jualTotalPreview"
    )
    .textContent =
      "Rp 0";


  showToast(
    navigator.onLine
      ? "Penjualan disimpan"
      : "Penjualan disimpan offline"
  );


  if (navigator.onLine) {

    await syncOffline();

    await refreshApp();

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
    value("belanjaBarang");

  const qty =
    Number(
      value("belanjaQty")
    );

  const harga =
    Number(
      value("belanjaHarga")
    );

  const supplier =
    value("belanjaSupplier");


  const barang =
    state.barang.find(
      b =>
        b.id === barangId
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


  await addToQueue(
    "tambahBelanja",
    data
  );


  /*
   * Optimistic update.
   */

  barang.stok =
    Number(barang.stok)
    + qty;

  renderBarang();
  fillBarangSelects();


  document
    .getElementById(
      "belanjaForm"
    )
    ?.reset();


  document
    .getElementById(
      "belanjaQty"
    )
    .value = 1;


  document
    .getElementById(
      "belanjaTotalPreview"
    )
    .textContent =
      "Rp 0";


  showToast(
    navigator.onLine
      ? "Belanja disimpan"
      : "Belanja disimpan offline"
  );


  if (navigator.onLine) {

    await syncOffline();

    await refreshApp();

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
    value("hutangNama");

  const nominal =
    Number(
      value("hutangNominal")
    );

  const jatuhTempo =
    value("hutangTempo");

  const keterangan =
    value("hutangKeterangan");


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
      .slice(0, 5);


  if (!list.length) {

    recent.innerHTML =
      `<div class="empty">
        Belum ada transaksi
      </div>`;

    return;

  }


  recent.innerHTML =
    list.map(
      transactionHTML
    ).join("");

}


/* =========================================================
   KATEGORI SELECT
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
        function(k) {

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
    state.barang;


  if (search) {

    list =
      list.filter(
        function(b) {

          return (
            String(b.nama || "")
              .toLowerCase()
              .includes(search)
            ||
            String(b.kategori || "")
              .toLowerCase()
              .includes(search)
          );

        }
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
    list.map(
      barangHTML
    ).join("");

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

        <div style="min-width:0">

          <strong style="
            display:block;
            font-size:16px;
            margin-bottom:5px;
          ">
            ${esc(b.nama)}
          </strong>

          <div class="small">
            ${esc(b.kategori || "Lainnya")}
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
          ${rupiah(b.labaNominal || 0)}
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
    function(select) {

      if (!select) return;

      const current =
        select.value;

      select.innerHTML =
        `<option value="">
          Pilih barang
        </option>` +
        state.barang
          .map(
            function(b) {

              return (
                `<option value="${esc(b.id)}">` +
                `${esc(b.nama)}` +
                ` — Stok ${Number(b.stok || 0)}` +
                `</option>`
              );

            }
          )
          .join("");


      if (
        state.barang.some(
          b =>
            b.id === current
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
      .sort(
        sortNewest
      );


  if (search) {

    list =
      list.filter(
        function(x) {

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
            <div class="small"
                 style="margin-top:10px;">
              Barang:
              ${esc(x.barangNama)}
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
            <div class="small"
                 style="margin-top:4px;">
              Pihak:
              ${esc(x.nama)}
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


  if (!state.hutang.length) {

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
    .toUpperCase()
    ===
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

          <div class="small"
               style="margin-top:5px;">
            ${esc(
              h.keterangan || "Hutang"
            )}
          </div>

        </div>

        <strong>
          ${rupiah(h.sisa)}
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
            ${rupiah(h.nominal)}
          </strong>

        </div>

        <div>

          <div class="small">
            Dibayar
          </div>

          <strong>
            ${rupiah(h.dibayar)}
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
              ? esc(h.jatuhTempo)
              : "-"
          }
        </div>

        <div class="small"
             style="
               margin-top:4px;
               font-weight:700;
               color:${
                 lunas
                   ? "#16a34a"
                   : "#dc2626"
               };
             ">
          ${esc(
            h.status ||
            "BELUM LUNAS"
          )}
        </div>

      </div>

      ${
        !lunas && h.sisa > 0
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
      x =>
        x.id === id
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


  const data = {

    id:
      id,

    nominal:
      nominal

  };


  /*
   * Pembayaran hutang membutuhkan
   * server karena harus update record.
   *
   * Kita tetap bisa antrekan offline.
   */

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

}


/* =========================================================
   REPORT
   ========================================================= */

async function loadReport() {

  const start =
    value("reportStart");

  const end =
    value("reportEnd");


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
      function(x) {

        const t =
          x.tanggal || "";

        return (
          (!start || t >= start) &&
          (!end || t <= end)
        );

      }
    );


  transaksi.forEach(
    function(x) {

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
            ${rupiah(r.pemasukan)}
          </div>

        </div>

      </div>

      <div class="summary-card">

        <div class="summary-info">

          <div class="small">
            Pengeluaran
          </div>

          <div class="summary-value">
            ${rupiah(r.pengeluaran)}
          </div>

        </div>

      </div>

      <div class="summary-card">

        <div class="summary-info">

          <div class="small">
            Penjualan
          </div>

          <div class="summary-value">
            ${rupiah(r.penjualan)}
          </div>

        </div>

      </div>

      <div class="summary-card">

        <div class="summary-info">

          <div class="small">
            Saldo
          </div>

          <div class="summary-value">
            ${rupiah(r.saldo)}
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
        ${esc(r.start || "-")}
        s/d
        ${esc(r.end || "-")}
      </strong>

      <div class="small"
           style="margin-top:6px;">
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
      function(el) {

        el.classList.remove(
          "active"
        );

      }
    );


  const target =
    document.getElementById(
      "page-" + page
    );


  if (target) {

    target.classList.add(
      "active"
    );

  }


  /*
   * Bottom nav active.
   */

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      function(el) {

        el.classList.remove(
          "active"
        );

      }
    );


  if (
    page === "dashboard"
  ) {

    document
      .querySelectorAll(
        ".nav-item"
      )[0]
      ?.classList.add(
        "active"
      );

  }

  else if (
    page === "add"
  ) {

    document
      .querySelectorAll(
        ".nav-item"
      )[1]
      ?.classList.add(
        "active"
      );

  }

  else if (
    page === "barang"
  ) {

    document
      .querySelectorAll(
        ".nav-item"
      )[3]
      ?.classList.add(
        "active"
      );

  }


  closeQuickAdd();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  /*
   * Jika halaman barang,
   * refresh render.
   */

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

let toastTimer = null;


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
      function() {

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
    document.getElementById(id)
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
    Number(value || 0);

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
      .substring(2, 9)
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
   SERVICE WORKER UPDATE
   ========================================================= */

if (
  "serviceWorker" in navigator
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
        .catch(
          function(error) {

            console.warn(
              "SW:",
              error
            );

          }
        );

    }
  );

}
