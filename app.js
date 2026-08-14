/* =========================================================
   CATATKU — APP.JS
   FINAL CLIENT
   Backend: Google Apps Script
   Database: 3 SHEET
   ========================================================= */

"use strict";


/* =========================================================
   CONFIG
   ========================================================= */

const CATATKU_CONFIG = {

  GAS_URL:
    "https://script.google.com/macros/s/AKfycbxqJ86xAmjCOp_xZ9RHanPKSJ_FlFdkA6f2_8e9LtFuAl570xWAse8AUhKU_Tp6oKSp/exec",

  API_KEY:
    "CATATKU-2026-PRIBADI",

  CACHE_KEY:
    "CATATKU_CACHE_V1",

  OFFLINE_KEY:
    "CATATKU_OFFLINE_QUEUE_V1",

  LIMIT:
    100

};


/* =========================================================
   GLOBAL STATE
   ========================================================= */

const App = {

  dashboard: {},

  barang: [],

  pengeluaran: [],

  history: [],

  hutang: [],

  laporan: {},

  loading: false,

  initialized: false

};


/* =========================================================
   SHORTCUT
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}


function qs(selector) {
  return document.querySelector(selector);
}


function qsa(selector) {
  return Array.from(
    document.querySelectorAll(selector)
  );
}


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function () {

    initCatatKu();

  }
);


async function initCatatKu() {

  if (App.initialized) {
    return;
  }

  App.initialized = true;

  setupNavigation();

  setupForms();

  setupGlobalEvents();

  loadCache();

  updateOnlineStatus();

  await loadAppData();

}


/* =========================================================
   API
   ========================================================= */

function buildUrl(action, payload) {

  let url =
    CATATKU_CONFIG.GAS_URL +
    "?key=" +
    encodeURIComponent(
      CATATKU_CONFIG.API_KEY
    ) +
    "&action=" +
    encodeURIComponent(action);


  if (
    payload !== undefined &&
    payload !== null
  ) {

    url +=
      "&payload=" +
      encodeURIComponent(
        JSON.stringify(payload)
      );

  }


  return url;

}


/* =========================================================
   GET API
   ========================================================= */

async function apiGet(
  action,
  payload
) {

  if (!CATATKU_CONFIG.GAS_URL) {

    throw new Error(
      "URL Google Apps Script belum diisi."
    );

  }


  const url =
    buildUrl(
      action,
      payload
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
      "Server error: HTTP " +
      response.status
    );

  }


  const result =
    await response.json();


  if (!result.success) {

    throw new Error(
      result.error ||
      "API gagal."
    );

  }


  return result.data;

}


/* =========================================================
   POST API
   ========================================================= */

async function apiPost(
  action,
  payload
) {

  if (!CATATKU_CONFIG.GAS_URL) {

    throw new Error(
      "URL Google Apps Script belum diisi."
    );

  }


  const response =
    await fetch(
      CATATKU_CONFIG.GAS_URL +
      "?key=" +
      encodeURIComponent(
        CATATKU_CONFIG.API_KEY
      ),
      {
        method: "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body: JSON.stringify({

          action: action,

          payload: payload || {}

        })
      }
    );


  if (!response.ok) {

    throw new Error(
      "Server error: HTTP " +
      response.status
    );

  }


  const result =
    await response.json();


  if (!result.success) {

    throw new Error(
      result.error ||
      "API gagal."
    );

  }


  return result.data;

}


/* =========================================================
   LOAD APP DATA
   ========================================================= */

async function loadAppData() {

  setLoading(true);

  try {

    if (!navigator.onLine) {

      showToast(
        "Mode offline. Menggunakan data terakhir.",
        "warning"
      );

      renderAll();

      return;

    }


    const data =
      await apiGet(
        "appData"
      );


    App.dashboard =
      data.dashboard || {};


    App.barang =
      Array.isArray(data.barang)
        ? data.barang
        : [];


    App.pengeluaran =
      Array.isArray(data.pengeluaran)
        ? data.pengeluaran
        : [];


    App.history =
      Array.isArray(data.history)
        ? data.history
        : [];


    App.hutang =
      Array.isArray(data.hutang)
        ? data.hutang
        : [];


    saveCache();

    renderAll();

    showToast(
      "Data berhasil diperbarui.",
      "success"
    );


  } catch (error) {

    console.error(
      "loadAppData:",
      error
    );


    showToast(
      error.message ||
      "Gagal mengambil data.",
      "error"
    );


    renderAll();

  } finally {

    setLoading(false);

  }

}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshData() {

  await loadAppData();

}


/* =========================================================
   CACHE
   ========================================================= */

function saveCache() {

  try {

    localStorage.setItem(
      CATATKU_CONFIG.CACHE_KEY,
      JSON.stringify({

        dashboard:
          App.dashboard,

        barang:
          App.barang,

        pengeluaran:
          App.pengeluaran,

        history:
          App.history,

        hutang:
          App.hutang,

        savedAt:
          Date.now()

      })
    );

  } catch (error) {

    console.warn(
      "Cache gagal:",
      error
    );

  }

}


function loadCache() {

  try {

    const raw =
      localStorage.getItem(
        CATATKU_CONFIG.CACHE_KEY
      );


    if (!raw) {
      return;
    }


    const data =
      JSON.parse(raw);


    App.dashboard =
      data.dashboard || {};


    App.barang =
      data.barang || [];


    App.pengeluaran =
      data.pengeluaran || [];


    App.history =
      data.history || [];


    App.hutang =
      data.hutang || [];


    renderAll();

  } catch (error) {

    console.warn(
      "Cache tidak valid.",
      error
    );

  }

}


/* =========================================================
   RENDER ALL
   ========================================================= */

function renderAll() {

  renderDashboard();

  renderBarang();

  renderPengeluaran();

  renderHistory();

  renderHutang();

  updateCounters();

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  const d =
    App.dashboard || {};


  setText(
    [
      "saldo",
      "totalSaldo"
    ],
    formatRupiah(
      d.saldo
    )
  );


  setText(
    [
      "totalPemasukan",
      "pemasukan"
    ],
    formatRupiah(
      d.totalPemasukan
    )
  );


  setText(
    [
      "totalPengeluaran",
      "pengeluaran"
    ],
    formatRupiah(
      d.totalPengeluaran
    )
  );


  setText(
    [
      "totalPenjualan",
      "penjualan"
    ],
    formatRupiah(
      d.totalPenjualan
    )
  );


  setText(
    [
      "totalBelanja",
      "belanja"
    ],
    formatRupiah(
      d.totalBelanja
    )
  );


  setText(
    [
      "totalHutang",
      "hutang"
    ],
    formatRupiah(
      d.totalHutang
    )
  );


  setText(
    [
      "totalStok",
      "stok"
    ],
    numberFormat(
      d.totalStok
    )
  );


  setText(
    [
      "jumlahBarang"
    ],
    numberFormat(
      d.jumlahBarang
    )
  );


  setText(
    [
      "stokMenipis"
    ],
    numberFormat(
      d.stokMenipis
    )
  );


  setText(
    [
      "stokHabis"
    ],
    numberFormat(
      d.stokHabis
    )
  );

}


/* =========================================================
   BARANG
   ========================================================= */

function renderBarang(
  list = App.barang
) {

  const containers = [
    "barangList",
    "listBarang",
    "barangContainer",
    "productList"
  ];


  const container =
    findFirstElement(
      containers
    );


  if (!container) {
    return;
  }


  if (!list.length) {

    container.innerHTML =

      '<div class="empty-state">' +
      'Belum ada barang.' +
      '</div>';

    return;

  }


  container.innerHTML =
    list
      .map(
        function (b) {

          const status =
            b.statusStok ||
            getStatusStok(
              b.stok,
              b.minimum
            );


          return `

            <div class="barang-card"
                 data-id="${escapeHtml(b.id)}">

              <div class="barang-info">

                <strong>
                  ${escapeHtml(b.nama)}
                </strong>

                <small>
                  ${escapeHtml(b.kategori || "-")}
                </small>

                <small>
                  Modal:
                  ${formatRupiah(b.hargaModal)}
                </small>

                <strong>
                  ${formatRupiah(b.hargaJual)}
                </strong>

              </div>


              <div class="barang-stock">

                <b>
                  Stok ${numberFormat(b.stok)}
                </b>

                <span class="stock-${status.toLowerCase()}">
                  ${status}
                </span>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   SEARCH BARANG
   ========================================================= */

function searchBarang(keyword) {

  keyword =
    String(
      keyword || ""
    )
      .toLowerCase()
      .trim();


  if (!keyword) {

    renderBarang(
      App.barang
    );

    return;

  }


  const result =
    App.barang.filter(
      function (b) {

        return (

          String(
            b.nama || ""
          )
            .toLowerCase()
            .includes(keyword)

          ||

          String(
            b.kategori || ""
          )
            .toLowerCase()
            .includes(keyword)

          ||

          String(
            b.id || ""
          )
            .toLowerCase()
            .includes(keyword)

        );

      }
    );


  renderBarang(
    result
  );

}


/* =========================================================
   PENGELUARAN
   ========================================================= */

function renderPengeluaran() {

  const container =
    findFirstElement([
      "pengeluaranList",
      "listPengeluaran"
    ]);


  if (!container) {
    return;
  }


  if (!App.pengeluaran.length) {

    container.innerHTML =
      '<div class="empty-state">Belum ada pengeluaran.</div>';

    return;

  }


  container.innerHTML =
    App.pengeluaran
      .map(
        function (item) {

          return `

            <div class="transaction-item">

              <div>

                <strong>
                  ${escapeHtml(
                    item.keterangan ||
                    item.kategori ||
                    "Pengeluaran"
                  )}
                </strong>

                <small>
                  ${formatTanggal(
                    item.tanggal
                  )}
                </small>

              </div>

              <strong class="text-danger">
                - ${formatRupiah(
                  item.nominal
                )}
              </strong>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   HISTORY
   ========================================================= */

function renderHistory() {

  const container =
    findFirstElement([
      "historyList",
      "listHistory",
      "riwayatList",
      "transaksiList"
    ]);


  if (!container) {
    return;
  }


  if (!App.history.length) {

    container.innerHTML =
      '<div class="empty-state">Belum ada transaksi.</div>';

    return;

  }


  container.innerHTML =
    App.history
      .map(
        function (item) {

          const entity =
            String(
              item.entity || ""
            ).toUpperCase();


          let amountClass =
            "text-success";


          let sign = "+";


          if (
            entity ===
            "PENGELUARAN"
            ||
            entity ===
            "BELANJA"
          ) {

            amountClass =
              "text-danger";

            sign = "-";

          }


          return `

            <div class="transaction-item">

              <div>

                <strong>
                  ${escapeHtml(
                    getHistoryTitle(item)
                  )}
                </strong>

                <small>
                  ${formatTanggal(
                    item.tanggal
                  )}
                </small>

              </div>

              <strong class="${amountClass}">

                ${sign}
                ${formatRupiah(
                  getHistoryNominal(item)
                )}

              </strong>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   HISTORY TITLE
   ========================================================= */

function getHistoryTitle(item) {

  const entity =
    String(
      item.entity || ""
    ).toUpperCase();


  switch (entity) {

    case "PENJUALAN":
      return (
        "Penjualan " +
        (
          item.barangNama ||
          "Barang"
        )
      );


    case "BELANJA":
      return (
        "Belanja " +
        (
          item.barangNama ||
          "Barang"
        )
      );


    case "HUTANG":
      return (
        "Hutang " +
        (
          item.nama ||
          ""
        )
      );


    case "BAYAR_HUTANG":
      return "Pembayaran Hutang";


    case "PENGELUARAN":
      return (
        item.keterangan ||
        "Pengeluaran"
      );


    default:
      return (
        item.keterangan ||
        "Pemasukan"
      );

  }

}


/* =========================================================
   HISTORY NOMINAL
   ========================================================= */

function getHistoryNominal(item) {

  const entity =
    String(
      item.entity || ""
    ).toUpperCase();


  if (
    entity ===
    "PENJUALAN"
    ||
    entity ===
    "BELANJA"
  ) {

    return (
      numberValue(item.qty) *
      numberValue(item.harga)
    );

  }


  return numberValue(
    item.nominal
  );

}


/* =========================================================
   HUTANG
   ========================================================= */

function renderHutang() {

  const container =
    findFirstElement([
      "hutangList",
      "listHutang"
    ]);


  if (!container) {
    return;
  }


  if (!App.hutang.length) {

    container.innerHTML =
      '<div class="empty-state">Tidak ada hutang aktif.</div>';

    return;

  }


  container.innerHTML =
    App.hutang
      .map(
        function (h) {

          return `

            <div class="hutang-card">

              <div>

                <strong>
                  ${escapeHtml(
                    h.nama || "Hutang"
                  )}
                </strong>

                <small>
                  Jatuh tempo:
                  ${formatTanggal(
                    h.jatuhTempo
                  )}
                </small>

              </div>


              <div>

                <strong>
                  ${formatRupiah(
                    h.sisa
                  )}
                </strong>

                <small>
                  dari ${formatRupiah(
                    h.nominal
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
   COUNTERS
   ========================================================= */

function updateCounters() {

  const menipis =
    App.barang.filter(
      b =>
        b.statusStok ===
        "MENIPIS"
    ).length;


  const habis =
    App.barang.filter(
      b =>
        b.statusStok ===
        "HABIS"
    ).length;


  setText(
    [
      "badgeStok",
      "stockBadge",
      "stokBadge"
    ],
    menipis + habis
  );


  setText(
    [
      "badgeHutang",
      "hutangBadge"
    ],
    App.hutang.length
  );

}


/* =========================================================
   TAMBAH BARANG
   ========================================================= */

async function simpanBarang(
  payload
) {

  payload =
    payload || {};


  try {

    setLoading(true);


    const result =
      await apiPost(
        "tambahBarang",
        payload
      );


    showToast(
      result.message ||
      "Barang berhasil disimpan.",
      "success"
    );


    await loadAppData();


    return result;

  } catch (error) {

    showToast(
      error.message,
      "error"
    );


    throw error;

  } finally {

    setLoading(false);

  }

}


/* =========================================================
   UPDATE BARANG
   ========================================================= */

async function editBarang(
  payload
) {

  try {

    setLoading(true);


    const result =
      await apiPost(
        "updateBarang",
        payload
      );


    showToast(
      "Barang berhasil diperbarui.",
      "success"
    );


    await loadAppData();


    return result;

  } catch (error) {

    showToast(
      error.message,
      "error"
    );


    throw error;

  } finally {

    setLoading(false);

  }

}


/* =========================================================
   PENJUALAN
   ========================================================= */

async function simpanPenjualan(
  payload
) {

  try {

    setLoading(true);


    const result =
      await apiPost(
        "tambahPenjualan",
        payload
      );


    showToast(
      "Penjualan berhasil disimpan.",
      "success"
    );


    await loadAppData();


    return result;

  } catch (error) {

    showToast(
      error.message,
      "error"
    );


    throw error;

  } finally {

    setLoading(false);

  }

}


/* =========================================================
   BELANJA
   ========================================================= */

async function simpanBelanja(
  payload
) {

  try {

    setLoading(true);


    const result =
      await apiPost(
        "tambahBelanja",
        payload
      );


    showToast(
      "Belanja stok berhasil disimpan.",
      "success"
    );


    await loadAppData();


    return result;

  } catch (error) {

    showToast(
      error.message,
      "error"
    );


    throw error;

  } finally {

    setLoading(false);

  }

}


/* =========================================================
   PEMASUKAN
   ========================================================= */

async function simpanPemasukan(
  payload
) {

  try {

    setLoading(true);


    const data =
      Object.assign(
        {},
        payload,
        {
          tipe:
            "PEMASUKAN"
        }
      );


    const result =
      await apiPost(
        "tambahTransaksi",
        data
      );


    showToast(
      "Pemasukan berhasil disimpan.",
      "success"
    );


    await loadAppData();


    return result;

  } catch (error) {

    showToast(
      error.message,
      "error"
    );


    throw error;

  } finally {

    setLoading(false);

  }

}


/* =========================================================
   PENGELUARAN
   ========================================================= */

async function simpanPengeluaran(
  payload
) {

  try {

    setLoading(true);


    const data =
      Object.assign(
        {},
        payload,
        {
          tipe:
            "PENGELUARAN"
        }
      );


    const result =
      await apiPost(
        "tambahTransaksi",
        data
      );


    showToast(
      "Pengeluaran berhasil disimpan.",
      "success"
    );


    await loadAppData();


    return result;

  } catch (error) {

    showToast(
      error.message,
      "error"
    );


    throw error;

  } finally {

    setLoading(false);

  }

}


/* =========================================================
   HUTANG
   ========================================================= */

async function simpanHutang(
  payload
) {

  try {

    setLoading(true);


    const result =
      await apiPost(
        "tambahHutang",
        payload
      );


    showToast(
      "Hutang berhasil disimpan.",
      "success"
    );


    await loadAppData();


    return result;

  } catch (error) {

    showToast(
      error.message,
      "error"
    );


    throw error;

  } finally {

    setLoading(false);

  }

}


/* =========================================================
   BAYAR HUTANG
   ========================================================= */

async function simpanBayarHutang(
  payload
) {

  try {

    setLoading(true);


    const result =
      await apiPost(
        "bayarHutang",
        payload
      );


    showToast(
      "Pembayaran hutang berhasil.",
      "success"
    );


    await loadAppData();


    return result;

  } catch (error) {

    showToast(
      error.message,
      "error"
    );


    throw error;

  } finally {

    setLoading(false);

  }

}


/* =========================================================
   TRANSAKSI GENERIC
   ========================================================= */

async function simpanTransaksi(
  payload
) {

  const tipe =
    String(
      payload.tipe ||
      payload.jenis ||
      "PENGELUARAN"
    ).toUpperCase();


  if (
    tipe ===
    "PEMASUKAN"
  ) {

    return simpanPemasukan(
      payload
    );

  }


  return simpanPengeluaran(
    payload
  );

}


/* =========================================================
   LAPORAN
   ========================================================= */

async function loadLaporan(
  mulai,
  akhir
) {

  try {

    const data =
      await apiGet(
        "laporan",
        {
          mulai:
            mulai || "",

          akhir:
            akhir || ""
        }
      );


    App.laporan =
      data || {};


    renderLaporan();


    return data;

  } catch (error) {

    showToast(
      error.message,
      "error"
    );


    throw error;

  }

}


/* =========================================================
   RENDER LAPORAN
   ========================================================= */

function renderLaporan() {

  const l =
    App.laporan || {};


  setText(
    [
      "laporanPemasukan"
    ],
    formatRupiah(
      l.pemasukan
    )
  );


  setText(
    [
      "laporanPengeluaran"
    ],
    formatRupiah(
      l.pengeluaran
    )
  );


  setText(
    [
      "laporanPenjualan"
    ],
    formatRupiah(
      l.penjualan
    )
  );


  setText(
    [
      "laporanBelanja"
    ],
    formatRupiah(
      l.belanja
    )
  );


  setText(
    [
      "laporanLabaKotor"
    ],
    formatRupiah(
      l.labaKotor
    )
  );


  setText(
    [
      "laporanLaba"
    ],
    formatRupiah(
      l.laba
    )
  );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

  qsa(
    "[data-page]"
  )
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            const page =
              button.dataset.page;


            showPage(
              page
            );

          }
        );

      }
    );

}


function showPage(
  page
) {

  qsa(
    "[data-page-content]"
  )
    .forEach(
      function (section) {

        const target =
          section.dataset.pageContent;


        section.hidden =
          target !== page;

      }
    );


  qsa(
    "[data-page]"
  )
    .forEach(
      function (button) {

        button.classList.toggle(
          "active",
          button.dataset.page ===
          page
        );

      }
    );

}


/* =========================================================
   FORM EVENTS
   ========================================================= */

function setupForms() {

  qsa(
    "form"
  )
    .forEach(
      function (form) {

        form.addEventListener(
          "submit",
          handleFormSubmit
        );

      }
    );

}


/* =========================================================
   HANDLE FORM
   ========================================================= */

async function handleFormSubmit(
  event
) {

  const form =
    event.currentTarget;


  const action =
    form.dataset.action;


  if (!action) {
    return;
  }


  event.preventDefault();


  const payload =
    formToObject(
      form
    );


  try {

    switch (action) {

      case "tambahBarang":

        await simpanBarang(
          payload
        );

        break;


      case "updateBarang":

        await editBarang(
          payload
        );

        break;


      case "tambahPenjualan":

        await simpanPenjualan(
          payload
        );

        break;


      case "tambahBelanja":

        await simpanBelanja(
          payload
        );

        break;


      case "tambahHutang":

        await simpanHutang(
          payload
        );

        break;


      case "bayarHutang":

        await simpanBayarHutang(
          payload
        );

        break;


      case "pemasukan":

        await simpanPemasukan(
          payload
        );

        break;


      case "pengeluaran":

        await simpanPengeluaran(
          payload
        );

        break;


      default:

        console.warn(
          "Action form tidak dikenal:",
          action
        );

    }


    form.reset();

  } catch (error) {

    console.error(
      error
    );

  }

}


/* =========================================================
   FORM TO OBJECT
   ========================================================= */

function formToObject(
  form
) {

  const data = {};


  Array.from(
    form.elements
  )
    .forEach(
      function (element) {

        if (!element.name) {
          return;
        }


        if (
          element.type ===
          "checkbox"
        ) {

          data[element.name] =
            element.checked;

          return;

        }


        data[element.name] =
          element.value;

      }
    );


  return data;

}


/* =========================================================
   GLOBAL EVENTS
   ========================================================= */

function setupGlobalEvents() {

  document.addEventListener(
    "input",
    function (event) {

      const target =
        event.target;


      if (
        target.matches(
          "[data-search-barang]"
        )
      ) {

        searchBarang(
          target.value
        );

      }

    }
  );


  window.addEventListener(
    "online",
    async function () {

      updateOnlineStatus();

      showToast(
        "Internet tersambung.",
        "success"
      );


      await processOfflineQueue();

      await loadAppData();

    }
  );


  window.addEventListener(
    "offline",
    function () {

      updateOnlineStatus();

      showToast(
        "Tidak ada internet. Mode offline aktif.",
        "warning"
      );

    }
  );


  qsa(
    "[data-refresh]"
  )
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          refreshData
        );

      }
    );

}


/* =========================================================
   OFFLINE QUEUE
   ========================================================= */

function getOfflineQueue() {

  try {

    return JSON.parse(
      localStorage.getItem(
        CATATKU_CONFIG.OFFLINE_KEY
      ) || "[]"
    );

  } catch (error) {

    return [];

  }

}


function saveOfflineQueue(
  queue
) {

  localStorage.setItem(
    CATATKU_CONFIG.OFFLINE_KEY,
    JSON.stringify(queue)
  );

}


function addOfflineRecord(
  action,
  payload
) {

  const queue =
    getOfflineQueue();


  queue.push({

    id:
      cryptoRandomId(),

    action:
      action,

    payload:
      payload,

    createdAt:
      Date.now()

  });


  saveOfflineQueue(
    queue
  );

}


async function processOfflineQueue() {

  if (!navigator.onLine) {
    return;
  }


  const queue =
    getOfflineQueue();


  if (!queue.length) {
    return;
  }


  const remaining = [];


  for (
    const item of queue
  ) {

    try {

      await apiPost(
        item.action,
        item.payload
      );

    } catch (error) {

      remaining.push(
        item
      );

    }

  }


  saveOfflineQueue(
    remaining
  );

}


/* =========================================================
   ONLINE STATUS
   ========================================================= */

function updateOnlineStatus() {

  const online =
    navigator.onLine;


  qsa(
    "[data-online-status]"
  )
    .forEach(
      function (el) {

        el.textContent =
          online
            ? "Online"
            : "Offline";

        el.classList.toggle(
          "offline",
          !online
        );

      }
    );

}


/* =========================================================
   LOADING
   ========================================================= */

function setLoading(
  loading
) {

  App.loading =
    loading;


  qsa(
    "[data-loading]"
  )
    .forEach(
      function (el) {

        el.hidden =
          !loading;

      }
    );


  qsa(
    "button"
  )
    .forEach(
      function (button) {

        if (
          button.dataset.loadingLock ===
          "true"
        ) {

          button.disabled =
            loading;

        }

      }
    );

}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
  message,
  type = "info"
) {

  let toast =
    $("toast");


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


  toast.dataset.type =
    type;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    showToast.timer
  );


  showToast.timer =
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
   FORMAT RUPIAH
   ========================================================= */

function formatRupiah(
  value
) {

  const n =
    numberValue(
      value
    );


  return "Rp " +
    new Intl.NumberFormat(
      "id-ID"
    ).format(
      Math.round(n)
    );

}


/* =========================================================
   FORMAT NUMBER
   ========================================================= */

function numberFormat(
  value
) {

  return new Intl.NumberFormat(
    "id-ID"
  ).format(
    numberValue(value)
  );

}


/* =========================================================
   NUMBER
   ========================================================= */

function numberValue(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;

  }


  if (
    typeof value ===
    "number"
  ) {

    return isNaN(value)
      ? 0
      : value;

  }


  let s =
    String(value)
      .trim()
      .replace(/Rp/gi, "")
      .replace(/\s/g, "");


  if (
    s.includes(".") &&
    !s.includes(",")
  ) {

    s =
      s.replace(
        /\./g,
        ""
      );

  }


  if (
    s.includes(",")
  ) {

    s =
      s.replace(
        /\./g,
        ""
      )
      .replace(
        ",",
        "."
      );

  }


  s =
    s.replace(
      /[^\d.-]/g,
      ""
    );


  const n =
    Number(s);


  return isNaN(n)
    ? 0
    : n;

}


/* =========================================================
   DATE
   ========================================================= */

function formatTanggal(
  value
) {

  if (!value) {
    return "-";
  }


  const s =
    String(value)
      .substring(
        0,
        10
      );


  const parts =
    s.split("-");


  if (
    parts.length === 3
  ) {

    return (
      parts[2] +
      "/" +
      parts[1] +
      "/" +
      parts[0]
    );

  }


  return s;

}


/* =========================================================
   STOCK STATUS
   ========================================================= */

function getStatusStok(
  stok,
  minimum
) {

  stok =
    numberValue(stok);

  minimum =
    numberValue(minimum);


  if (
    stok <= 0
  ) {

    return "HABIS";

  }


  if (
    stok <= minimum
  ) {

    return "MENIPIS";

  }


  return "AMAN";

}


/* =========================================================
   DOM HELPERS
   ========================================================= */

function setText(
  ids,
  value
) {

  if (!Array.isArray(ids)) {
    ids = [ids];
  }


  ids.forEach(
    function (id) {

      const el =
        $(id);


      if (el) {

        el.textContent =
          value === undefined ||
          value === null
            ? "-"
            : value;

      }

    }
  );

}


function findFirstElement(
  ids
) {

  for (
    const id of ids
  ) {

    const el =
      $(id);


    if (el) {
      return el;
    }

  }


  return null;

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
  value
) {

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
   RANDOM ID
   ========================================================= */

function cryptoRandomId() {

  if (
    window.crypto &&
    crypto.randomUUID
  ) {

    return crypto.randomUUID();

  }


  return (
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2)
  );

}


/* =========================================================
   GLOBAL EXPORT
   Supaya HTML onclick="" tetap bisa digunakan
   ========================================================= */

window.App =
  App;

window.loadAppData =
  loadAppData;

window.refreshData =
  refreshData;

window.showPage =
  showPage;

window.searchBarang =
  searchBarang;

window.simpanBarang =
  simpanBarang;

window.editBarang =
  editBarang;

window.simpanPenjualan =
  simpanPenjualan;

window.simpanBelanja =
  simpanBelanja;

window.simpanPemasukan =
  simpanPemasukan;

window.simpanPengeluaran =
  simpanPengeluaran;

window.simpanHutang =
  simpanHutang;

window.simpanBayarHutang =
  simpanBayarHutang;

window.simpanTransaksi =
  simpanTransaksi;

window.loadLaporan =
  loadLaporan;

window.showToast =
  showToast;


/* =========================================================
   SELESAI
   ========================================================= */
