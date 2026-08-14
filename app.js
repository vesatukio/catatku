/* =========================================================
   CATATKU - APP.JS
   Backend : Google Apps Script
   Sheet   : BARANG | PENGELUARAN | DATA
   ========================================================= */

"use strict";

/* =========================================================
   KONFIGURASI GAS
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxqJ86xAmjCOp_xZ9RHanPKSJ_FlFdkA6f2_8e9LtFuAl570xWAse8AUhKU_Tp6oKSp/exec";

/*
  Jika URL GAS Anda berbeda, cukup ganti GAS_URL di atas.
*/

const APP_NAME = "CatatKu";

let appData = {
  dashboard: {},
  barang: [],
  history: [],
  hutang: [],
  kategori: [],
  report: null
};

let currentTransactionType = "PEMASUKAN";
let offlineQueue = [];
let isSyncing = false;


/* =========================================================
   UTILITAS
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function rupiah(value) {
  const n = Number(value || 0);

  return "Rp " + n.toLocaleString("id-ID");
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(
    String(value)
      .replace(/[^\d,-]/g, "")
      .replace(",", ".")
  ) || 0;
}

function today() {
  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function formatDate(value) {
  if (!value) return "-";

  try {
    const d = new Date(value);

    if (isNaN(d.getTime())) {
      return String(value);
    }

    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch (e) {
    return String(value);
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   TOAST
   ========================================================= */

function toast(message, type = "success") {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.className = "toast " + type;

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 3000);
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(text = "Menyiapkan CatatKu...") {
  const loading = $("loading");

  if (!loading) return;

  const title = loading.querySelector(".loading-title");

  if (title) {
    title.textContent = text;
  }

  loading.style.display = "flex";
}

function hideLoading() {
  const loading = $("loading");

  if (!loading) return;

  loading.style.display = "none";
}


/* =========================================================
   ONLINE / OFFLINE
   ========================================================= */

function updateOnlineStatus() {
  const online = navigator.onLine;

  const dot = $("onlineDot");
  const text = $("onlineText");

  if (dot) {
    dot.classList.toggle("online", online);
    dot.classList.toggle("offline", !online);
  }

  if (text) {
    text.textContent = online ? "Online" : "Offline";
  }

  if (!online) {
    setSyncText("Mode offline");
  }
}

window.addEventListener("online", () => {
  updateOnlineStatus();

  setTimeout(() => {
    syncOffline();
  }, 500);
});

window.addEventListener("offline", () => {
  updateOnlineStatus();
  setSyncText("Mode offline");
});


/* =========================================================
   SYNC TEXT
   ========================================================= */

function setSyncText(text) {
  const el = $("syncText");

  if (el) {
    el.textContent = text;
  }
}

function updateSyncBadge() {
  const badge = $("syncBadge");

  if (!badge) return;

  const count = offlineQueue.length;

  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.textContent = "0";
    badge.classList.add("hidden");
  }
}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function loadLocalQueue() {
  try {
    offlineQueue =
      JSON.parse(localStorage.getItem("catatku_queue") || "[]");

    if (!Array.isArray(offlineQueue)) {
      offlineQueue = [];
    }
  } catch (e) {
    offlineQueue = [];
  }

  updateSyncBadge();
}

function saveLocalQueue() {
  localStorage.setItem(
    "catatku_queue",
    JSON.stringify(offlineQueue)
  );

  updateSyncBadge();
}

function queueOffline(action, data) {
  offlineQueue.push({
    id:
      Date.now() +
      "_" +
      Math.random().toString(36).substring(2, 8),

    action,
    data,

    createdAt: new Date().toISOString()
  });

  saveLocalQueue();

  setSyncText(
    offlineQueue.length +
      " data menunggu sinkronisasi"
  );
}


/* =========================================================
   FETCH GAS
   ========================================================= */

async function gasGet(action, params = {}) {
  const url = new URL(GAS_URL);

  url.searchParams.set("action", action);

  Object.keys(params).forEach(key => {
    if (
      params[key] !== undefined &&
      params[key] !== null
    ) {
      url.searchParams.set(key, params[key]);
    }
  });

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(
        "HTTP " + response.status
      );
    }

    const text = await response.text();

    if (!text) {
      throw new Error("Response GAS kosong");
    }

    let json;

    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(
        "Response GAS bukan JSON"
      );
    }

    if (
      json &&
      json.success === false
    ) {
      throw new Error(
        json.error || "GAS Error"
      );
    }

    return json;
  } catch (error) {
    clearTimeout(timeout);

    throw error;
  }
}


/* =========================================================
   FETCH POST GAS
   ========================================================= */

async function gasPost(action, data = {}) {
  const payload = {
    action,
    ...data
  };

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",

      headers: {
        "Content-Type":
          "text/plain;charset=utf-8"
      },

      body: JSON.stringify(payload),

      cache: "no-store",

      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(
        "HTTP " + response.status
      );
    }

    const text = await response.text();

    if (!text) {
      throw new Error("Response kosong");
    }

    let json;

    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(
        "Response GAS bukan JSON"
      );
    }

    if (
      json &&
      json.success === false
    ) {
      throw new Error(
        json.error || "GAS Error"
      );
    }

    return json;
  } catch (error) {
    clearTimeout(timeout);

    throw error;
  }
}


/* =========================================================
   LOAD SEMUA DATA
   ========================================================= */

async function loadAppData(showLoader = true) {
  if (showLoader) {
    showLoading("Mengambil data CatatKu...");
  }

  try {
    /*
      Prioritas action appData.
      Ini paling ringan karena seluruh data
      dikirim dalam satu request.
    */

    const result =
      await gasGet("appData");

    if (result) {
      normalizeAppData(result);
    }

    renderAll();

    setSyncText(
      offlineQueue.length > 0
        ? offlineQueue.length +
          " data menunggu sinkronisasi"
        : "Data tersimpan otomatis"
    );

    return true;

  } catch (error) {
    console.error(
      "Gagal mengambil data:",
      error
    );

    /*
      Jangan biarkan loading berputar terus.
    */

    if (
      Object.keys(appData.dashboard).length === 0 &&
      appData.barang.length === 0
    ) {
      toast(
        "Data belum dapat diambil. Periksa koneksi GAS.",
        "error"
      );
    }

    setSyncText(
      navigator.onLine
        ? "Gagal mengambil data"
        : "Mode offline"
    );

    return false;

  } finally {
    hideLoading();
  }
}


/* =========================================================
   NORMALISASI DATA
   ========================================================= */

function normalizeAppData(data) {
  /*
    Mendukung beberapa bentuk response GAS.
  */

  if (data.data && typeof data.data === "object") {
    data = data.data;
  }

  appData.dashboard =
    data.dashboard ||
    {};

  appData.barang =
    Array.isArray(data.barang)
      ? data.barang
      : [];

  appData.history =
    Array.isArray(data.history)
      ? data.history
      : [];

  appData.hutang =
    Array.isArray(data.hutang)
      ? data.hutang
      : [];

  appData.kategori =
    Array.isArray(data.kategori)
      ? data.kategori
      : [];

  appData.report =
    data.report || null;
}


/* =========================================================
   RENDER SEMUA
   ========================================================= */

function renderAll() {
  renderDashboard();

  renderBarang();

  renderBarangSelects();

  renderHistory();

  renderHutang();

  renderKategori();

  updateTransactionForm();

  updateSaleTotal();

  updateBuyTotal();
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
  const d = appData.dashboard || {};

  setText(
    "saldo",
    rupiah(
      d.saldo ??
      d.saldoSaatIni ??
      0
    )
  );

  setText(
    "totalPemasukan",
    rupiah(
      d.pemasukan ??
      d.totalPemasukan ??
      0
    )
  );

  setText(
    "totalPengeluaran",
    rupiah(
      d.pengeluaran ??
      d.totalPengeluaran ??
      0
    )
  );

  setText(
    "totalPenjualan",
    rupiah(
      d.penjualan ??
      d.totalPenjualan ??
      0
    )
  );

  setText(
    "totalHutang",
    rupiah(
      d.totalHutang ??
      d.hutang ??
      0
    )
  );

  renderRecentTransactions();
}

function setText(id, value) {
  const el = $(id);

  if (el) {
    el.textContent = value;
  }
}


/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

function renderRecentTransactions() {
  const el = $("recentTransactions");

  if (!el) return;

  const list =
    Array.isArray(appData.history)
      ? appData.history
      : [];

  if (list.length === 0) {
    el.innerHTML =
      '<div class="empty">Belum ada transaksi</div>';

    return;
  }

  const rows = list
    .slice(0, 5)
    .map(transactionHTML)
    .join("");

  el.innerHTML = rows;
}


/* =========================================================
   TRANSACTION HTML
   ========================================================= */

function transactionHTML(item) {
  const jenis =
    String(
      item.Jenis ||
      item.jenis ||
      item.type ||
      ""
    ).toUpperCase();

  const nominal =
    numberValue(
      item.Nominal ??
      item.nominal ??
      0
    );

  const kategori =
    item.Kategori ||
    item.kategori ||
    "-";

  const keterangan =
    item.Keterangan ||
    item.keterangan ||
    item.BarangNama ||
    "-";

  const tanggal =
    item.Tanggal ||
    item.tanggal ||
    item.CreatedAt ||
    item.createdAt;

  const income =
    jenis === "PEMASUKAN" ||
    jenis === "MASUK" ||
    jenis === "PENJUALAN";

  const sign =
    income ? "+" : "-";

  return `
    <div class="transaction-item">
      <div class="transaction-main">
        <div class="transaction-title">
          ${escapeHTML(keterangan)}
        </div>

        <div class="transaction-meta">
          ${escapeHTML(kategori)}
          ·
          ${escapeHTML(formatDate(tanggal))}
        </div>
      </div>

      <div class="transaction-amount ${
        income ? "income" : "expense"
      }">
        ${sign}${rupiah(nominal)}
      </div>
    </div>
  `;
}


/* =========================================================
   KATEGORI
   ========================================================= */

function renderKategori() {
  const select = $("trxKategori");

  if (!select) return;

  const current =
    select.value;

  select.innerHTML =
    '<option value="">Pilih kategori</option>';

  let categories =
    appData.kategori || [];

  /*
    Jika GAS tidak mengirim kategori,
    ambil dari history.
  */

  if (categories.length === 0) {
    const set =
      new Set();

    appData.history.forEach(item => {
      const k =
        item.Kategori ||
        item.kategori;

      if (k) {
        set.add(k);
      }
    });

    categories =
      Array.from(set);
  }

  categories.forEach(item => {
    const value =
      typeof item === "string"
        ? item
        : item.nama ||
          item.Nama ||
          item.Kategori ||
          "";

    if (!value) return;

    const option =
      document.createElement("option");

    option.value = value;
    option.textContent = value;

    select.appendChild(option);
  });

  if (current) {
    select.value = current;
  }
}


/* =========================================================
   TRANSACTION TYPE
   ========================================================= */

function setTransactionType(type) {
  currentTransactionType =
    String(type).toUpperCase();

  const income =
    $("tabIncome");

  const expense =
    $("tabExpense");

  if (income) {
    income.classList.toggle(
      "active",
      currentTransactionType ===
        "PEMASUKAN"
    );
  }

  if (expense) {
    expense.classList.toggle(
      "active",
      currentTransactionType ===
        "PENGELUARAN"
    );
  }

  updateTransactionForm();
}

function updateTransactionForm() {
  const title =
    document.querySelector(
      "#page-add .page-title h1"
    );

  const desc =
    document.querySelector(
      "#page-add .page-title p"
    );

  if (title) {
    title.textContent =
      currentTransactionType ===
      "PEMASUKAN"
        ? "Tambah Pemasukan"
        : "Tambah Pengeluaran";
  }

  if (desc) {
    desc.textContent =
      currentTransactionType ===
      "PEMASUKAN"
        ? "Catat uang masuk"
        : "Catat uang keluar";
  }
}


/* =========================================================
   QUICK TRANSACTION
   ========================================================= */

function quickTransaction(type) {
  showPage("add");

  setTransactionType(type);

  closeQuickAdd();

  setTimeout(() => {
    const input =
      $("trxNominal");

    if (input) {
      input.focus();
    }
  }, 200);
}


/* =========================================================
   SUBMIT TRANSAKSI
   ========================================================= */

async function submitTransaction(event) {
  event.preventDefault();

  const tanggal =
    $("trxTanggal")?.value ||
    today();

  const kategori =
    $("trxKategori")?.value ||
    "";

  const keterangan =
    $("trxKeterangan")?.value.trim() ||
    "";

  const nominal =
    numberValue(
      $("trxNominal")?.value
    );

  const rekening =
    $("trxRekening")?.value.trim() ||
    "Kas";

  if (!kategori) {
    toast(
      "Pilih kategori terlebih dahulu.",
      "error"
    );

    return;
  }

  if (!keterangan) {
    toast(
      "Keterangan wajib diisi.",
      "error"
    );

    return;
  }

  if (nominal <= 0) {
    toast(
      "Nominal harus lebih dari 0.",
      "error"
    );

    return;
  }

  const data = {
    ID: createID("TRX"),

    Tanggal: tanggal,

    Kategori: kategori,

    Keterangan: keterangan,

    Nominal: nominal,

    Jenis:
      currentTransactionType,

    Rekening: rekening
  };

  await saveAction(
    "tambahTransaksi",
    data,
    "Transaksi berhasil disimpan"
  );

  event.target.reset();

  $("trxTanggal").value = today();

  setTransactionType(
    currentTransactionType
  );
}


/* =========================================================
   BARANG
   ========================================================= */

function renderBarang(list = appData.barang) {
  const el = $("barangList");

  if (!el) return;

  if (!Array.isArray(list) || list.length === 0) {
    el.innerHTML =
      '<div class="empty">Belum ada barang.</div>';

    return;
  }

  el.innerHTML = list
    .map(item => {

      const id =
        item.ID ||
        item.id ||
        "";

      const nama =
        item.Nama ||
        item["Nama Barang"] ||
        item.nama ||
        "-";

      const modal =
        numberValue(
          item.Modal ??
          item["Harga Modal"] ??
          item.hargaModal
        );

      const jual =
        numberValue(
          item.Jual ??
          item["Harga Jual"] ??
          item.hargaJual
        );

      const stok =
        numberValue(
          item.Stok ??
          item.stok
        );

      const kategori =
        item.Kategori ||
        item.kategori ||
        "";

      const minimum =
        numberValue(
          item.Minimum ??
          item.minimum
        );

      return `
        <div class="product-item">

          <div class="product-info">

            <div class="product-name">
              ${escapeHTML(nama)}
            </div>

            <div class="product-meta">
              ${escapeHTML(kategori)}
            </div>

            <div class="product-price">
              Modal ${rupiah(modal)}
              · Jual ${rupiah(jual)}
            </div>

          </div>

          <div class="product-stock ${
            stok <= minimum
              ? "low-stock"
              : ""
          }">
            <strong>${stok}</strong>
            <small>stok</small>
          </div>

        </div>
      `;
    })
    .join("");
}


/* =========================================================
   BARANG SEARCH
   ========================================================= */

function filterBarang(keyword) {
  const q =
    String(keyword || "")
      .toLowerCase()
      .trim();

  if (!q) {
    renderBarang();

    return;
  }

  const result =
    appData.barang.filter(item => {

      const text =
        [
          item.ID,
          item.Nama,
          item["Nama Barang"],
          item.Kategori,
          item.Supplier
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

      return text.includes(q);
    });

  renderBarang(result);
}


/* =========================================================
   BARANG SELECT
   ========================================================= */

function renderBarangSelects() {
  const selects = [
    $("jualBarang"),
    $("belanjaBarang")
  ];

  selects.forEach(select => {

    if (!select) return;

    const current =
      select.value;

    select.innerHTML =
      '<option value="">Pilih barang</option>';

    appData.barang.forEach(item => {

      const id =
        item.ID ||
        item.id;

      const nama =
        item.Nama ||
        item["Nama Barang"] ||
        item.nama ||
        "-";

      const option =
        document.createElement("option");

      option.value = id;

      option.textContent =
        `${nama} — stok ${numberValue(
          item.Stok
        )}`;

      option.dataset.harga =
        numberValue(
          item.Jual ??
          item["Harga Jual"] ??
          item.hargaJual
        );

      option.dataset.modal =
        numberValue(
          item.Modal ??
          item["Harga Modal"] ??
          item.hargaModal
        );

      select.appendChild(option);
    });

    if (current) {
      select.value = current;
    }
  });
}


/* =========================================================
   GET BARANG
   ========================================================= */

function getBarangByID(id) {
  return appData.barang.find(item =>
    String(
      item.ID ||
      item.id
    ) === String(id)
  );
}


/* =========================================================
   AUTO HARGA PENJUALAN
   ========================================================= */

function onJualBarangChange() {
  const select =
    $("jualBarang");

  if (!select) return;

  const option =
    select.options[
      select.selectedIndex
    ];

  if (
    option &&
    option.dataset.harga
  ) {
    $("jualHarga").value =
      option.dataset.harga;
  }

  updateSaleTotal();
}


/* =========================================================
   TOTAL PENJUALAN
   ========================================================= */

function updateSaleTotal() {
  const qty =
    numberValue(
      $("jualQty")?.value
    );

  const harga =
    numberValue(
      $("jualHarga")?.value
    );

  const total =
    qty * harga;

  setText(
    "jualTotalPreview",
    rupiah(total)
  );
}


/* =========================================================
   SUBMIT PENJUALAN
   ========================================================= */

async function submitPenjualan(event) {
  event.preventDefault();

  const barangID =
    $("jualBarang")?.value;

  const barang =
    getBarangByID(barangID);

  if (!barang) {
    toast(
      "Pilih barang terlebih dahulu.",
      "error"
    );

    return;
  }

  const qty =
    numberValue(
      $("jualQty")?.value
    );

  const harga =
    numberValue(
      $("jualHarga")?.value
    );

  const pelanggan =
    $("jualPelanggan")?.value.trim() ||
    "Umum";

  if (qty <= 0) {
    toast(
      "Jumlah harus lebih dari 0.",
      "error"
    );

    return;
  }

  if (harga <= 0) {
    toast(
      "Harga jual harus lebih dari 0.",
      "error"
    );

    return;
  }

  const stok =
    numberValue(
      barang.Stok
    );

  if (qty > stok) {
    toast(
      `Stok tidak cukup. Stok tersedia ${stok}.`,
      "error"
    );

    return;
  }

  const data = {

    ID: createID("JUAL"),

    Tanggal: today(),

    Jenis: "PENJUALAN",

    Kategori:
      barang.Kategori || "Penjualan",

    Keterangan:
      "Penjualan " +
      (
        barang.Nama ||
        barang["Nama Barang"] ||
        barang.nama ||
        ""
      ),

    Nominal:
      qty * harga,

    Rekening: "Kas",

    BarangID: barangID,

    BarangNama:
      barang.Nama ||
      barang["Nama Barang"] ||
      barang.nama ||
      "",

    Qty: qty,

    Harga: harga,

    Pelanggan: pelanggan
  };

  await saveAction(
    "tambahPenjualan",
    data,
    "Penjualan berhasil disimpan"
  );

  event.target.reset();

  $("jualQty").value = 1;

  updateSaleTotal();
}


/* =========================================================
   TOTAL BELANJA
   ========================================================= */

function updateBuyTotal() {
  const qty =
    numberValue(
      $("belanjaQty")?.value
    );

  const harga =
    numberValue(
      $("belanjaHarga")?.value
    );

  setText(
    "belanjaTotalPreview",
    rupiah(qty * harga)
  );
}


/* =========================================================
   AUTO HARGA MODAL
   ========================================================= */

function onBelanjaBarangChange() {
  const select =
    $("belanjaBarang");

  if (!select) return;

  const option =
    select.options[
      select.selectedIndex
    ];

  if (
    option &&
    option.dataset.modal
  ) {
    $("belanjaHarga").value =
      option.dataset.modal;
  }

  updateBuyTotal();
}


/* =========================================================
   SUBMIT BELANJA
   ========================================================= */

async function submitBelanja(event) {
  event.preventDefault();

  const barangID =
    $("belanjaBarang")?.value;

  const barang =
    getBarangByID(barangID);

  if (!barang) {
    toast(
      "Pilih barang terlebih dahulu.",
      "error"
    );

    return;
  }

  const qty =
    numberValue(
      $("belanjaQty")?.value
    );

  const harga =
    numberValue(
      $("belanjaHarga")?.value
    );

  const supplier =
    $("belanjaSupplier")?.value.trim() ||
    "";

  if (qty <= 0) {
    toast(
      "Jumlah harus lebih dari 0.",
      "error"
    );

    return;
  }

  if (harga <= 0) {
    toast(
      "Harga modal harus lebih dari 0.",
      "error"
    );

    return;
  }

  const data = {

    ID: createID("BELI"),

    Tanggal: today(),

    Jenis: "BELANJA",

    Kategori: "Belanja Stok",

    Keterangan:
      "Belanja " +
      (
        barang.Nama ||
        barang["Nama Barang"] ||
        barang.nama ||
        ""
      ),

    Nominal:
      qty * harga,

    Rekening: "Kas",

    BarangID: barangID,

    BarangNama:
      barang.Nama ||
      barang["Nama Barang"] ||
      barang.nama ||
      "",

    Qty: qty,

    Harga: harga,

    Supplier: supplier
  };

  await saveAction(
    "tambahBelanja",
    data,
    "Belanja berhasil disimpan"
  );

  event.target.reset();

  $("belanjaQty").value = 1;

  updateBuyTotal();
}


/* =========================================================
   BARANG FORM
   ========================================================= */

async function submitBarang(event) {
  event.preventDefault();

  const nama =
    $("barangNama")?.value.trim();

  const modal =
    numberValue(
      $("barangModalPrice")?.value
    );

  const jual =
    numberValue(
      $("barangJualPrice")?.value
    );

  const stok =
    numberValue(
      $("barangStok")?.value
    );

  if (!nama) {
    toast(
      "Nama barang wajib diisi.",
      "error"
    );

    return;
  }

  const data = {

    ID: createID("BRG"),

    Nama: nama,

    Kategori: "Umum",

    Modal: modal,

    "Laba%":
      modal > 0
        ? ((jual - modal) / modal) * 100
        : 0,

    "Laba Nominal":
      jual - modal,

    Jual: jual,

    Stok: stok,

    Minimum: 0,

    Supplier: "",

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };

  await saveAction(
    "tambahBarang",
    data,
    "Barang berhasil disimpan"
  );

  closeModal("barangModal");

  event.target.reset();
}


/* =========================================================
   HUTANG
   ========================================================= */

async function submitHutang(event) {
  event.preventDefault();

  const nama =
    $("hutangNama")?.value.trim();

  const nominal =
    numberValue(
      $("hutangNominal")?.value
    );

  const tempo =
    $("hutangTempo")?.value ||
    "";

  const keterangan =
    $("hutangKeterangan")?.value.trim() ||
    "";

  if (!nama) {
    toast(
      "Nama / pihak wajib diisi.",
      "error"
    );

    return;
  }

  if (nominal <= 0) {
    toast(
      "Nominal hutang harus lebih dari 0.",
      "error"
    );

    return;
  }

  const data = {

    ID: createID("HUT"),

    CreatedAt:
      new Date().toISOString(),

    UpdatedAt:
      new Date().toISOString(),

    Entity: "HUTANG",

    Tanggal: today(),

    Jenis: "HUTANG",

    Kategori: "Hutang",

    Keterangan: keterangan,

    Nominal: nominal,

    Rekening: "Kas",

    Nama: nama,

    JatuhTempo: tempo,

    Dibayar: 0,

    Status: "BELUM LUNAS",

    status: "BELUM LUNAS"
  };

  await saveAction(
    "tambahHutang",
    data,
    "Hutang berhasil disimpan"
  );

  closeModal("hutangModal");

  event.target.reset();
}


/* =========================================================
   RENDER HUTANG
   ========================================================= */

function renderHutang() {
  const el =
    $("hutangList");

  if (!el) return;

  const list =
    appData.hutang || [];

  if (
    !Array.isArray(list) ||
    list.length === 0
  ) {
    el.innerHTML =
      '<div class="empty">Belum ada hutang.</div>';

    return;
  }

  el.innerHTML =
    list.map(item => {

      const nama =
        item.Nama ||
        item.nama ||
        "-";

      const nominal =
        numberValue(
          item.Nominal
        );

      const dibayar =
        numberValue(
          item.Dibayar
        );

      const sisa =
        Math.max(
          0,
          nominal - dibayar
        );

      const tempo =
        item.JatuhTempo ||
        item.jatuhTempo ||
        "";

      const status =
        item.Status ||
        item.status ||
        (
          sisa <= 0
            ? "LUNAS"
            : "BELUM LUNAS"
        );

      return `
        <div class="debt-item">

          <div class="debt-main">

            <strong>
              ${escapeHTML(nama)}
            </strong>

            <small>
              Jatuh tempo:
              ${escapeHTML(
                formatDate(tempo)
              )}
            </small>

          </div>

          <div class="debt-amount">

            <strong>
              ${rupiah(sisa)}
            </strong>

            <small>
              ${escapeHTML(status)}
            </small>

          </div>

        </div>
      `;

    }).join("");
}


/* =========================================================
   RIWAYAT
   ========================================================= */

function renderHistory(list = appData.history) {
  const el =
    $("historyList");

  if (!el) return;

  if (
    !Array.isArray(list) ||
    list.length === 0
  ) {
    el.innerHTML =
      '<div class="empty">Belum ada transaksi.</div>';

    return;
  }

  el.innerHTML =
    list.map(transactionHTML)
      .join("");
}


/* =========================================================
   SEARCH HISTORY
   ========================================================= */

function filterHistory(keyword) {
  const q =
    String(keyword || "")
      .toLowerCase()
      .trim();

  if (!q) {
    renderHistory();

    return;
  }

  const result =
    appData.history.filter(item => {

      const text =
        Object.values(item)
          .join(" ")
          .toLowerCase();

      return text.includes(q);
    });

  renderHistory(result);
}


/* =========================================================
   LAPORAN
   ========================================================= */

async function loadReport() {
  const start =
    $("reportStart")?.value;

  const end =
    $("reportEnd")?.value;

  if (!start || !end) {
    toast(
      "Pilih tanggal mulai dan akhir.",
      "error"
    );

    return;
  }

  if (start > end) {
    toast(
      "Tanggal mulai tidak boleh lebih besar.",
      "error"
    );

    return;
  }

  const result =
    $("reportResult");

  if (result) {
    result.innerHTML =
      "Mengambil laporan...";
  }

  try {

    const data =
      await gasGet(
        "laporan",
        {
          start,
          end
        }
      );

    renderReport(
      data
    );

  } catch (error) {

    console.error(error);

    if (result) {
      result.innerHTML =
        "Laporan gagal diambil.";
    }

    toast(
      "Gagal mengambil laporan.",
      "error"
    );
  }
}

function renderReport(data) {
  const el =
    $("reportResult");

  if (!el) return;

  const d =
    data.data ||
    data.report ||
    data;

  const pemasukan =
    numberValue(
      d.pemasukan ||
      d.totalPemasukan
    );

  const pengeluaran =
    numberValue(
      d.pengeluaran ||
      d.totalPengeluaran
    );

  const saldo =
    pemasukan -
    pengeluaran;

  el.innerHTML = `

    <div class="report-summary">

      <div>
        <small>Pemasukan</small>
        <strong>
          ${rupiah(pemasukan)}
        </strong>
      </div>

      <div>
        <small>Pengeluaran</small>
        <strong>
          ${rupiah(pengeluaran)}
        </strong>
      </div>

      <div>
        <small>Selisih</small>
        <strong>
          ${rupiah(saldo)}
        </strong>
      </div>

    </div>

  `;
}


/* =========================================================
   SAVE ACTION
   ========================================================= */

async function saveAction(
  action,
  data,
  successMessage
) {

  /*
    Jika offline:
    langsung masuk queue.
  */

  if (!navigator.onLine) {

    queueOffline(
      action,
      data
    );

    toast(
      "Disimpan offline. Akan disinkronkan saat online.",
      "success"
    );

    return true;
  }

  try {

    setSyncText(
      "Menyimpan data..."
    );

    await gasPost(
      action,
      data
    );

    toast(
      successMessage,
      "success"
    );

    setSyncText(
      "Data tersimpan otomatis"
    );

    /*
      Ambil data terbaru setelah berhasil.
    */

    await loadAppData(false);

    return true;

  } catch (error) {

    console.error(
      action,
      error
    );

    /*
      Jika server gagal,
      simpan ke offline queue.
    */

    queueOffline(
      action,
      data
    );

    toast(
      "Internet/GAS bermasalah. Data disimpan sementara.",
      "error"
    );

    return false;
  }
}


/* =========================================================
   SYNC OFFLINE
   ========================================================= */

async function syncOffline() {
  if (isSyncing) return;

  if (!navigator.onLine) {
    toast(
      "Tidak ada koneksi internet.",
      "error"
    );

    return;
  }

  if (
    !offlineQueue ||
    offlineQueue.length === 0
  ) {

    setSyncText(
      "Memeriksa data terbaru..."
    );

    await loadAppData(false);

    setSyncText(
      "Data tersimpan otomatis"
    );

    return;
  }

  isSyncing = true;

  setSyncText(
    "Sinkronisasi..."
  );

  try {

    while (
      offlineQueue.length > 0
    ) {

      const item =
        offlineQueue[0];

      await gasPost(
        item.action,
        item.data
      );

      offlineQueue.shift();

      saveLocalQueue();
    }

    toast(
      "Semua data berhasil disinkronkan.",
      "success"
    );

    setSyncText(
      "Data tersimpan otomatis"
    );

    await loadAppData(false);

  } catch (error) {

    console.error(
      "Sync error:",
      error
    );

    toast(
      "Sinkronisasi berhenti. Data yang gagal tetap tersimpan.",
      "error"
    );

    setSyncText(
      offlineQueue.length +
        " data menunggu sinkronisasi"
    );

  } finally {

    isSyncing = false;

    updateSyncBadge();
  }
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(el => {
      el.classList.remove("active");
    });

  const target =
    $("page-" + page);

  if (target) {
    target.classList.add("active");
  }

  document
    .querySelectorAll(".nav-item")
    .forEach(btn => {
      btn.classList.remove("active");
    });

  const navMap = {
    dashboard: 0,
    add: 1,
    barang: 2
  };

  if (
    navMap[page] !== undefined
  ) {

    const navItems =
      document.querySelectorAll(
        ".bottom-nav .nav-item"
      );

    if (navItems[navMap[page]]) {
      navItems[
        navMap[page]
      ].classList.add("active");
    }
  }

  closeQuickAdd();

  closeMoreMenu();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  /*
    Load tambahan bila membuka halaman laporan.
  */

  if (page === "report") {
    const start =
      $("reportStart");

    const end =
      $("reportEnd");

    if (start && !start.value) {
      start.value =
        today();
    }

    if (end && !end.value) {
      end.value =
        today();
    }
  }
}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshApp() {
  if (!navigator.onLine) {
    toast(
      "Anda sedang offline.",
      "error"
    );

    return;
  }

  showLoading(
    "Memperbarui data..."
  );

  await syncOffline();

  await loadAppData(
    false
  );

  hideLoading();
}


/* =========================================================
   QUICK ADD
   ========================================================= */

function openQuickAdd() {
  const menu =
    $("quickAddMenu");

  if (!menu) return;

  menu.classList.toggle(
    "active"
  );
}

function closeQuickAdd() {
  const menu =
    $("quickAddMenu");

  if (!menu) return;

  menu.classList.remove(
    "active"
  );
}


/* =========================================================
   MORE MENU
   ========================================================= */

function showMoreMenu() {
  const menu =
    $("moreMenu");

  if (!menu) return;

  menu.classList.remove(
    "hidden"
  );
}

function closeMoreMenu() {
  const menu =
    $("moreMenu");

  if (!menu) return;

  menu.classList.add(
    "hidden"
  );
}

function openFromMenu(page) {
  closeMoreMenu();

  showPage(page);
}


/* =========================================================
   MODAL
   ========================================================= */

function openModal(id) {
  const modal =
    $(id);

  if (!modal) return;

  modal.classList.remove(
    "hidden"
  );
}

function closeModal(id) {
  const modal =
    $(id);

  if (!modal) return;

  modal.classList.add(
    "hidden"
  );
}


/* =========================================================
   CLOSE MODAL KLIK LUAR
   ========================================================= */

document.addEventListener(
  "click",
  event => {

    document
      .querySelectorAll(".modal")
      .forEach(modal => {

        if (
          event.target === modal
        ) {
          modal.classList.add(
            "hidden"
          );
        }

      });

  }
);


/* =========================================================
   ID GENERATOR
   ========================================================= */

function createID(prefix) {

  const now =
    new Date();

  const timestamp =
    now.getTime();

  const random =
    Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();

  return (
    prefix +
    "-" +
    timestamp +
    "-" +
    random
  );
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function bindEvents() {

  /*
    Transaksi
  */

  const trxForm =
    $("transactionForm");

  if (trxForm) {
    trxForm.addEventListener(
      "submit",
      submitTransaction
    );
  }


  /*
    Barang
  */

  const barangForm =
    $("barangForm");

  if (barangForm) {
    barangForm.addEventListener(
      "submit",
      submitBarang
    );
  }


  /*
    Penjualan
  */

  const penjualanForm =
    $("penjualanForm");

  if (penjualanForm) {
    penjualanForm.addEventListener(
      "submit",
      submitPenjualan
    );
  }


  /*
    Belanja
  */

  const belanjaForm =
    $("belanjaForm");

  if (belanjaForm) {
    belanjaForm.addEventListener(
      "submit",
      submitBelanja
    );
  }


  /*
    Hutang
  */

  const hutangForm =
    $("hutangForm");

  if (hutangForm) {
    hutangForm.addEventListener(
      "submit",
      submitHutang
    );
  }


  /*
    Tanggal transaksi default
  */

  const trxTanggal =
    $("trxTanggal");

  if (trxTanggal) {
    trxTanggal.value =
      today();
  }


  /*
    Barang penjualan
  */

  const jualBarang =
    $("jualBarang");

  if (jualBarang) {
    jualBarang.addEventListener(
      "change",
      onJualBarangChange
    );
  }


  /*
    Qty / harga penjualan
  */

  ["jualQty", "jualHarga"]
    .forEach(id => {

      const el = $(id);

      if (el) {
        el.addEventListener(
          "input",
          updateSaleTotal
        );
      }

    });


  /*
    Barang belanja
  */

  const belanjaBarang =
    $("belanjaBarang");

  if (belanjaBarang) {
    belanjaBarang.addEventListener(
      "change",
      onBelanjaBarangChange
    );
  }


  /*
    Qty / harga belanja
  */

  ["belanjaQty", "belanjaHarga"]
    .forEach(id => {

      const el = $(id);

      if (el) {
        el.addEventListener(
          "input",
          updateBuyTotal
        );
      }

    });


  /*
    Escape untuk modal/menu
  */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        document
          .querySelectorAll(".modal")
          .forEach(modal => {
            modal.classList.add(
              "hidden"
            );
          });

        closeMoreMenu();

        closeQuickAdd();
      }

    }
  );
}


/* =========================================================
   INIT
   ========================================================= */

async function initApp() {

  console.log(
    APP_NAME +
      " mulai..."
  );

  loadLocalQueue();

  updateOnlineStatus();

  bindEvents();

  /*
    Jangan biarkan halaman stuck
    jika GAS bermasalah.
  */

  const maxLoading =
    setTimeout(() => {
      hideLoading();
    }, 16000);

  try {

    await loadAppData(
      true
    );

  } finally {

    clearTimeout(
      maxLoading
    );

    hideLoading();
  }

  /*
    Sinkronkan queue setelah
    aplikasi siap.
  */

  if (
    navigator.onLine &&
    offlineQueue.length > 0
  ) {

    setTimeout(() => {
      syncOffline();
    }, 1000);

  }

  console.log(
    APP_NAME +
      " siap."
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
    () => {

      navigator.serviceWorker
        .register("./sw.js")
        .then(reg => {

          console.log(
            "Service Worker aktif:",
            reg.scope
          );

        })
        .catch(error => {

          console.warn(
            "Service Worker gagal:",
            error
          );

        });

    }
  );

}


/* =========================================================
   START APP
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initApp
  );

} else {

  initApp();

}


/* =========================================================
   GLOBAL EXPORT
   Agar onclick="" di index.html
   tetap dapat memanggil fungsi.
   ========================================================= */

window.showPage =
  showPage;

window.setTransactionType =
  setTransactionType;

window.quickTransaction =
  quickTransaction;

window.refreshApp =
  refreshApp;

window.syncOffline =
  syncOffline;

window.openQuickAdd =
  openQuickAdd;

window.closeQuickAdd =
  closeQuickAdd;

window.showMoreMenu =
  showMoreMenu;

window.closeMoreMenu =
  closeMoreMenu;

window.openFromMenu =
  openFromMenu;

window.openModal =
  openModal;

window.closeModal =
  closeModal;

window.filterBarang =
  filterBarang;

window.filterHistory =
  filterHistory;

window.loadReport =
  loadReport;
