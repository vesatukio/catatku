<script>
let globalBarangList = [];

document.addEventListener('DOMContentLoaded', function() {
  // Set default tanggal hari ini
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('out_tanggal').value = today;
  document.getElementById('tx_tanggal').value = today;

  // Load Data awal
  loadBarangData();
  loadPengeluaranData();
  loadTransaksiData();

  // Event Listener Kalkulasi Laba Barang
  document.getElementById('brg_modal').addEventListener('input', calculateLabaBarang);
  document.getElementById('brg_laba_persen').addEventListener('input', calculateLabaBarang);

  // Form Submission
  document.getElementById('formBarang').addEventListener('submit', handleSaveBarang);
  document.getElementById('formPengeluaran').addEventListener('submit', handleSavePengeluaran);
  document.getElementById('formTransaksi').addEventListener('submit', handleSaveTransaksi);
});

// ==========================================
// BARANG LOGIC
// ==========================================

function calculateLabaBarang() {
  const modal = parseFloat(document.getElementById('brg_modal').value) || 0;
  const labaPersen = parseFloat(document.getElementById('brg_laba_persen').value) || 0;
  
  const labaNominal = modal * (labaPersen / 100);
  const jual = modal + labaNominal;

  document.getElementById('brg_laba_nominal').value = labaNominal.toLocaleString('id-ID');
  document.getElementById('brg_jual').value = jual.toLocaleString('id-ID');
}

function loadBarangData() {
  google.script.run.withSuccessHandler(renderTableBarang).getBarang();
}

function renderTableBarang(data) {
  globalBarangList = data;
  const tbody = document.querySelector('#tableBarang tbody');
  const selectBarangTx = document.getElementById('tx_barang_id');
  
  tbody.innerHTML = '';
  selectBarangTx.innerHTML = '<option value="">-- Pilih Barang (Opsional) --</option>';

  data.forEach(item => {
    // Populate Table
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.ID}</td>
      <td><strong>${item['Nama Barang']}</strong></td>
      <td>${item.Kategori || '-'}</td>
      <td>Rp ${Number(item.Modal).toLocaleString('id-ID')}</td>
      <td>Rp ${Number(item.Jual).toLocaleString('id-ID')}</td>
      <td><span class="badge ${item.Stok <= item.Minimum ? 'bg-danger' : 'bg-success'}">${item.Stok}</span></td>
      <td>${item.Supplier || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary py-0" onclick="editBarang('${item.ID}')">Edit</button>
        <button class="btn btn-sm btn-outline-danger py-0" onclick="deleteBarang('${item.ID}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);

    // Populate Dropdown Transaksi
    const opt = document.createElement('option');
    opt.value = item.ID;
    opt.textContent = `${item['Nama Barang']} (Stok: ${item.Stok})`;
    selectBarangTx.appendChild(opt);
  });
}

function handleSaveBarang(e) {
  e.preventDefault();
  const payload = {
    ID: document.getElementById('brg_id').value,
    'Nama Barang': document.getElementById('brg_nama').value,
    Kategori: document.getElementById('brg_kategori').value,
    Modal: document.getElementById('brg_modal').value,
    'Laba%': document.getElementById('brg_laba_persen').value,
    Stok: document.getElementById('brg_stok').value,
    Minimum: document.getElementById('brg_min').value,
    Supplier: document.getElementById('brg_supplier').value
  };

  google.script.run.withSuccessHandler(res => {
    alert(res.message);
    resetFormBarang();
    loadBarangData();
  }).saveBarang(payload);
}

function editBarang(id) {
  const item = globalBarangList.find(b => b.ID === id);
  if (!item) return;

  document.getElementById('brg_id').value = item.ID;
  document.getElementById('brg_nama').value = item['Nama Barang'];
  document.getElementById('brg_kategori').value = item.Kategori;
  document.getElementById('brg_modal').value = item.Modal;
  document.getElementById('brg_laba_persen').value = item['Laba%'];
  document.getElementById('brg_stok').value = item.Stok;
  document.getElementById('brg_min').value = item.Minimum;
  document.getElementById('brg_supplier').value = item.Supplier;
  
  calculateLabaBarang();
}

function deleteBarang(id) {
  if (confirm('Yakin ingin menghapus barang ini?')) {
    google.script.run.withSuccessHandler(res => {
      alert(res.message);
      loadBarangData();
    }).deleteBarang(id);
  }
}

function resetFormBarang() {
  document.getElementById('formBarang').reset();
  document.getElementById('brg_id').value = '';
}

// ==========================================
// PENGELUARAN LOGIC
// ==========================================

function loadPengeluaranData() {
  google.script.run.withSuccessHandler(renderTablePengeluaran).getPengeluaran();
}

function renderTablePengeluaran(data) {
  const tbody = document.querySelector('#tablePengeluaran tbody');
  tbody.innerHTML = '';

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.ID}</td>
      <td>${item.Tanggal}</td>
      <td>${item.Kategori}</td>
      <td>Rp ${Number(item.Nominal).toLocaleString('id-ID')}</td>
      <td>${item.Jenis}</td>
      <td>${item.Rekening || '-'}</td>
      <td>${item.Keterangan || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function handleSavePengeluaran(e) {
  e.preventDefault();
  const payload = {
    Tanggal: document.getElementById('out_tanggal').value,
    Kategori: document.getElementById('out_kategori').value,
    Nominal: document.getElementById('out_nominal').value,
    Jenis: document.getElementById('out_jenis').value,
    Rekening: document.getElementById('out_rekening').value,
    Keterangan: document.getElementById('out_keterangan').value
  };

  google.script.run.withSuccessHandler(res => {
    alert(res.message);
    document.getElementById('formPengeluaran').reset();
    loadPengeluaranData();
  }).savePengeluaran(payload);
}

// ==========================================
// TRANSAKSI LOGIC
// ==========================================

function onSelectBarang(id) {
  if (!id) return;
  const item = globalBarangList.find(b => b.ID === id);
  if (item) {
    const jenis = document.getElementById('tx_jenis').value;
    const harga = jenis === 'Penjualan' ? item.Jual : item.Modal;
    document.getElementById('tx_harga').value = harga;
    document.getElementById('tx_supplier').value = item.Supplier || '';
    calculateTxTotal();
  }
}

function calculateTxTotal() {
  const qty = parseFloat(document.getElementById('tx_qty').value) || 0;
  const harga = parseFloat(document.getElementById('tx_harga').value) || 0;
  const total = qty * harga;
  document.getElementById('tx_nominal').value = total;
  document.getElementById('tx_dibayar').value = total;
}

function loadTransaksiData() {
  google.script.run.withSuccessHandler(renderTableData).getDataTransaksi();
}

function renderTableData(data) {
  const tbody = document.querySelector('#tableData tbody');
  tbody.innerHTML = '';

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.ID}</td>
      <td>${item.Tanggal}</td>
      <td><span class="badge ${item.Jenis === 'Penjualan' ? 'bg-success' : 'bg-info'}">${item.Jenis}</span></td>
      <td>${item.BarangNama || '-'}</td>
      <td>${item.Qty || 0}</td>
      <td>Rp ${Number(item.Harga || 0).toLocaleString('id-ID')}</td>
      <td>Rp ${Number(item.Nominal || 0).toLocaleString('id-ID')}</td>
      <td><span class="badge bg-secondary">${item.Status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function handleSaveTransaksi(e) {
  e.preventDefault();
  const barangId = document.getElementById('tx_barang_id').value;
  const selectedBarang = globalBarangList.find(b => b.ID === barangId);

  const payload = {
    Tanggal: document.getElementById('tx_tanggal').value,
    Jenis: document.getElementById('tx_jenis').value,
    Kategori: document.getElementById('tx_jenis').value,
    BarangID: barangId,
    BarangNama: selectedBarang ? selectedBarang['Nama Barang'] : '',
    Qty: document.getElementById('tx_qty').value,
    Harga: document.getElementById('tx_harga').value,
    Nominal: document.getElementById('tx_nominal').value,
    Pelanggan: document.getElementById('tx_pelanggan').value,
    Supplier: document.getElementById('tx_supplier').value,
    Rekening: document.getElementById('tx_rekening').value,
    Status: document.getElementById('tx_status').value,
    Dibayar: document.getElementById('tx_dibayar').value,
    JatuhTempo: document.getElementById('tx_jatuh_tempo').value,
    Data: 'Transaksi Web'
  };

  google.script.run.withSuccessHandler(res => {
    alert(res.message);
    document.getElementById('formTransaksi').reset();
    loadTransaksiData();
    loadBarangData(); // Refresh stok barang
  }).saveTransaksi(payload);
}
</script>
