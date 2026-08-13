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
  const btnToggle = document.getElementById('btnToggleHistory');

  if(!DATA.history || !DATA.history.length){
    el.innerHTML = '<div style="font-size: 15px; color: var(--text-muted); text-align: center; padding: 12px;">Belum ada transaksi.</div>';
    if(btnToggle) btnToggle.style.display = 'none';
    return;
  }

  const dataTampil = tampilkanSemuaHistoryFlag ? DATA.history : DATA.history.slice(0, 5);

  el.innerHTML = dataTampil.map((t, index) => {
    const masuk = t.Jenis === 'Masuk';
    const warnaNominal = masuk ? 'var(--success)' : 'var(--danger)';
    const tanda = masuk ? '+' : '-';
    
    // Asumsikan t.id atau index digunakan sebagai pengenal data
    const idData = t.id !== undefined ? t.id : index;

    return `
      <div style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: var(--text-main); font-size: 16px;">${esc(t.Keterangan || t.Kategori)}</strong>
          <strong style="color: ${warnaNominal}; font-size: 16px;">${tanda}${rupiah(t.Jumlah)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <small style="color: var(--text-muted); font-size: 13px;">${esc(t.Sumber)} · ${esc(t.Metode)} · ${esc(t.Tanggal)}</small>
          <div>
            <button onclick="editTransaksi('${idData}')" style="background: #e0e7ff; color: #1d4ed8; border: none; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; margin-right: 4px;">Edit</button>
            <button onclick="hapusTransaksi('${idData}')" style="background: #fee2e2; color: #dc2626; border: none; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;">Hapus</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if(btnToggle) {
    if(DATA.history.length > 5) {
      btnToggle.style.display = 'block';
      btnToggle.innerText = tampilkanSemuaHistoryFlag ? 'Sembunyikan' : `Lihat Semua (${DATA.history.length})`;
    } else {
      btnToggle.style.display = 'none';
    }
  }
}
