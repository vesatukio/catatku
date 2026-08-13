function rupiah(n){
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function esc(v){
  return String(v ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function todayDate(){
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}

function datetimeLocal(){
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function firstDayMonth(){
  const d = new Date();
  d.setDate(1);
  const pad = n => String(n).padStart(2,'0');
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-01';
}

function showToast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showError(err){
  console.error(err);
  showToast('Error: ' + err.message);
}

function showPage(page){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if(target){
    target.classList.add('active');
  }
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  if(page === 'dashboard') loadDashboard();
  if(page === 'transaksi') loadHistory();
  if(page === 'barang') loadBarang();
  if(page === 'kasir') loadKasir();
  if(page === 'belanja') loadBelanja();
  if(page === 'hutang') loadHutang();
  if(page === 'notifikasi') loadNotifikasi();
  if(page === 'kategori') loadKategori();
  if(page === 'laporan') loadLaporan('bulan');
}

function openMenu(){
  openModal('modalMenu');
}

function goMenu(page){
  closeModal('modalMenu');
  showPage(page);
}

function openModal(id){
  document.getElementById(id).classList.add('show');
}

function closeModal(id){
  document.getElementById(id).classList.remove('show');
}

function populateSelects(){
  const katOptions = DATA.kategori.map(k => `<option value="${esc(k.Nama)}">${esc(k.Nama)} (${esc(k.Jenis)})</option>`).join('');
  const masukKat = document.getElementById('masukKategori');
  const keluarKat = document.getElementById('keluarKategori');
  const barangKat = document.getElementById('barangKategori');
  if(masukKat) masukKat.innerHTML = katOptions;
  if(keluarKat) keluarKat.innerHTML = katOptions;
  if(barangKat) barangKat.innerHTML = katOptions;

  const barangOptions = DATA.barang.map(b => `<option value="${esc(b.Nama)}">${esc(b.Nama)} (Stok: ${b.Stok || 0})</option>`).join('');
  const jualBarang = document.getElementById('jualBarang');
  const belanjaBarang = document.getElementById('belanjaBarang');
  if(jualBarang) jualBarang.innerHTML = barangOptions;
  if(belanjaBarang) belanjaBarang.innerHTML = '<option value="">-- Barang Baru / Lainnya --</option>' + barangOptions;
}

window.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  const dtNow = datetimeLocal();
  if(document.getElementById('masukTanggal')) document.getElementById('masukTanggal').value = dtNow;
  if(document.getElementById('keluarTanggal')) document.getElementById('keluarTanggal').value = dtNow;
});
