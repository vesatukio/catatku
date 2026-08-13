async function loadBelanja(){
  try{
    DATA.belanja = await api('belanja');
    renderBelanja();
  }catch(err){
    showError(err);
  }
}

function renderBelanja(){
  const el = document.getElementById('belanjaList');
  if(!DATA.belanja.length){
    el.innerHTML = '<div class="empty">Belum ada riwayat belanja.</div>';
    return;
  }
  el.innerHTML = DATA.belanja.map(b => `
    <div style="padding:10px 0; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
      <div><strong>${esc(b.Nama)}</strong><br><small>${esc(b.Supplier)} · ${esc(b.Tanggal)}</small></div>
      <div class="red">-${rupiah(b.Total)}</div>
    </div>
  `).join('');
}

async function simpanBelanja(){
  try{
    const payload = {
      nama: document.getElementById('belanjaNama').value || document.getElementById('belanjaBarang').value,
      qty: Number(document.getElementById('belanjaQty').value || 1),
      harga: Number(document.getElementById('belanjaHarga').value || 0),
      supplier: document.getElementById('belanjaSupplier').value,
      dibayar: Number(document.getElementById('belanjaDibayar').value || 0),
      tempo: document.getElementById('belanjaTempo').value
    };
    await api('simpanBelanja', payload);
    loadBelanja();
    showToast('Belanja stok disimpan.');
  }catch(err){
    showError(err);
  }
}
