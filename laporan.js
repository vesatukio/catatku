async function loadLaporan(periode){
  try{
    const res = await api('laporan', { periode });
    const el = document.getElementById('laporanResult');
    if(!el) return;
    el.innerHTML = `
      <div class="card">
        <div class="section-title">Ringkasan (${periode})</div>
        <div style="display:grid; gap:8px;">
          <div>Pemasukan: <strong class="green">${rupiah(res.pemasukan)}</strong></div>
          <div>Pengeluaran: <strong class="red">${rupiah(res.pengeluaran)}</strong></div>
          <div>Laba Bersih: <strong class="blue">${rupiah(res.laba)}</strong></div>
        </div>
      </div>
    `;
  }catch(err){
    showError(err);
  }
}

async function setupCheck(){
  try{
    await api('setup');
    showToast('Database & tabel berhasil diperiksa/disiapkan.');
    location.reload();
  }catch(err){
    showError(err);
  }
}
