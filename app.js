/* =========================================================
   CATATKU
   app.js - Frontend PWA + Google Apps Script
   ========================================================= */

"use strict";

/* =========================================================
   KONFIGURASI GAS & INDEXED DB
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxrgQIppwaphvBIQjMbV6e5EO18C6O066k0jbBvRWPCKKV1rp9A7TQhZfM9_I01lL6a/exec";

const API_KEY = "CATATKU-2026-PRIBADI";

const DB_NAME = "CatatKuDB";
const DB_VERSION = 2; // Dinaikkan ke v2 agar pemicu store baru/perbaikan berjalan
const QUEUE_STORE = "syncQueue";
const CACHE_STORE = "appCache";

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

let transactionType = "PEMASUKAN";
let db = null;
let currentBarangList = [];
let currentHistoryList = [];
let syncRunning = false;
let toastTimer = null;

/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
  console.log("CatatKu mulai...");

  initDates();
  initEvents();
  updateOnlineStatus();

  window.addEventListener("online", function () {
    updateOnlineStatus();
    setSyncText("Online — sinkronisasi...");
    syncOffline();
  });

  window.addEventListener("offline", function () {
    updateOnlineStatus();
    setSyncText("Offline — data akan disimpan di perangkat");
  });

  try {
    await openDatabase();
    await loadLocalCache();
    await updateSyncBadge();

    if (navigator.onLine) {
      await loadAppData();
    } else {
      setSyncText("Offline — menggunakan data tersimpan");
    }
  } catch (error) {
    console.error("Startup error:", error);
    setSyncText("Mode offline");
    showToast("Aplikasi dibuka dalam mode offline");
  } finally {
    hideLoading();
  }
});

/* =========================================================
   INITIAL EVENTS
   ========================================================= */

function initEvents() {
  const transactionForm = document.getElementById("transactionForm");
  if (transactionForm) transactionForm.addEventListener("submit", submitTransaction);

  const barangForm = document.getElementById("barangForm");
  if (barangForm) barangForm.addEventListener("submit", submitBarang);

  const penjualanForm = document.getElementById("penjualanForm");
  if (penjualanForm) penjualanForm.addEventListener("submit", submitPenjualan);

  const belanjaForm = document.getElementById("belanjaForm");
  if (belanjaForm) belanjaForm.addEventListener("submit", submitBelanja);

  const hutangForm = document.getElementById("hutangForm");
  if (hutangForm) hutangForm.addEventListener("submit", submitHutang);

  const jualQty = document.getElementById("jualQty");
  const jualHarga = document.getElementById("jualHarga");
  if (jualQty) jualQty.addEventListener("input", updateJualTotal);
  if (jualHarga) jualHarga.addEventListener("input", updateJualTotal);

  const belanjaQty = document.getElementById("belanjaQty");
  const belanjaHarga = document.getElementById("belanjaHarga");
  if (belanjaQty) belanjaQty.addEventListener("input", updateBelanjaTotal);
  if (belanjaHarga) belanjaHarga.addEventListener("input", updateBelanjaTotal);

  const jualBarang = document.getElementById("jualBarang");
  if (jualBarang) jualBarang.addEventListener("change", autoHargaJual);

  const belanjaBarang = document.getElementById("belanjaBarang");
  if (belanjaBarang) belanjaBarang.addEventListener("change", autoHargaModal);

  const searchBarang = document.getElementById("searchBarang");
  if (searchBarang) {
    searchBarang.addEventListener("input", function (e) {
      filterBarang(e.target.value);
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeModal("barangModal");
      closeModal("hutangModal");
      closeMoreMenu();
      closeQuickAdd();
    }
  });
}

/* =========================================================
   DATE HELPERS
   ========================================================= */

function initDates() {
  const today = getLocalDate();
  const trxTanggal = document.getElementById("trxTanggal");
  if (trxTanggal && !trxTanggal.value) trxTanggal.value = today;

  const reportStart = document.getElementById("reportStart");
  const reportEnd = document.getElementById("reportEnd");
  if (reportEnd && !reportEnd.value) reportEnd.value = today;

  if (reportStart && !reportStart.value) {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    reportStart.value = formatDateInput(date);
  }
}

function getLocalDate() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function formatDateInput(date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

/* =========================================================
   INDEXED DB CORE
   ========================================================= */

function openDatabase() {
  return new Promise(function (resolve, reject) {
    if (db) {
      resolve(db);
      return;
    }

    if (!window.indexedDB) {
      reject(new Error("IndexedDB tidak tersedia"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (event) {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true
        });
      }

      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.createObjectStore(CACHE_STORE, {
          keyPath: "key"
        });
      }
    };

    request.onsuccess = function (event) {
      db = event.target.result;
      console.log("IndexedDB aktif v" + db.version);
      resolve(db);
    };

    request.onerror = function () {
      reject(request.error || new Error("Gagal membuka IndexedDB"));
    };
  });
}

async function saveCache(key, value) {
  if (!db) await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = db.transaction(CACHE_STORE, "readwrite");
    const store = transaction.objectStore(CACHE_STORE);
    store.put({ key: key, value: value, savedAt: Date.now() });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getCache(key) {
  if (!db) {
    try { await openDatabase(); } catch (e) { return null; }
  }
  return new Promise(function (resolve) {
    const transaction = db.transaction(CACHE_STORE, "readonly");
    const store = transaction.objectStore(CACHE_STORE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => resolve(null);
  });
}

async function loadLocalCache() {
  try {
    const cached = await getCache("appData");
    if (!cached) return;
    appData = normalizeAppData(cached);
    renderAll();
    console.log("Data lokal dimuat");
  } catch (error) {
    console.warn("Cache error:", error);
  }
}

/* =========================================================
   OFFLINE QUEUE & SYNC
   ========================================================= */

async function addToQueue(action, payload) {
  if (!db) await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = db.transaction(QUEUE_STORE, "readwrite");
    const store = transaction.objectStore(QUEUE_STORE);
    store.add({ action: action, payload: payload, createdAt: Date.now() });

    transaction.oncomplete = async function () {
      await updateSyncBadge();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getQueue() {
  if (!db) await openDatabase();
  return new Promise(function (resolve) {
    const transaction = db.transaction(QUEUE_STORE, "readonly");
    const store = transaction.objectStore(QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

async function removeFromQueue(id) {
  if (!db) await openDatabase();
  return new Promise(function (resolve) {
    const transaction = db.transaction(QUEUE_STORE, "readwrite");
    const store = transaction.objectStore(QUEUE_STORE);
    store.delete(id);

    transaction.oncomplete = async function () {
      await updateSyncBadge();
      resolve();
    };
    transaction.onerror = () => resolve();
  });
}

async function updateSyncBadge() {
  const queue = await getQueue();
  const badge = document.getElementById("syncBadge");
  if (badge) {
    if (queue.length > 0) {
      badge.textContent = queue.length;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }
}

async function saveOrQueue(action, payload) {
  if (navigator.onLine) {
    try {
      const res = await gasRequest(action, payload);
      showToast("✅ Berhasil disimpan");
      await loadAppData();
      return res;
    } catch (err) {
      console.warn("Gagal simpan online, mengalihkan ke antrean offline:", err);
      await addToQueue(action, payload);
      showToast("⚠️ Disimpan offline (akan disinkronkan)");
      return { success: true, offline: true };
    }
  } else {
    await addToQueue(action, payload);
    showToast("📁 Disimpan di perangkat (Offline)");
    return { success: true, offline: true };
  }
}

async function syncOffline() {
  if (syncRunning || !navigator.onLine) return;
  syncRunning = true;

  try {
    const queue = await getQueue();
    if (!queue.length) {
      setSyncText("Online — Data Terkini");
      syncRunning = false;
      return;
    }

    setSyncText(`Menyinkronkan ${queue.length} data...`);

    for (const item of queue) {
      try {
        await gasRequest(item.action, item.payload);
        await removeFromQueue(item.id);
      } catch (err) {
        console.error("Gagal sinkron item ID " + item.id, err);
        break; 
      }
    }

    await loadAppData();
    showToast("🔄 Sinkronisasi selesai");
  } catch (err) {
    console.error("Sync error:", err);
  } finally {
    syncRunning = false;
  }
}

/* =========================================================
   GAS REQUEST & DATA NORMALIZATION
   ========================================================= */

function normalizeAppData(data) {
  data = data || {};
  return {
    dashboard: data.dashboard || {},
    kategori: Array.isArray(data.kategori) ? data.kategori : [],
    barang: Array.isArray(data.barang) ? data.barang : [],
    history: Array.isArray(data.history) ? data.history : [],
    hutang: Array.isArray(data.hutang) ? data.hutang : [],
    laporan: data.laporan || {}
  };
}

async function gasRequest(action, params = {}, method = "GET") {
  const data = { action: action, key: API_KEY, ...params };
  let url = GAS_URL;
  const query = new URLSearchParams();

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined && data[key] !== null) {
      query.append(key, String(data[key]));
    }
  });

  url += "?" + query.toString();

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("HTTP " + response.status + " " + response.statusText);
  }

  const text = await response.text();
  if (!text) throw new Error("GAS tidak mengirim response");

  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    throw new Error("Response GAS bukan JSON");
  }

  if (result && result.success === false) {
    throw new Error(result.error || result.message || "GAS mengembalikan error");
  }

  return result;
}

async function loadAppData() {
  if (!navigator.onLine) return;
  setSyncText("Mengambil data...");

  try {
    const result = await gasRequest("appData");
    const data = result.data || result;

    appData = normalizeAppData(data);
    await saveCache("appData", appData);
    renderAll();
    setSyncText("Data tersinkron");
    await updateSyncBadge();
  } catch (error) {
    console.error("loadAppData error:", error);
    setSyncText("Gagal terhubung — data lokal digunakan");
  }
}

/* =========================================================
   RENDER ALL & MODULE RENDERS
   ========================================================= */

function renderAll() {
  renderDashboard();
  renderKategori();
  renderBarang();
  renderBarangSelects();
  renderHistory();
  renderHutang();
}

function renderDashboard() {
  const d = appData.dashboard || {};
  setText("saldo", rupiah(numberValue(d.saldo)));
  setText("totalPemasukan", rupiah(numberValue(d.pemasukan)));
  setText("totalPengeluaran", rupiah(numberValue(d.pengeluaran)));
  setText("totalPenjualan", rupiah(numberValue(d.penjualan || d.totalPenjualan || d.pemasukanToko)));
  setText("totalHutang", rupiah(numberValue(d.totalHutang)));
  renderRecentTransactions();
}

function renderRecentTransactions() {
  const container = document.getElementById("recentTransactions");
  if (!container) return;

  const list = Array.isArray(appData.history) ? appData.history : [];
  if (!list.length) {
    container.innerHTML = `<div class="empty">Belum ada transaksi</div>`;
    return;
  }

  container.innerHTML = list.slice(0, 5).map(transactionHTML).join("");
}

function renderKategori() {
  const select = document.getElementById("trxKategori");
  if (!select) return;

  const oldValue = select.value;
  let html = `<option value="">Pilih kategori</option>`;
  const categories = Array.isArray(appData.kategori) ? appData.kategori : [];

  categories.forEach(item => {
    let nama = typeof item === "string" ? item : (item.nama || item.kategori || item.name || "");
    let jenis = typeof item === "object" ? String(item.jenis || item.type || "").toUpperCase() : "";

    if (!nama) return;
    if (jenis && jenis !== transactionType && jenis !== "SEMUA") return;

    html += `<option value="${escapeAttr(nama)}">${escapeHTML(nama)}</option>`;
  });

  select.innerHTML = html;
  if (oldValue) select.value = oldValue;
}

function setTransactionType(type) {
  transactionType = String(type || "PEMASUKAN").toUpperCase();
  const income = document.getElementById("tabIncome");
  const expense = document.getElementById("tabExpense");

  if (income) income.classList.toggle("active", transactionType === "PEMASUKAN");
  if (expense) expense.classList.toggle("active", transactionType === "PENGELUARAN");

  renderKategori();
}

function quickTransaction(type) {
  closeQuickAdd();
  showPage("add");
  setTransactionType(type);
  const field = document.getElementById("trxKeterangan");
  if (field) setTimeout(() => field.focus(), 150);
}

/* =========================================================
   BARANG MODULE
   ========================================================= */

function renderBarang() {
  const container = document.getElementById("barangList");
  if (!container) return;

  currentBarangList = Array.isArray(appData.barang) ? appData.barang : [];

  if (!currentBarangList.length) {
    container.innerHTML = `<div class="empty">Belum ada barang.<br><br>Tekan "+ Tambah Barang".</div>`;
    return;
  }

  container.innerHTML = currentBarangList.map(barangHTML).join("");
}

function barangHTML(item) {
  const nama = item.nama || item.Nama || item.name || "Barang";
  const stok = numberValue(item.stok || item.Stok);
  const modal = numberValue(item.hargaModal || item.modal || item.harga_modal || item.HargaModal);
  const jual = numberValue(item.hargaJual || item.jual || item.harga_jual || item.HargaJual);

  return `
    <div class="form-card" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div style="min-width:0;">
        <strong style="font-size:15px; display:block;">${escapeHTML(nama)}</strong>
        <div class="small" style="margin-top:5px;">Stok: <strong>${formatNumber(stok)}</strong></div>
        <div class="small" style="margin-top:3px;">Modal: <strong>${rupiah(modal)}</strong></div>
      </div>
      <div style="text-align:right;">
        <div class="small">Harga Jual</div>
        <strong style="display:block; color:#2563eb; margin-top:4px;">${rupiah(jual)}</strong>
      </div>
    </div>
  `;
}

function filterBarang(keyword) {
  const term = String(keyword || "").toLowerCase().trim();
  const filtered = currentBarangList.filter(item => {
    const nama = String(item.nama || item.Nama || item.name || "").toLowerCase();
    return nama.includes(term);
  });

  const container = document.getElementById("barangList");
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty">Barang tidak ditemukan.</div>`;
    return;
  }

  container.innerHTML = filtered.map(barangHTML).join("");
}

function renderBarangSelects() {
  const jual = document.getElementById("jualBarang");
  const belanja = document.getElementById("belanjaBarang");
  const list = Array.isArray(appData.barang) ? appData.barang : [];

  const populateSelect = (selectEl) => {
    if (!selectEl) return;
    const old = selectEl.value;
    let html = `<option value="">Pilih barang</option>`;
    list.forEach((item, index) => {
      const id = item.id || item.ID || item.kode || index;
      const nama = item.nama || item.Nama || item.name || "Barang";
      html += `<option value="${escapeAttr(id)}">${escapeHTML(nama)}</option>`;
    });
    selectEl.innerHTML = html;
    if (old) selectEl.value = old;
  };

  populateSelect(jual);
  populateSelect(belanja);
}

function findBarang(id) {
  return appData.barang.find((item, index) => {
    const itemId = item.id || item.ID || item.kode || index;
    return String(itemId) === String(id);
  });
}

function autoHargaJual() {
  const id = valueOf("jualBarang");
  const barang = findBarang(id);
  if (!barang) return;

  const harga = numberValue(barang.hargaJual || barang.jual || barang.harga_jual || barang.HargaJual);
  const input = document.getElementById("jualHarga");
  if (input && harga > 0) input.value = harga;
  updateJualTotal();
}

function autoHargaModal() {
  const id = valueOf("belanjaBarang");
  const barang = findBarang(id);
  if (!barang) return;

  const harga = numberValue(barang.hargaModal || barang.modal || barang.harga_modal || barang.HargaModal);
  const input = document.getElementById("belanjaHarga");
  if (input && harga > 0) input.value = harga;
  updateBelanjaTotal();
}

function updateJualTotal() {
  const qty = numberValue(valueOf("jualQty"));
  const harga = numberValue(valueOf("jualHarga"));
  setText("jualTotalPreview", rupiah(qty * harga));
}

function updateBelanjaTotal() {
  const qty = numberValue(valueOf("belanjaQty"));
  const harga = numberValue(valueOf("belanjaHarga"));
  setText("belanjaTotalPreview", rupiah(qty * harga));
}

/* =========================================================
   HISTORY & HUTANG MODULE
   ========================================================= */

function renderHistory() {
  const container = document.getElementById("historyList");
  if (!container) return;

  currentHistoryList = Array.isArray(appData.history) ? appData.history : [];
  if (!currentHistoryList.length) {
    container.innerHTML = `<div class="empty">Belum ada histori transaksi.</div>`;
    return;
  }

  container.innerHTML = currentHistoryList.map(transactionHTML).join("");
}

function transactionHTML(item) {
  const jenis = String(item.jenis || item.type || "PEMASUKAN").toUpperCase();
  const isIncome = jenis === "PEMASUKAN" || jenis === "PENJUALAN";
  const nominal = numberValue(item.nominal || item.total || item.jumlah);

  return `
    <div class="form-card" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <div>
        <strong>${escapeHTML(item.keterangan || item.kategori || "Transaksi")}</strong>
        <div class="small" style="color:#666; margin-top:3px;">${escapeHTML(item.tanggal || "")} — ${escapeHTML(item.kategori || "")}</div>
      </div>
      <div style="text-align:right;">
        <span style="font-weight:bold; color: ${isIncome ? '#16a34a' : '#dc2626'};">
          ${isIncome ? '+' : '-'} ${rupiah(nominal)}
        </span>
      </div>
    </div>
  `;
}

function renderHutang() {
  const container = document.getElementById("hutangList");
  if (!container) return;

  const list = Array.isArray(appData.hutang) ? appData.hutang : [];
  if (!list.length) {
    container.innerHTML = `<div class="empty">Tidak ada catatan hutang/piutang.</div>`;
    return;
  }

  container.innerHTML = list.map(item => `
    <div class="form-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong>${escapeHTML(item.nama || item.kontak || "Tanpa Nama")}</strong>
        <div class="small">${escapeHTML(item.keterangan || "")}</div>
      </div>
      <div style="text-align:right;">
        <strong style="color:#dc2626;">${rupiah(numberValue(item.nominal))}</strong>
      </div>
    </div>
  `).join("");
}

/* =========================================================
   SUBMIT HANDLERS
   ========================================================= */

async function submitTransaction(event) {
  event.preventDefault();

  const tanggal = valueOf("trxTanggal");
  const kategori = valueOf("trxKategori");
  const keterangan = valueOf("trxKeterangan");
  const nominal = numberValue(valueOf("trxNominal"));
  const rekening = valueOf("trxRekening") || "Kas";

  if (!tanggal || !kategori || !keterangan || nominal <= 0) {
    showToast("Isi semua data transaksi dengan benar");
    return;
  }

  const payload = { tanggal, jenis: transactionType, kategori, keterangan, nominal, rekening };
  const button = event.submitter || event.target.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = true;
    button.dataset.oldText = button.textContent;
    button.textContent = "Menyimpan...";
  }

  try {
    await saveOrQueue("tambahTransaksi", payload);
    event.target.reset();
    const dateInput = document.getElementById("trxTanggal");
    if (dateInput) dateInput.value = getLocalDate();
    setTransactionType(transactionType);
  } catch (err) {
    showToast("❌ " + (err.message || "Gagal menyimpan"));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.oldText || "Simpan";
    }
  }
}

async function submitBarang(event) {
  event.preventDefault();

  const nama = valueOf("barangNama");
  const modal = numberValue(valueOf("barangHargaModal"));
  const jual = numberValue(valueOf("barangHargaJual"));
  const stok = numberValue(valueOf("barangStokAwal"));

  if (!nama) {
    showToast("Nama barang harus diisi");
    return;
  }

  const payload = { nama, hargaModal: modal, hargaJual: jual, stok };
  const button = event.submitter || event.target.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = true;
    button.dataset.oldText = button.textContent;
    button.textContent = "Menyimpan...";
  }

  try {
    await saveOrQueue("tambahBarang", payload);
    event.target.reset();
    closeModal("barangModal");
  } catch (err) {
    showToast("❌ " + (err.message || "Gagal menambah barang"));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.oldText || "Simpan Barang";
    }
  }
}

async function submitPenjualan(event) {
  event.preventDefault();

  const barang = valueOf("jualBarang");
  const qty = numberValue(valueOf("jualQty"));
  const harga = numberValue(valueOf("jualHarga"));
  const pelanggan = valueOf("jualPelanggan") || "Umum";

  if (!barang || qty <= 0 || harga <= 0) {
    showToast("Lengkapi data penjualan");
    return;
  }

  const payload = {
    tanggal: getLocalDate(),
    barangId: barang,
    idBarang: barang,
    qty: qty,
    jumlah: qty,
    harga: harga,
    hargaJual: harga,
    total: qty * harga,
    pelanggan: pelanggan
  };

  const button = event.submitter || event.target.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.dataset.oldText = button.textContent;
    button.textContent = "Menyimpan...";
  }

  try {
    await saveOrQueue("tambahPenjualan", payload);
    event.target.reset();
    setText("jualTotalPreview", "Rp 0");
  } catch (error) {
    console.error("submitPenjualan:", error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.oldText || "Simpan";
    }
  }
}

async function submitBelanja(event) {
  event.preventDefault();

  const barang = valueOf("belanjaBarang");
  const qty = numberValue(valueOf("belanjaQty"));
  const harga = numberValue(valueOf("belanjaHarga"));
  const supplier = valueOf("belanjaSupplier") || "";

  if (!barang || qty <= 0 || harga <= 0) {
    showToast("Lengkapi data belanja");
    return;
  }

  const payload = {
    tanggal: getLocalDate(),
    barangId: barang,
    idBarang: barang,
    qty: qty,
    jumlah: qty,
    harga: harga,
    hargaModal: harga,
    total: qty * harga,
    supplier: supplier
  };

  const button = event.submitter || event.target.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.dataset.oldText = button.textContent;
    button.textContent = "Menyimpan...";
  }

  try {
    await saveOrQueue("tambahBelanja", payload);
    event.target.reset();
    setText("belanjaTotalPreview", "Rp 0");
  } catch (error) {
    console.error("submitBelanja:", error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.oldText || "Simpan";
    }
  }
}

async function submitHutang(event) {
  event.preventDefault();

  const nama = valueOf("hutangNama");
  const nominal = numberValue(valueOf("hutangNominal"));
  const keterangan = valueOf("hutangKeterangan");

  if (!nama || nominal <= 0) {
    showToast("Lengkapi data hutang/piutang");
    return;
  }

  const payload = { nama, nominal, keterangan, tanggal: getLocalDate() };
  const button = event.submitter || event.target.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = true;
    button.dataset.oldText = button.textContent;
    button.textContent = "Menyimpan...";
  }

  try {
    await saveOrQueue("tambahHutang", payload);
    event.target.reset();
    closeModal("hutangModal");
  } catch (err) {
    showToast("❌ " + (err.message || "Gagal menyimpan hutang"));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.oldText || "Simpan";
    }
  }
}

/* =========================================================
   UI HELPERS & UTILITIES
   ========================================================= */

function showPage(pageId) {
  const pages = document.querySelectorAll(".page");
  pages.forEach(p => p.classList.remove("active"));

  const targetPage = document.getElementById(pageId + "Page");
  if (targetPage) targetPage.classList.add("active");

  const navs = document.querySelectorAll(".nav-item");
  navs.forEach(n => n.classList.remove("active"));

  const targetNav = document.querySelector(`.nav-item[onclick*="${pageId}"]`);
  if (targetNav) targetNav.classList.add("active");

  window.scrollTo(0, 0);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "flex";
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}

function toggleMoreMenu() {
  const menu = document.getElementById("moreMenu");
  if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function closeMoreMenu() {
  const menu = document.getElementById("moreMenu");
  if (menu) menu.style.display = "none";
}

function toggleQuickAdd() {
  const menu = document.getElementById("quickAddMenu");
  if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function closeQuickAdd() {
  const menu = document.getElementById("quickAddMenu");
  if (menu) menu.style.display = "none";
}

function updateOnlineStatus() {
  const statusEl = document.getElementById("onlineStatus");
  if (!statusEl) return;

  if (navigator.onLine) {
    statusEl.textContent = "Online";
    statusEl.className = "status-badge online";
  } else {
    statusEl.textContent = "Offline";
    statusEl.className = "status-badge offline";
  }
}

function setSyncText(text) {
  const el = document.getElementById("syncStatusText");
  if (el) el.textContent = text;
}

function hideLoading() {
  const loader = document.getElementById("appLoader");
  if (loader) loader.style.display = "none";
}

function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function valueOf(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function numberValue(val) {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function rupiah(num) {
  return "Rp " + numberValue(num).toLocaleString("id-ID");
}

function formatNumber(num) {
  return numberValue(num).toLocaleString("id-ID");
}

function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(str) {
  return String(str || "")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
