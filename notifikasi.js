async function loadNotifikasi(){
  try{
    DATA.notifikasi = await api('notifikasi');
    renderNotifikasi();
  }catch(err){
    showError(err);
  }
}

function renderNotifikasi(){
  const el = document.getElementById('notifikasiList');
  if(!DATA.notifikasi.length){
    el.innerHTML = '<div class="card"><div class="empty">Tidak ada notifikasi penting.</div></div>';
    return;
  }
  el.innerHTML = DATA.notifikasi.map(n => `
    <div class="alert"><strong>${esc(n.Judul)}</strong><p>${esc(n.Pesan)}</p></div>
  `).join('');
}
