async function loadBarang(){
  try{
    DATA.barang = await api('barang');
    renderBarang();
    populateSelects();
  }catch(err){
    showError(err);
  }
}

function renderBarang(){
  const el = document.getElementById('barangList');
  const q = String(document.getElementById('searchBarang')?.value || '').toLowerCase();
  const data = DATA.barang.filter(b => String(b.Nama || '').toLowerCase().includes(q) || String(b.Kategori || '').toLowerCase().includes(q));

  if(!data.length){
    el.innerHTML = '<div class="empty">Tidak ada data barang.</div>';
    return;
  }

  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nama Barang</th>
            <th>Kategori</th>
            <th>Stok</th>
            <th>Modal</th>
            <th>Jual</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(b => `
            <tr>
              <td><strong>${esc(b.Nama)}</strong></td>
              <td>${esc(b.Kategori)}</td>
              <td><span class="badge ${Number(b.Stok) <= Number(b.Minimum || 0) ? 'badge-red' : 'badge-green'}">${b.Stok} ${esc(b.Satuan)}</span></td>
              <td>${rupiah(b.Modal)}</td>
              <td>${rupiah(b.Jual)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function simpanBarang(){
  try{
    const payload = {
      nama: document.getElementById('barangNama').value,
      kategori: document.getElementById('barangKategori').value,
      satuan: document.getElementById('barangSatuan').value,
      modal: Number(document.getElementById('barangModal').value || 0),
      jual: Number(document.getElementById('barangJual').value || 0),
      stok: Number(document.getElementById('barangStok').value || 0),
      minimum: Number(document.getElementById('barangMinimum').value || 0),
      supplier: document.getElementById('barangSupplier').value
    };

    await api('tambahBarang', payload);
    closeModal('modalBarang');
    loadBarang();
    showToast('Barang berhasil disimpan!');
  }catch(err){
    showError(err);
  }
}
