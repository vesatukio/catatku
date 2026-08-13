async function loadHistory(){
  try{
    DATA.history = await api('history', null);
    renderHistory();
  }catch(err){
    showError(err);
  }
}

function renderHistory(){
  const el = document.getElementById('historyList');
  const q = String(document.getElementById('searchHistory')?.value || '').toLowerCase();
  const data = DATA.history.filter(t => {
    return (
      String(t.Keterangan || '').toLowerCase().includes(q) ||
      String(t.Kategori || '').toLowerCase().includes(q) ||
      String(t.Sumber || '').toLowerCase().includes(q)
    );
  });

  if(!data.length){
    el.innerHTML = '<div class="empty">Tidak ada data.</div>';
    return;
  }

  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Keterangan</th>
            <th>Sumber</th>
            <th>Jenis</th>
            <th>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(t => `
            <tr>
              <td>${esc(t.Tanggal)}</td>
              <td>${esc(t.Keterangan)}</td>
              <td>${esc(t.Sumber)}</td>
              <td><span class="badge ${t.Jenis === 'Masuk' ? 'badge-green' : 'badge-red'}">${esc(t.Jenis)}</span></td>
              <td>${rupiah(t.Jumlah)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function simpanPemasukan(){
  try{
    const payload = {
      tanggal: document.getElementById('masukTanggal').value,
      kategori: document.getElementById('masukKategori').value,
      keterangan: document.getElementById('masukKeterangan').value,
      jumlah: Number(document.getElementById('masukJumlah').value || 0),
      metode: document.getElementById('masukMetode').value
    };
    await api('simpanPemasukan', payload);
    closeModal('modalTransaksi');
    showToast('Pemasukan berhasil disimpan!');
    loadHistory();
    loadDashboard();
  }catch(err){
    showError(err);
  }
}

async function simpanPengeluaran(){
  try{
    const payload = {
      tanggal: document.getElementById('keluarTanggal').value,
      sumber: document.getElementById('keluarSumber').value,
      kategori: document.getElementById('keluarKategori').value,
      keterangan: document.getElementById('keluarKeterangan').value,
      jumlah: Number(document.getElementById('keluarJumlah').value || 0),
      metode: document.getElementById('keluarMetode').value
    };
    await api('simpanPengeluaran', payload);
    closeModal('modalPengeluaran');
    showToast('Pengeluaran berhasil disimpan!');
    loadHistory();
    loadDashboard();
  }catch(err){
    showError(err);
  }
}
