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

  if(!el) return;

  const q = String(
    document.getElementById('searchBarang')?.value || ''
  ).toLowerCase().trim();

  const data = DATA.barang.filter(b => {

    const nama = String(b.Nama || '').toLowerCase();
    const kategori = String(b.Kategori || '').toLowerCase();

    return nama.includes(q) || kategori.includes(q);
  });

  if(!data.length){

    el.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📦</div>
        <div class="empty-title">Tidak ada barang</div>
        <div class="empty-text">
          ${q
            ? 'Barang yang dicari tidak ditemukan.'
            : 'Belum ada data barang.'}
        </div>
      </div>
    `;

    return;
  }

  el.innerHTML = `
    <div class="barang-grid">

      ${data.map(b => {

        const stok = Number(b.Stok || 0);
        const minimum = Number(b.Minimum || 0);

        const stokRendah = stok <= minimum;

        return `
          <div class="barang-card">

            <div class="barang-top">

              <div class="barang-icon">
                📦
              </div>

              <div class="barang-info">

                <div class="barang-nama">
                  ${esc(b.Nama)}
                </div>

                <div class="barang-kategori">
                  ${esc(b.Kategori || 'Tanpa kategori')}
                </div>

              </div>

            </div>


            <div class="barang-stok-row">

              <div>

                <div class="barang-label">
                  Stok
                </div>

                <div class="
                  barang-stok
                  ${stokRendah ? 'stok-rendah' : 'stok-aman'}
                ">
                  ${stok}
                  <span>
                    ${esc(b.Satuan || 'pcs')}
                  </span>
                </div>

              </div>

              <div class="barang-minimum">

                Min.
                ${minimum}

              </div>

            </div>


            <div class="barang-harga">

              <div class="harga-box">

                <div class="harga-label">
                  Harga Modal
                </div>

                <div class="harga-modal">
                  ${rupiah(b.Modal)}
                </div>

              </div>


              <div class="harga-box jual">

                <div class="harga-label">
                  Harga Jual
                </div>

                <div class="harga-jual">
                  ${rupiah(b.Jual)}
                </div>

              </div>

            </div>


            ${
              stokRendah
              ?
              `
                <div class="stok-warning">
                  ⚠️ Stok menipis
                </div>
              `
              :
              ''
            }

          </div>
        `;

      }).join('')}

    </div>
  `;
}


async function simpanBarang(){

  try{

    const payload = {

      nama:
        document.getElementById('barangNama').value,

      kategori:
        document.getElementById('barangKategori').value,

      satuan:
        document.getElementById('barangSatuan').value,

      modal:
        Number(
          document.getElementById('barangModal').value || 0
        ),

      jual:
        Number(
          document.getElementById('barangJual').value || 0
        ),

      stok:
        Number(
          document.getElementById('barangStok').value || 0
        ),

      minimum:
        Number(
          document.getElementById('barangMinimum').value || 0
        ),

      supplier:
        document.getElementById('barangSupplier').value

    };


    await api('tambahBarang', payload);

    closeModal('modalBarang');

    await loadBarang();

    showToast('Barang berhasil disimpan!');

  }catch(err){

    showError(err);

  }
}
