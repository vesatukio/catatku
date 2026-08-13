async function loadKasir(){
  try{
    if(!DATA.barang.length) DATA.barang = await api('barang');
    DATA.penjualan = await api('penjualan');
    populateSelects();
    renderPenjualan();
  }catch(err){
    showError(err);
  }
}

function renderPenjualan(){
  const el = document.getElementById('penjualanList');
  if(!DATA.penjualan || !DATA.penjualan.length){
    el.innerHTML = '<div class="empty">Belum ada penjualan.</div>';
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Barang</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${DATA.penjualan.slice(0, 10).map(p => `
            <tr>
              <td>${esc(p.Tanggal)}</td>
              <td>${esc(p.Barang)}</td>
              <td>${p.Qty}</td>
              <td class="green">${rupiah(p.Total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function simpanPenjualan(){
  try{
    const payload = {
      barang: document.getElementById('jualBarang').value,
      qty: Number(document.getElementById('jualQty').value || 1),
      harga: Number(document.getElementById('jualHarga').value || 0),
      metode: document.getElementById('jualMetode').value,
      catatan: document.getElementById('jualCatatan').value
    };
    await api('simpanPenjualan', payload);
    loadKasir();
    showToast('Penjualan berhasil disimpan!');
  }catch(err){
    showError(err);
  }
}
