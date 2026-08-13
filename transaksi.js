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

  if(!el) return;

  const q = String(
    document.getElementById('searchHistory')?.value || ''
  ).toLowerCase().trim();

  const data = DATA.history.filter(t => {

    return (
      String(t.Keterangan || '').toLowerCase().includes(q) ||
      String(t.Kategori || '').toLowerCase().includes(q) ||
      String(t.Sumber || '').toLowerCase().includes(q)
    );

  });

  if(!data.length){

    el.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          💰
        </div>

        <div class="empty-title">
          Belum ada transaksi
        </div>

        <div class="empty-text">
          ${q
            ? 'Transaksi yang dicari tidak ditemukan.'
            : 'Pemasukan dan pengeluaran akan muncul di sini.'}
        </div>

      </div>
    `;

    return;
  }


  el.innerHTML = `
    <div class="history-cards">

      ${data.map(t => {

        const masuk = String(t.Jenis || '') === 'Masuk';

        const icon = masuk ? '💰' : '💸';

        const jenisClass = masuk
          ? 'history-masuk'
          : 'history-keluar';

        const jumlahPrefix = masuk ? '+' : '-';

        return `
          <div class="history-card">

            <div class="history-main">

              <div class="
                history-icon
                ${jenisClass}
              ">
                ${icon}
              </div>


              <div class="history-info">

                <div class="history-title">
                  ${esc(t.Keterangan || 'Tanpa keterangan')}
                </div>

                <div class="history-category">
                  ${esc(t.Kategori || '-')}
                </div>

                <div class="history-meta">
                  ${esc(t.Tanggal || '')}
                </div>

              </div>


              <div class="
                history-amount
                ${jenisClass}
              ">
                ${jumlahPrefix}${rupiah(t.Jumlah)}
              </div>

            </div>


            <div class="history-bottom">

              <span>
                ${esc(t.Sumber || '-')}
              </span>

              <span class="
                history-badge
                ${jenisClass}
              ">
                ${esc(t.Jenis || '')}
              </span>

            </div>

          </div>
        `;

      }).join('')}

    </div>
  `;
}


/* =========================================================
   SIMPAN PEMASUKAN
========================================================= */

async function simpanPemasukan(){

  try{

    const payload = {

      tanggal:
        document.getElementById('masukTanggal').value,

      kategori:
        document.getElementById('masukKategori').value,

      keterangan:
        document.getElementById('masukKeterangan').value,

      jumlah:
        Number(
          document.getElementById('masukJumlah').value || 0
        ),

      metode:
        document.getElementById('masukMetode').value

    };


    if(payload.jumlah <= 0){

      showToast('Jumlah pemasukan harus lebih dari 0');

      return;
    }


    await api(
      'simpanPemasukan',
      payload
    );


    closeModal('modalTransaksi');

    showToast(
      'Pemasukan berhasil disimpan!'
    );


    await loadHistory();

    await loadDashboard();

  }catch(err){

    showError(err);

  }
}


/* =========================================================
   SIMPAN PENGELUARAN
========================================================= */

async function simpanPengeluaran(){

  try{

    const payload = {

      tanggal:
        document.getElementById('keluarTanggal').value,

      sumber:
        document.getElementById('keluarSumber').value,

      kategori:
        document.getElementById('keluarKategori').value,

      keterangan:
        document.getElementById('keluarKeterangan').value,

      jumlah:
        Number(
          document.getElementById('keluarJumlah').value || 0
        ),

      metode:
        document.getElementById('keluarMetode').value

    };


    if(payload.jumlah <= 0){

      showToast(
        'Jumlah pengeluaran harus lebih dari 0'
      );

      return;
    }


    await api(
      'simpanPengeluaran',
      payload
    );


    closeModal('modalPengeluaran');

    showToast(
      'Pengeluaran berhasil disimpan!'
    );


    await loadHistory();

    await loadDashboard();

  }catch(err){

    showError(err);

  }
}
