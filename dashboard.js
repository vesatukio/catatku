async function loadDashboard(){

  try{

    const d = await api('dashboard');

    DATA.dashboard = d;

    document.getElementById('saldo').textContent =
      rupiah(d.saldo);

    document.getElementById('masukHari').textContent =
      rupiah(d.pemasukanHariIni);

    document.getElementById('keluarHari').textContent =
      rupiah(d.pengeluaranHariIni);

    document.getElementById('saldoPribadi').textContent =
      rupiah(d.saldoPribadi);

    document.getElementById('saldoToko').textContent =
      rupiah(d.saldoToko);

    document.getElementById('totalHutang').textContent =
      rupiah(d.totalHutang);

    document.getElementById('nilaiStok').textContent =
      rupiah(d.nilaiStok);

    document.getElementById('jumlahBarang').textContent =
      Number(d.jumlahBarang || 0);

    await loadLabaBulan();

    await loadHistoryDashboard();

    await loadNotifikasiDashboard();

  }catch(err){

    showError(err);

  }

}


async function loadLabaBulan(){

  try{

    const d = await api(
      'laporanLaba',
      {
        mulai: firstDayMonth(),
        akhir: todayDate()
      }
    );

    document.getElementById('labaBulan').textContent =
      rupiah(d.labaKotor);

  }catch(err){

    console.error('Gagal memuat laba:', err);

  }

}


async function loadHistoryDashboard(){

  try{

    const data = await api('history');

    DATA.history = Array.isArray(data)
      ? data
      : [];

    renderHistoryDashboard();

  }catch(err){

    console.error(
      'Gagal memuat transaksi dashboard:',
      err
    );

  }

}


function renderHistoryDashboard(){

  const el =
    document.getElementById('historyDashboard');

  if(!el) return;


  if(
    !DATA.history ||
    !DATA.history.length
  ){

    el.innerHTML = `
      <div class="dashboard-empty">

        <div class="dashboard-empty-icon">
          💰
        </div>

        <div class="dashboard-empty-title">
          Belum ada transaksi
        </div>

        <div class="dashboard-empty-text">
          Pemasukan dan pengeluaran akan muncul di sini.
        </div>

      </div>
    `;

    return;
  }


  const dataTampil =
    tampilkanSemuaHistoryFlag
      ? DATA.history
      : DATA.history.slice(0, 5);


  el.innerHTML = `

    <div class="dashboard-history-list">

      ${dataTampil.map((t, index) => {

        const masuk =
          String(t.Jenis || '') === 'Masuk';

        const warnaClass =
          masuk
            ? 'dashboard-masuk'
            : 'dashboard-keluar';

        const tanda =
          masuk ? '+' : '-';

        const icon =
          masuk ? '💰' : '💸';


        const idData =
          t.id !== undefined
            ? t.id
            : index;


        return `

          <div class="dashboard-history-item">

            <div class="
              dashboard-history-icon
              ${warnaClass}
            ">
              ${icon}
            </div>


            <div class="dashboard-history-info">

              <div class="dashboard-history-title">
                ${esc(
                  t.Keterangan ||
                  t.Kategori ||
                  'Transaksi'
                )}
              </div>

              <div class="dashboard-history-detail">

                ${esc(t.Kategori || '-')}

                ${t.Sumber
                  ? ' · ' + esc(t.Sumber)
                  : ''
                }

                ${t.Metode
                  ? ' · ' + esc(t.Metode)
                  : ''
                }

              </div>

              <div class="dashboard-history-date">
                ${esc(t.Tanggal || '')}
              </div>

            </div>


            <div class="dashboard-history-right">

              <div class="
                dashboard-history-amount
                ${warnaClass}
              ">
                ${tanda}${rupiah(t.Jumlah)}
              </div>

              <div class="dashboard-history-actions">

                <button
                  class="history-edit-btn"
                  onclick="editTransaksi('${esc(idData)}')"
                >
                  Edit
                </button>

                <button
                  class="history-delete-btn"
                  onclick="hapusTransaksi('${esc(idData)}')"
                >
                  Hapus
                </button>

              </div>

            </div>

          </div>

        `;

      }).join('')}

    </div>

    ${
      DATA.history.length > 5
      ?
      `
        <button
          id="btnToggleHistory"
          class="history-see-all"
          onclick="toggleHistoryDashboard()"
        >
          ${
            tampilkanSemuaHistoryFlag
              ? 'Sembunyikan'
              : `Lihat Semua (${DATA.history.length})`
          }
        </button>
      `
      :
      ''
    }

  `;

}


function toggleHistoryDashboard(){

  tampilkanSemuaHistoryFlag =
    !tampilkanSemuaHistoryFlag;

  renderHistoryDashboard();

}


function editTransaksi(id){

  const item =
    DATA.history.find(
      (t, i) =>
        (
          t.id !== undefined
            ? String(t.id) === String(id)
            : String(i) === String(id)
        )
    );


  if(!item){

    showToast(
      'Data transaksi tidak ditemukan'
    );

    return;
  }


  /*
   * Untuk sementara fungsi edit
   * tetap menggunakan mekanisme lama.
   *
   * API edit belum diubah.
   */

  if(
    confirm(
      `Edit transaksi:\n\n` +
      `${item.Keterangan || item.Kategori}\n` +
      `${rupiah(item.Jumlah)}`
    )
  ){

    console.log(
      'Data transaksi:',
      item
    );

    showToast(
      'Fitur edit siap dikembangkan'
    );

  }

}


async function hapusTransaksi(id){

  if(
    !confirm(
      'Apakah Anda yakin ingin menghapus transaksi ini?'
    )
  ){

    return;

  }


  try{

    await api(
      'hapusTransaksi',
      {
        id: id
      }
    );


    showToast(
      'Transaksi berhasil dihapus'
    );


    await loadDashboard();


    if(
      typeof loadHistory === 'function'
    ){

      await loadHistory();

    }


  }catch(err){

    console.error(err);

    showError(err);

  }

}
