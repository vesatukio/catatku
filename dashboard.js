async function loadDashboard(){
  try{
    const d = await api('dashboard');
    DATA.dashboard = d;
    document.getElementById('saldo').textContent = rupiah(d.saldo);
    document.getElementById('masukHari').textContent = rupiah(d.pemasukanHariIni);
    document.getElementById('keluarHari').textContent = rupiah(d.pengeluaranHariIni);
    document.getElementById('saldoPribadi').textContent = rupiah(d.saldoPribadi);
    document.getElementById('saldoToko').textContent = rupiah(d.saldoToko);
    document.getElementById('totalHutang').textContent = rupiah(d.totalHutang);
    document.getElementById('nilaiStok').textContent = rupiah(d.nilaiStok);
    document.getElementById('jumlahBarang').textContent = Number(d.jumlahBarang || 0);

    loadLabaBulan();
    loadHistoryDashboard();
    loadNotifikasiDashboard();
  }catch(err){
    showError(err);
  }
}

async function loadLabaBulan(){
  try{
    const d = await api('laporanLaba', { mulai: firstDayMonth(), akhir: todayDate() });
    document.getElementById('labaBulan').textContent = rupiah(d.labaKotor);
  }catch(err){}
}

async function loadHistoryDashboard(){
  try{
    const data = await api('history');
    DATA.history = data;
    renderHistoryDashboard();
  }catch(err){}
}

function renderHistoryDashboard(){
  const el = document.getElementById('historyDashboard');
  if(!DATA.history.length){
    el.innerHTML = '<div class="empty">Belum ada transaksi.</div>';
    return;
  }
  el.innerHTML = DATA.history.slice(0,5).map(t => {
    const masuk = t.Jenis === 'Masuk';
    return `
      <div style="padding:10px 0; border-bottom:1px solid #eee">
        <div style="display:flex; justify-content:space-between">
          <strong>${esc(t.Keterangan || t.Kategori)}</strong>
          <strong class="${masuk ? 'green' : 'red'}">${masuk ? '+' : '-'}${rupiah(t.Jumlah)}</strong>
        </div>
        <small style="color:#64748b">${esc(t.Sumber)} · ${esc(t.Metode)} · ${esc(t.Tanggal)}</small>
      </div>
    `;
  }).join('');
}

async function loadNotifikasiDashboard(){
  try{
    const notif = await api('notifikasi');
    const el = document.getElementById('dashboardAlert');
    if(notif && notif.length){
      el.innerHTML = `<div class="alert">⚠️ Ada ${notif.length} pemberitahuan / tagihan jatuh tempo!</div>`;
    } else {
      el.innerHTML = '';
    }
  }catch(err){}
}
