async function loadKategori(){
  try{
    DATA.kategori = await api('kategori');
    renderKategori();
    populateSelects();
  }catch(err){
    showError(err);
  }
}

function renderKategori(){
  const el = document.getElementById('kategoriList');
  if(!DATA.kategori.length){
    el.innerHTML = '<div class="empty">Belum ada kategori.</div>';
    return;
  }
  el.innerHTML = DATA.kategori.map(k => `
    <div style="padding:10px 0; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong>${esc(k.Nama)}</strong>
        <small style="color:#64748b; display:block;">Jenis: ${esc(k.Jenis)}</small>
      </div>
    </div>
  `).join('');
}
