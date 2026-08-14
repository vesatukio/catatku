// Variabel global penyimpan data barang
let globalBarangList = [];

// Jalankan fungsi setelah seluruh halaman HTML selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
  // Set default input tanggal ke hari ini
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => el.value = today);
  
  // Ambil data awal dari backend (Code.gs)
  loadAllData();
});

/**
 * MENGAMBIL DATA DARI BACKEND GOOGLE APPS SCRIPT
 */
function loadAllData() {
  showLoadingStatus(true);
  
  google.script.run
    .withSuccessHandler(res => {
      showLoadingStatus(false);
      renderAllTables(res);
    })
    .withFailureHandler(err => {
      showLoadingStatus(false);
      alert("⚠️ Gagal terhubung ke Google Apps Script: " + (err.message || err));
      console.error("Detail Error:", err);
    })
    .fetchAllData();
}

/**
 * RENDER SEMUA TABEL
 */
function renderAllTables(res) {
  renderTabelBarang(res.barang || []);
  renderTabelPengeluaran(res.pengeluaran || []);
  renderTabelData(res.transaksi || []);
}

// 1. Render Tabel Barang
function renderTabelBarang(dataBarang) {
  globalBarangList = dataBarang;
  const tbody = document.getElementById('tbl-barang');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (dataBarang.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">Belum ada data barang</td></tr>';
  } else {
    dataBarang.forEach(item => {
      const isStokTipis = (parseFloat(item.Stok) <= parseFloat(item.Minimum));
      tbody.innerHTML += `
        <tr>
          <td><code>${item.ID || '-'}</code></td>
          <td><b>${item['Nama Barang'] || '-'}</b></td>
          <td>${item.Kategori || '-'}</td>
          <td>Rp ${formatRupiah(item.Modal)}</td>
          <td>${item['Laba%'] || 0}%</td>
          <td>Rp ${formatRupiah(item['Laba Nominal'])}</td>
          <td><b>Rp ${formatRupiah(item.Jual)}</b></td>
          <td>
            <span class="badge ${isStokTipis ? 'bg-danger' : 'bg-success'}">
              ${item.Stok || 0}
            </span>
          </td>
          <td>${item.Minimum || 0}</td>
          <td>${item.Supplier || '-'}</td>
        </tr>`;
    });
  }

  // Update opsi dropdown barang di Form Transaksi
  updateDropdownBarang(dataBarang);
}

// 2. Render Tabel Pengeluaran
function renderTabelPengeluaran(dataPengeluaran) {
  const tbody = document.getElementById('tbl-pengeluaran');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (dataPengeluaran.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Belum ada catatan pengeluaran</td></tr>';
  } else {
    dataPengeluaran.forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td><code>${item.ID || '-'}</code></td>
          <td>${formatTanggal(item.Tanggal)}</td>
          <td><span class="badge bg-secondary">${item.Kategori || '-'}</span></td>
          <td>${item.Keterangan || '-'}</td>
          <td class="text-danger fw-bold">Rp ${formatRupiah(item.Nominal)}</td>
          <td>${item.Jenis || '-'}</td>
          <td>${item.Rekening || '-'}</td>
        </tr>`;
    });
  }
}

// 3. Render Tabel DATA (Transaksi)
function renderTabelData(dataTransaksi) {
  const tbody = document.getElementById('tbl-data');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (dataTransaksi.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">Belum ada transaksi</td></tr>';
  } else {
    dataTransaksi.forEach(item => {
      const isKeluar = (item.Jenis === 'Keluar' || item.Jenis === 'Penjualan');
      tbody.innerHTML += `
        <tr>
          <td><code>${item.ID || '-'}</code></td>
          <td>${item.Data || '-'}</td>
          <td>${formatTanggal(item.Tanggal)}</td>
          <td><span class="badge ${isKeluar ? 'bg-warning text-dark' : 'bg-info'}">${item.Jenis || '-'}</span></td>
          <td>${item.Kategori || '-'}</td>
          <td>${item.BarangNama || '-'}</td>
          <td>${item.Qty || 0}</td>
          <td>Rp ${formatRupiah(item.Harga)}</td>
          <td class="fw-bold">Rp ${formatRupiah(item.Nominal)}</td>
          <td><span class="badge ${item.Status === 'Lunas' ? 'bg-success' : 'bg-danger'}">${item.Status || 'Lunas'}</span></td>
        </tr>`;
    });
  }
}

/**
 * HANDLER SIMPAN FORM
 */

// Simpan Barang
function handleSaveBarang(e) {
  e.preventDefault();
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  toggleButtonLoading(btnSubmit, true);

  const formData = Object.fromEntries(new FormData(e.target));
  
  google.script.run
    .withSuccessHandler(res => {
      toggleButtonLoading(btnSubmit, false);
      const modalEl = document.getElementById('modalBarang');
      if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();
      e.target.reset();
      loadAllData();
    })
    .withFailureHandler(err => {
      toggleButtonLoading(btnSubmit, false);
      alert("Gagal menyimpan barang: " + (err.message || err));
    })
    .saveBarang(formData);
}

// Simpan Pengeluaran
function handleSavePengeluaran(e) {
  e.preventDefault();
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  toggleButtonLoading(btnSubmit, true);

  const formData = Object.fromEntries(new FormData(e.target));

  google.script.run
    .withSuccessHandler(res => {
      toggleButtonLoading(btnSubmit, false);
      const modalEl = document.getElementById('modalPengeluaran');
      if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();
      e.target.reset();
      loadAllData();
    })
    .withFailureHandler(err => {
      toggleButtonLoading(btnSubmit, false);
      alert("Gagal menyimpan pengeluaran: " + (err.message || err));
    })
    .savePengeluaran(formData);
}

// Simpan Transaksi (DATA)
function handleSaveData(e) {
  e.preventDefault();
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  toggleButtonLoading(btnSubmit, true);

  const formData = Object.fromEntries(new FormData(e.target));

  google.script.run
    .withSuccessHandler(res => {
      toggleButtonLoading(btnSubmit, false);
      const modalEl = document.getElementById('modalData');
      if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();
      e.target.reset();
      loadAllData();
    })
    .withFailureHandler(err => {
      toggleButtonLoading(btnSubmit, false);
      alert("Gagal menyimpan transaksi: " + (err.message || err));
    })
    .saveData(formData);
}

/**
 * FUNGSI KALKULASI & UTILITY
 */

// Hitung Otomatis Laba Nominal & Harga Jual
function calcLaba() {
  const modal = parseFloat(document.getElementById('brg-modal').value) || 0;
  const labaP = parseFloat(document.getElementById('brg-laba-p').value) || 0;
  
  const labaNominal = modal * (labaP / 100);
  const hargaJual = modal + labaNominal;

  document.getElementById('brg-laba-n').value = Math.round(labaNominal);
  document.getElementById('brg-jual').value = Math.round(hargaJual);
}

// Hitung Otomatis Total Nominal (Qty x Harga)
function calcTrxNominal() {
  const qty = parseFloat(document.getElementById('trx-qty').value) || 0;
  const harga = parseFloat(document.getElementById('trx-harga').value) || 0;
  document.getElementById('trx-nominal').value = qty * harga;
}

// Auto-fill Nama Barang & Harga saat Barang dipilih
function onSelectBarang(elem) {
  const selectedID = elem.value;
  const barang = globalBarangList.find(b => String(b.ID) === String(selectedID));

  if (barang) {
    document.getElementById('trx-barang-nama').value = barang['Nama Barang'] || '';
    document.getElementById('trx-harga').value = barang.Jual || 0;
  } else {
    document.getElementById('trx-barang-nama').value = '';
    document.getElementById('trx-harga').value = 0;
  }
  calcTrxNominal();
}

// Reset Modal Form Barang
function resetFormBarang() {
  const form = document.getElementById('form-barang');
  if (form) form.reset();
  const idEl = document.getElementById('brg-id');
  if (idEl) idEl.value = '';
}

// Update Pilihan Barang di Form Transaksi
function updateDropdownBarang(listBarang) {
  const optBarang = document.getElementById('trx-barang');
  if (!optBarang) return;

  optBarang.innerHTML = '<option value="">-- Non-Barang / Lainnya --</option>';
  listBarang.forEach(b => {
    optBarang.innerHTML += `<option value="${b.ID}">${b['Nama Barang']} (Stok: ${b.Stok})</option>`;
  });
}

/**
 * FORMATTING & UI HELPER
 */
function formatRupiah(num) {
  const val = parseFloat(num) || 0;
  return val.toLocaleString('id-ID');
}

function formatTanggal(dateStr) {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  return dateStr;
}

function showLoadingStatus(isLoading) {
  const tables = ['tbl-barang', 'tbl-pengeluaran', 'tbl-data'];
  if (isLoading) {
    tables.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<tr><td colspan="10" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Memuat data...</td></tr>';
    });
  }
}

function toggleButtonLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.oldText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.oldText || 'Simpan';
  }
}
