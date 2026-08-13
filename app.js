/* =====================================================
   CATATKU STATE & INITIALIZATION
===================================================== */
const KATEGORI_PEMASUKAN = ["Penjualan Toko", "Gaji/Komisi", "Investasi", "Lainnya"];
const KATEGORI_PENGELUARAN = ["Belanja Stok", "Operasional", "Makan & Minum", "Tagihan & Listrik", "Lainnya"];

let appData = {
  transaksi: [],
  barang: [],
  hutang: [],
  currentType: "PEMASUKAN"
};

// Load initial data from localStorage
function initApp() {
  const saved = localStorage.getItem("catatku_data");
  if (saved) {
    try {
      appData = { ...appData, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Gagal membaca data lokal", e);
    }
  }

  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  const elTrxDate = document.getElementById("trxTanggal");
  if (elTrxDate) elTrxDate.value = today;

  renderCategories();
  updateDashboard();
  renderBarangList();
  renderHutangList();
  renderHistoryList();
  updateBarangSelects();

  // Hide loading overlay
  setTimeout(() => {
    const loading = document.getElementById("loading");
    if (loading) loading.classList.add("hidden");
  }, 400);
}

function saveData() {
  localStorage.setItem("catatku_data", JSON.stringify(appData));
  updateDashboard();
  renderBarangList();
  renderHutangList();
  renderHistoryList();
  updateBarangSelects();
}

// Format Rupiah
function rupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(number || 0);
}

// Toast notification
function showToast(message) {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }
}

// Page Navigation
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  
  const navMap = {
    'dashboard': 0,
    'add': 1,
    'barang': 3
  };
  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  if (navMap[pageId] !== undefined && navItems[navMap[pageId]]) {
    navItems[navMap[pageId]].classList.add("active");
  }

  window.scrollTo(0, 0);
}

function refreshApp() {
  initApp();
  showToast("Aplikasi diperbarui");
}

function syncOffline() {
  showToast("Data tersimpan di perangkat!");
}

/* =====================================================
   TRANSACTIONS
===================================================== */
function setTransactionType(type) {
  appData.currentType = type;
  const tabIncome = document.getElementById("tabIncome");
  const tabExpense = document.getElementById("tabExpense");

  if (type === "PEMASUKAN") {
    tabIncome?.classList.add("active");
    tabExpense?.classList.remove("active");
  } else {
    tabExpense?.classList.add("active");
    tabIncome?.classList.remove("active");
  }
  renderCategories();
}

function renderCategories() {
  const select = document.getElementById("trxKategori");
  if (!select) return;
  const list = appData.currentType === "PEMASUKAN" ? KATEGORI_PEMASUKAN : KATEGORI_PENGELUARAN;
  
  select.innerHTML = '<option value="">Pilih kategori</option>' + 
    list.map(k => `<option value="${k}">${k}</option>`).join('');
}

function quickTransaction(type) {
  closeQuickAdd();
  setTransactionType(type);
  showPage('add');
}

document.getElementById("transactionForm")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const tanggal = document.getElementById("trxTanggal").value;
  const kategori = document.getElementById("trxKategori").value;
  const keterangan = document.getElementById("trxKeterangan").value;
  const nominal = Number(document.getElementById("trxNominal").value) || 0;
  const rekening = document.getElementById("trxRekening").value || "Kas";

  const item = {
    id: Date.now(),
    type: appData.currentType,
    tanggal,
    kategori,
    keterangan,
    nominal,
    rekening
  };

  appData.transaksi.unshift(item);
  saveData();
  showToast("Transaksi berhasil disimpan");
  this.reset();
  document.getElementById("trxTanggal").value = new Date().toISOString().split('T')[0];
  showPage("dashboard");
});

/* =====================================================
   DASHBOARD & SUMMARY
===================================================== */
function updateDashboard() {
  let pemasukan = 0;
  let pengeluaran = 0;
  let penjualan = 0;

  appData.transaksi.forEach(t => {
    if (t.type === "PEMASUKAN") {
      pemasukan += t.nominal;
      if (t.kategori === "Penjualan Toko") penjualan += t.nominal;
    } else if (t.type === "PENGELUARAN") {
      pengeluaran += t.nominal;
    }
  });

  let totalHutang = appData.hutang.reduce((acc, h) => acc + (h.nominal || 0), 0);
  let saldo = pemasukan - pengeluaran;

  document.getElementById("saldo").textContent = rupiah(saldo);
  document.getElementById("totalPemasukan").textContent = rupiah(pemasukan);
  document.getElementById("totalPengeluaran").textContent = rupiah(pengeluaran);
  document.getElementById("totalPenjualan").textContent = rupiah(penjualan);
  document.getElementById("totalHutang").textContent = rupiah(totalHutang);

  renderRecentTransactions();
}

function renderRecentTransactions() {
  const container = document.getElementById("recentTransactions");
  if (!container) return;

  const recent = appData.transaksi.slice(0, 5);
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty">Belum ada transaksi</div>';
    return;
  }

  container.innerHTML = recent.map(t => `
    <div class="item-card">
      <div class="item-left">
        <div class="item-title">${t.keterangan}</div>
        <div class="item-sub">${t.tanggal} • ${t.kategori}</div>
      </div>
      <div class="item-amount ${t.type === 'PEMASUKAN' ? 'amount-income' : 'amount-expense'}">
        ${t.type === 'PEMASUKAN' ? '+' : '-'} ${rupiah(t.nominal)}
      </div>
    </div>
  `).join('');
}

/* =====================================================
   BARANG & TOKO
===================================================== */
function updateBarangSelects() {
  const jualSelect = document.getElementById("jualBarang");
  const belanjaSelect = document.getElementById("belanjaBarang");

  const options = '<option value="">Pilih barang</option>' + 
    appData.barang.map(b => `<option value="${b.id}">${b.nama} (Stok: ${b.stok})</option>`).join('');

  if (jualSelect) jualSelect.innerHTML = options;
  if (belanjaSelect) belanjaSelect.innerHTML = options;
}

document.getElementById("barangForm")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const nama = document.getElementById("barangNama").value;
  const hargaModal = Number(document.getElementById("barangModalPrice").value) || 0;
  const hargaJual = Number(document.getElementById("barangJualPrice").value) || 0;
  const stok = Number(document.getElementById("barangStok").value) || 0;

  appData.barang.push({ id: Date.now(), nama, hargaModal, hargaJual, stok });
  saveData();
  closeModal('barangModal');
  this.reset();
  showToast("Barang berhasil ditambahkan");
});

function renderBarangList() {
  const container = document.getElementById("barangList");
  if (!container) return;

  if (appData.barang.length === 0) {
    container.innerHTML = '<div class="empty">Belum ada barang.</div>';
    return;
  }

  container.innerHTML = appData.barang.map(b => `
    <div class="product-item item-card">
      <div class="item-left">
        <div class="item-title">${b.nama}</div>
        <div class="item-sub">Modal: ${rupiah(b.hargaModal)} | Jual: ${rupiah(b.hargaJual)}</div>
      </div>
      <div class="item-amount">
        Stok: <strong>${b.stok}</strong>
      </div>
    </div>
  `).join('');
}

// Sales Submit
document.getElementById("penjualanForm")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const barangId = document.getElementById("jualBarang").value;
  const qty = Number(document.getElementById("jualQty").value) || 1;
  const harga = Number(document.getElementById("jualHarga").value) || 0;
  const pelanggan = document.getElementById("jualPelanggan").value || "Umum";

  const barang = appData.barang.find(b => String(b.id) === String(barangId));
  if (!barang) return;

  barang.stok -= qty;
  const total = qty * harga;

  appData.transaksi.unshift({
    id: Date.now(),
    type: "PEMASUKAN",
    tanggal: new Date().toISOString().split('T')[0],
    kategori: "Penjualan Toko",
    keterangan: `Penjualan ${barang.nama} x${qty} (${pelanggan})`,
    nominal: total,
    rekening: "Kas"
  });

  saveData();
  this.reset();
  document.getElementById("jualQty").value = 1;
  updateJualTotal();
  showToast("Penjualan berhasil dicatat");
  showPage("dashboard");
});

// Buy Stock Submit
document.getElementById("belanjaForm")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const barangId = document.getElementById("belanjaBarang").value;
  const qty = Number(document.getElementById("belanjaQty").value) || 1;
  const harga = Number(document.getElementById("belanjaHarga").value) || 0;
  const supplier = document.getElementById("belanjaSupplier").value || "-";

  const barang = appData.barang.find(b => String(b.id) === String(barangId));
  if (!barang) return;

  barang.stok += qty;
  const total = qty * harga;

  appData.transaksi.unshift({
    id: Date.now(),
    type: "PENGELUARAN",
    tanggal: new Date().toISOString().split('T')[0],
    kategori: "Belanja Stok",
    keterangan: `Belanja ${barang.nama} x${qty} (${supplier})`,
    nominal: total,
    rekening: "Kas"
  });

  saveData();
  this.reset();
  document.getElementById("belanjaQty").value = 1;
  updateBelanjaTotal();
  showToast("Belanja stok berhasil dicatat");
  showPage("dashboard");
});

/* =====================================================
   HUTANG
===================================================== */
document.getElementById("hutangForm")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const nama = document.getElementById("hutangNama").value;
  const nominal = Number(document.getElementById("hutangNominal").value) || 0;
  const tempo = document.getElementById("hutangTempo").value;
  const keterangan = document.getElementById("hutangKeterangan").value;

  appData.hutang.push({ id: Date.now(), nama, nominal, tempo, keterangan });
  saveData();
  closeModal('hutangModal');
  this.reset();
  showToast("Hutang dicatat");
});

function renderHutangList() {
  const container = document.getElementById("hutangList");
  if (!container) return;

  if (appData.hutang.length === 0) {
    container.innerHTML = '<div class="empty">Belum ada hutang.</div>';
    return;
  }

  container.innerHTML = appData.hutang.map(h => `
    <div class="item-card">
      <div class="item-left">
        <div class="item-title">${h.nama}</div>
        <div class="item-sub">Jatuh Tempo: ${h.tempo || '-'} ${h.keterangan ? '• ' + h.keterangan : ''}</div>
      </div>
      <div class="item-amount amount-expense">
        ${rupiah(h.nominal)}
      </div>
    </div>
  `).join('');
}

/* =====================================================
   HISTORY & REPORT
===================================================== */
function renderHistoryList() {
  const container = document.getElementById("historyList");
  if (!container) return;

  if (appData.transaksi.length === 0) {
    container.innerHTML = '<div class="empty">Belum ada transaksi.</div>';
    return;
  }

  container.innerHTML = appData.transaksi.map(t => `
    <div class="transaction-item item-card">
      <div class="item-left">
        <div class="item-title">${t.keterangan}</div>
        <div class="item-sub">${t.tanggal} • ${t.kategori} (${t.rekening})</div>
      </div>
      <div class="item-amount ${t.type === 'PEMASUKAN' ? 'amount-income' : 'amount-expense'}">
        ${t.type === 'PEMASUKAN' ? '+' : '-'} ${rupiah(t.nominal)}
      </div>
    </div>
  `).join('');
}

function loadReport() {
  const start = document.getElementById("reportStart").value;
  const end = document.getElementById("reportEnd").value;

  let list = appData.transaksi;
  if (start) list = list.filter(t => t.tanggal >= start);
  if (end) list = list.filter(t => t.tanggal <= end);

  let pem = 0, peng = 0;
  list.forEach(t => {
    if (t.type === "PEMASUKAN") pem += t.nominal;
    else peng += t.nominal;
  });

  document.getElementById("reportResult").innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="font-size:15px; font-weight:700;">Hasil Laporan</div>
      <div style="font-size:13px; color:var(--text-muted);">Total ${list.length} Transaksi</div>
      <hr style="border:none; border-top:1px solid var(--border-color); margin:4px 0;">
      <div style="display:flex; justify-content:space-between; font-size:14px;">
        <span>Pemasukan:</span>
        <strong style="color:#059669">${rupiah(pem)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:14px;">
        <span>Pengeluaran:</span>
        <strong style="color:#dc2626">${rupiah(peng)}</strong>
      </div>
      <hr style="border:none; border-top:1px solid var(--border-color); margin:4px 0;">
      <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:700;">
        <span>Laba / Bersih:</span>
        <span style="color:${pem - peng >= 0 ? '#059669' : '#dc2626'}">${rupiah(pem - peng)}</span>
      </div>
    </div>
  `;
}

/* =====================================================
   UI HELPERS & POPUPS
===================================================== */
function filterBarang(keyword) {
  keyword = String(keyword || "").toLowerCase().trim();
  document.querySelectorAll("#barangList .product-item").forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(keyword) ? "" : "none";
  });
}

function filterHistory(keyword) {
  keyword = String(keyword || "").toLowerCase().trim();
  document.querySelectorAll("#historyList .transaction-item").forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(keyword) ? "" : "none";
  });
}

function updateJualTotal() {
  const qty = Number(document.getElementById("jualQty")?.value) || 0;
  const harga = Number(document.getElementById("jualHarga")?.value) || 0;
  const el = document.getElementById("jualTotalPreview");
  if (el) el.textContent = rupiah(qty * harga);
}

function updateBelanjaTotal() {
  const qty = Number(document.getElementById("belanjaQty")?.value) || 0;
  const harga = Number(document.getElementById("belanjaHarga")?.value) || 0;
  const el = document.getElementById("belanjaTotalPreview");
  if (el) el.textContent = rupiah(qty * harga);
}

document.addEventListener("input", function(e) {
  if (e.target.id === "jualQty" || e.target.id === "jualHarga") updateJualTotal();
  if (e.target.id === "belanjaQty" || e.target.id === "belanjaHarga") updateBelanjaTotal();
});

document.addEventListener("change", function(e) {
  if (e.target.id === "jualBarang") {
    const barang = appData.barang.find(x => String(x.id) === String(e.target.value));
    if (barang) {
      const hargaEl = document.getElementById("jualHarga");
      if (hargaEl) hargaEl.value = barang.hargaJual || 0;
    }
    updateJualTotal();
  }
  if (e.target.id === "belanjaBarang") {
    const barang = appData.barang.find(x => String(x.id) === String(e.target.value));
    if (barang) {
      const hargaEl = document.getElementById("belanjaHarga");
      if (hargaEl) hargaEl.value = barang.hargaModal || 0;
    }
    updateBelanjaTotal();
  }
});

function openQuickAdd() {
  document.getElementById("quickAddMenu")?.classList.toggle("show");
}

function closeQuickAdd() {
  document.getElementById("quickAddMenu")?.classList.remove("show");
}

function showMoreMenu() {
  document.getElementById("moreMenu")?.classList.remove("hidden");
}

function closeMoreMenu() {
  document.getElementById("moreMenu")?.classList.add("hidden");
}

function openFromMenu(page) {
  closeMoreMenu();
  showPage(page);
}

function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

// Click outside quick add menu
document.addEventListener("click", function(e) {
  const menu = document.getElementById("quickAddMenu");
  const plus = document.querySelector(".nav-plus");
  if (menu && menu.classList.contains("show") && !menu.contains(e.target) && !plus.contains(e.target)) {
    closeQuickAdd();
  }
});

// Run Init
window.addEventListener("DOMContentLoaded", initApp);
