async function loadHutang(){
  try{
    DATA.hutang = await api('hutang');
    renderHutang();
  }catch(err){
    showError(err);
  }
}

function renderHutang(){
  const el = document.getElementById('hutangList');
  if(!DATA.hutang.length){
    el.innerHTML = '<div class="empty">Tidak ada hutang atau tagihan aktif.</div>';
    return;
  }
  el.innerHTML = DATA.hutang.map(h => `
    <div style="padding:10px 0; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
      <div><strong>${esc(h.Pihak)}</strong> (${esc(h.Jenis)})<br><small>Tempo: ${esc(h.Tempo)}</small></div>
      <div class="orange">${rupiah(h.Sisa)}</div>
    </div>
  `).join('');
}

async function simpanHutang(){
  try{
    const payload = {
      jenis: document.getElementById('hutangJenis').value,
      pihak: document.getElementById('hutangPihak').value,
      keterangan: document.getElementById('hutangKeterangan').value,
      total: Number(document.getElementById('hutangTotal').value || 0),
      dibayar: Number(document.getElementById('hutangDibayar').value || 0),
      tempo: document.getElementById('hutangTempo').value
    };
    await api('simpanHutang', payload);
    closeModal('modalHutang');
    loadHutang();
    showToast('Hutang/Tagihan disimpan.');
  }catch(err){
    showError(err);
  }
}
