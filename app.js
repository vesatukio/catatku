/* =====================================================
   CATATKU — APP.JS
   OFFLINE FIRST + GOOGLE SHEET SYNC
===================================================== */

/* =====================================================
   KONFIGURASI
===================================================== */

const API_URL =
  "https://script.google.com/macros/s/AKfycbyW1qBf0LX3qPtSwRrvaxIuiIcHMFkuy9PViZ-YZrTfZeM6WqCNlfcNJN1CVzE7M1F3/exec";

const API_KEY =
  "CATATKU-2026-PRIBADI";

const STORAGE_KEY =
  "catatku_data";

const SYNC_KEY =
  "catatku_pending_sync";


/* =====================================================
   KATEGORI
===================================================== */

const KATEGORI_PEMASUKAN = [
  "Penjualan Toko",
  "Gaji/Komisi",
  "Investasi",
  "Lainnya"
];

const KATEGORI_PENGELUARAN = [
  "Belanja Stok",
  "Operasional",
  "Makan & Minum",
  "Tagihan & Listrik",
  "Lainnya"
];


/* =====================================================
   STATE
===================================================== */

let appData = {

  transaksi: [],

  barang: [],

  hutang: [],

  currentType: "PEMASUKAN"

};


/* =====================================================
   STATUS SYNC
===================================================== */

let syncState = {

  status: "LOCAL",

  pending: 0,

  lastSync: null

};


/* =====================================================
   LOAD LOCAL DATA
===================================================== */

function loadLocalData() {

  const saved =
    localStorage.getItem(STORAGE_KEY);

  if (saved) {

    try {

      const data =
        JSON.parse(saved);

      appData = {
        ...appData,
        ...data
      };

    } catch (e) {

      console.error(
        "Gagal membaca data lokal:",
        e
      );

    }

  }


  const pending =
    localStorage.getItem(SYNC_KEY);

  if (pending) {

    try {

      syncState.pending =
        JSON.parse(pending).length;

    } catch (e) {

      syncState.pending = 0;

    }

  }

}


/* =====================================================
   SAVE LOCAL
===================================================== */

function saveLocalData() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(appData)
  );

}


/* =====================================================
   PENDING DATA
===================================================== */

function getPendingRecords() {

  const saved =
    localStorage.getItem(SYNC_KEY);

  if (!saved) {
    return [];
  }

  try {

    const records =
      JSON.parse(saved);

    return Array.isArray(records)
      ? records
      : [];

  } catch (e) {

    return [];

  }

}


function savePendingRecords(records) {

  localStorage.setItem(
    SYNC_KEY,
    JSON.stringify(records)
  );

  syncState.pending =
    records.length;

}


/* =====================================================
   MASUKKAN DATA KE ANTRIAN SYNC
===================================================== */

function queueSync(record) {

  const records =
    getPendingRecords();

  /*
   * Cegah ID sama masuk dua kali
   */

  const exists =
    records.some(
      r => String(r.id) === String(record.id)
    );

  if (!exists) {

    records.push(record);

  }

  savePendingRecords(records);

  updateSyncIndicator();

}


/* =====================================================
   INDIKATOR STATUS
===================================================== */

function updateSyncIndicator() {

  let el =
    document.getElementById(
      "syncStatus"
    );

  /*
   * Jika HTML belum mempunyai indikator,
   * buat otomatis.
   */

  if (!el) {

    el =
      document.createElement("div");

    el.id =
      "syncStatus";

    el.className =
      "sync-status";

    document.body.appendChild(el);

  }


  const pending =
    getPendingRecords().length;

  if (!navigator.onLine) {

    syncState.status =
      "OFFLINE";

    el.textContent =
      `📱 Offline • ${pending} belum sync`;

    el.className =
      "sync-status offline";

    return;

  }


  if (pending > 0) {

    syncState.status =
      "PENDING";

    el.textContent =
      `⏳ ${pending} data belum tersimpan di Sheet`;

    el.className =
      "sync-status pending";

    return;

  }


  syncState.status =
    "SYNCED";

  el.textContent =
    "✓ Tersimpan di Sheet";

  el.className =
    "sync-status synced";

}


/* =====================================================
   INIT APP
===================================================== */

function initApp() {

  loadLocalData();

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const elTrxDate =
    document.getElementById(
      "trxTanggal"
    );

  if (elTrxDate) {

    elTrxDate.value =
      today;

  }


  renderCategories();

  updateDashboard();

  renderBarangList();

  renderHutangList();

  renderHistoryList();

  updateBarangSelects();

  updateSyncIndicator();


  setTimeout(() => {

    const loading =
      document.getElementById(
        "loading"
      );

    if (loading) {

      loading.classList.add(
        "hidden"
      );

    }

  }, 400);


  /*
   * Coba sync ketika aplikasi dibuka
   */

  if (navigator.onLine) {

    setTimeout(
      syncPendingData,
      1000
    );

  }

}


/* =====================================================
   SAVE DATA
===================================================== */

function saveData() {

  saveLocalData();

  updateDashboard();

  renderBarangList();

  renderHutangList();

  renderHistoryList();

  updateBarangSelects();

  updateSyncIndicator();

}


/* =====================================================
   RUPIAH
===================================================== */

function rupiah(number) {

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(
    Number(number) || 0
  );

}


/* =====================================================
   TOAST
===================================================== */

function showToast(message) {

  const toast =
    document.getElementById(
      "toast"
    );

  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  setTimeout(() => {

    toast.classList.remove(
      "show"
    );

  }, 2500);

}


/* =====================================================
   NAVIGATION
===================================================== */

function showPage(pageId) {

  document
    .querySelectorAll(".page")
    .forEach(
      page =>
        page.classList.remove(
          "active"
        )
    );

  const target =
    document.getElementById(
      `page-${pageId}`
    );

  if (target) {

    target.classList.add(
      "active"
    );

  }


  document
    .querySelectorAll(".nav-item")
    .forEach(
      item =>
        item.classList.remove(
          "active"
        )
    );


  const navMap = {

    dashboard: 0,

    add: 1,

    barang: 3

  };


  const navItems =
    document.querySelectorAll(
      ".bottom-nav .nav-item"
    );


  if (
    navMap[pageId] !== undefined &&
    navItems[navMap[pageId]]
  ) {

    navItems[
      navMap[pageId]
    ].classList.add(
      "active"
    );

  }


  window.scrollTo(
    0,
    0
  );

}


/* =====================================================
   REFRESH
===================================================== */

function refreshApp() {

  initApp();

  showToast(
    "Aplikasi diperbarui"
  );

}


/* =====================================================
   SYNC MANUAL
===================================================== */

function syncOffline() {

  if (!navigator.onLine) {

    showToast(
      "Tidak ada internet. Data tetap tersimpan di perangkat."
    );

    return;

  }

  syncPendingData();

}


/* =====================================================
   TRANSACTION TYPE
===================================================== */

function setTransactionType(type) {

  appData.currentType =
    type;

  const tabIncome =
    document.getElementById(
      "tabIncome"
    );

  const tabExpense =
    document.getElementById(
      "tabExpense"
    );


  if (
    type === "PEMASUKAN"
  ) {

    tabIncome?.classList.add(
      "active"
    );

    tabExpense?.classList.remove(
      "active"
    );

  } else {

    tabExpense?.classList.add(
      "active"
    );

    tabIncome?.classList.remove(
      "active"
    );

  }


  renderCategories();

}


/* =====================================================
   KATEGORI
===================================================== */

function renderCategories() {

  const select =
    document.getElementById(
      "trxKategori"
    );

  if (!select) {
    return;
  }


  const list =
    appData.currentType ===
    "PEMASUKAN"
      ? KATEGORI_PEMASUKAN
      : KATEGORI_PENGELUARAN;


  select.innerHTML =
    '<option value="">Pilih kategori</option>' +

    list
      .map(
        k =>
          `<option value="${k}">${k}</option>`
      )
      .join("");

}


/* =====================================================
   QUICK TRANSACTION
===================================================== */

function quickTransaction(type) {

  closeQuickAdd();

  setTransactionType(
    type
  );

  showPage(
    "add"
  );

}


/* =====================================================
   TRANSAKSI
===================================================== */

document
  .getElementById(
    "transactionForm"
  )
  ?.addEventListener(
    "submit",
    function(e) {

      e.preventDefault();


      const tanggal =
        document.getElementById(
          "trxTanggal"
        ).value;

      const kategori =
        document.getElementById(
          "trxKategori"
        ).value;

      const keterangan =
        document.getElementById(
          "trxKeterangan"
        ).value;

      const nominal =
        Number(
          document.getElementById(
            "trxNominal"
          ).value
        ) || 0;

      const rekening =
        document.getElementById(
          "trxRekening"
        ).value ||
        "Kas";


      const item = {

        id:
          crypto.randomUUID
            ? crypto.randomUUID()
            : String(
                Date.now()
              ),

        entity:
          "TRANSAKSI",

        type:
          appData.currentType,

        jenis:
          appData.currentType,

        tanggal,

        kategori,

        keterangan,

        nominal,

        rekening,

        sync:
          "LOCAL"

      };


      appData.transaksi.unshift(
        item
      );

      saveData();


      queueSync({

        id: item.id,

        entity:
          "TRANSAKSI",

        tanggal,

        jenis:
          appData.currentType,

        kategori,

        keterangan,

        nominal,

        rekening

      });


      showToast(
        navigator.onLine
          ? "Transaksi disimpan & menunggu sync"
          : "Transaksi tersimpan di perangkat"
      );


      this.reset();


      document.getElementById(
        "trxTanggal"
      ).value =
        new Date()
          .toISOString()
          .split("T")[0];


      showPage(
        "dashboard"
      );


      if (navigator.onLine) {

        syncPendingData();

      }

    }
  );


/* =====================================================
   DASHBOARD
===================================================== */

function updateDashboard() {

  let pemasukan = 0;

  let pengeluaran = 0;

  let penjualan = 0;


  appData.transaksi
    .forEach(t => {

      if (
        t.type ===
        "PEMASUKAN"
      ) {

        pemasukan +=
          Number(
            t.nominal
          ) || 0;


        if (
          t.kategori ===
          "Penjualan Toko"
        ) {

          penjualan +=
            Number(
              t.nominal
            ) || 0;

        }

      } else {

        pengeluaran +=
          Number(
            t.nominal
          ) || 0;

      }

    });


  const totalHutang =
    appData.hutang.reduce(
      (acc, h) =>
        acc +
        (
          Number(
            h.sisa ??
            h.nominal
          ) || 0
        ),
      0
    );


  const saldo =
    pemasukan -
    pengeluaran;


  setText(
    "saldo",
    rupiah(saldo)
  );

  setText(
    "totalPemasukan",
    rupiah(pemasukan)
  );

  setText(
    "totalPengeluaran",
    rupiah(pengeluaran)
  );

  setText(
    "totalPenjualan",
    rupiah(penjualan)
  );

  setText(
    "totalHutang",
    rupiah(totalHutang)
  );


  renderRecentTransactions();

}


/* =====================================================
   HELPER TEXT
===================================================== */

function setText(
  id,
  value
) {

  const el =
    document.getElementById(
      id
    );

  if (el) {

    el.textContent =
      value;

  }

}


/* =====================================================
   RECENT TRANSACTION
===================================================== */

function renderRecentTransactions() {

  const container =
    document.getElementById(
      "recentTransactions"
    );

  if (!container) {
    return;
  }


  const recent =
    appData.transaksi
      .slice(0, 5);


  if (!recent.length) {

    container.innerHTML =
      '<div class="empty">Belum ada transaksi</div>';

    return;

  }


  container.innerHTML =
    recent
      .map(
        t => `

      <div class="item-card">

        <div class="item-left">

          <div class="item-title">
            ${escapeHtml(
              t.keterangan || "-"
            )}
          </div>

          <div class="item-sub">
            ${t.tanggal || "-"}
            •
            ${escapeHtml(
              t.kategori || "-"
            )}
          </div>

        </div>

        <div class="item-amount ${
          t.type ===
          "PEMASUKAN"
            ? "amount-income"
            : "amount-expense"
        }">

          ${
            t.type ===
            "PEMASUKAN"
              ? "+"
              : "-"
          }

          ${rupiah(
            t.nominal
          )}

        </div>

      </div>

    `
      )
      .join("");

}


/* =====================================================
   BARANG
===================================================== */

function getBarangById(id) {

  return appData.barang.find(
    b =>
      String(b.id) ===
      String(id)
  );

}


/* =====================================================
   NORMALISASI NAMA BARANG
===================================================== */

function normalizeBarangName(
  nama
) {

  return String(
    nama || ""
  )
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


/* =====================================================
   CARI BARANG BERDASARKAN NAMA
===================================================== */

function findBarangByName(
  nama
) {

  const key =
    normalizeBarangName(
      nama
    );


  return appData.barang.find(
    b =>
      normalizeBarangName(
        b.nama
      ) === key
  );

}


/* =====================================================
   UPDATE SELECT BARANG
===================================================== */

function updateBarangSelects() {

  const jualSelect =
    document.getElementById(
      "jualBarang"
    );

  const belanjaSelect =
    document.getElementById(
      "belanjaBarang"
    );


  const options =
    '<option value="">Pilih barang</option>' +

    appData.barang
      .map(
        b =>
          `<option value="${b.id}">
            ${escapeHtml(b.nama)}
            (Stok: ${b.stok})
          </option>`
      )
      .join("");


  if (jualSelect) {

    jualSelect.innerHTML =
      options;

  }


  if (belanjaSelect) {

    belanjaSelect.innerHTML =
      options;

  }

}


/* =====================================================
   TAMBAH BARANG
===================================================== */

document
  .getElementById(
    "barangForm"
  )
  ?.addEventListener(
    "submit",
    function(e) {

      e.preventDefault();


      const nama =
        document.getElementById(
          "barangNama"
        ).value.trim();


      const hargaModal =
        Number(
          document.getElementById(
            "barangModalPrice"
          ).value
        ) || 0;


      const hargaJual =
        Number(
          document.getElementById(
            "barangJualPrice"
          ).value
        ) || 0;


      const stok =
        Number(
          document.getElementById(
            "barangStok"
          ).value
        ) || 0;


      if (!nama) {

        showToast(
          "Nama barang wajib diisi"
        );

        return;

      }


      /*
       * CEK DUPLIKAT DI LOKAL
       */

      const existing =
        findBarangByName(
          nama
        );


      if (existing) {

        /*
         * BARANG SUDAH ADA
         * TAMBAHKAN STOK
         */

        existing.stok =
          Number(
            existing.stok
          ) +
          stok;


        existing.hargaModal =
          hargaModal ||
          existing.hargaModal;


        existing.hargaJual =
          hargaJual ||
          existing.hargaJual;


        saveData();


        /*
         * Kirim perubahan sebagai edit
         */

        queueSync({

          id:
            existing.id,

          entity:
            "BARANG",

          action:
            "editBarang",

          nama:
            existing.nama,

          hargaModal:
            existing.hargaModal,

          hargaJual:
            existing.hargaJual,

          stok:
            existing.stok

        });


        closeModal(
          "barangModal"
        );

        this.reset();


        showToast(
          `Barang sudah ada. Stok menjadi ${existing.stok}.`
        );


        if (navigator.onLine) {

          syncPendingData();

        }

        return;

      }


      /*
       * BARANG BARU
       */

      const id =
        crypto.randomUUID
          ? crypto.randomUUID()
          : String(
              Date.now()
            );


      const barang = {

        id,

        nama,

        hargaModal,

        hargaJual,

        stok,

        sync:
          "LOCAL"

      };


      appData.barang.push(
        barang
      );


      saveData();


      queueSync({

        id,

        entity:
          "BARANG",

        tanggal:
          today(),

        nama,

        barangNama:
          nama,

        hargaModal,

        hargaJual,

        stok

      });


      closeModal(
        "barangModal"
      );

      this.reset();


      showToast(
        "Barang baru tersimpan di perangkat"
      );


      if (navigator.onLine) {

        syncPendingData();

      }

    }
  );


/* =====================================================
   RENDER BARANG
===================================================== */

function renderBarangList() {

  const container =
    document.getElementById(
      "barangList"
    );

  if (!container) {
    return;
  }


  if (!appData.barang.length) {

    container.innerHTML =
      '<div class="empty">Belum ada barang.</div>';

    return;

  }


  container.innerHTML =
    appData.barang
      .map(
        b => `

      <div class="product-item item-card">

        <div class="item-left">

          <div class="item-title">

            ${escapeHtml(
              b.nama
            )}

          </div>

          <div class="item-sub">

            Modal:
            ${rupiah(
              b.hargaModal
            )}

            |

            Jual:
            ${rupiah(
              b.hargaJual
            )}

          </div>

          <div class="item-sub">

            ${
              b.sync === "SYNCED"
                ? "✓ Tersimpan di Sheet"
                : "⏳ Belum sync"
            }

          </div>

        </div>


        <div class="item-amount">

          Stok:
          <strong>
            ${Number(
              b.stok
            ) || 0}
          </strong>


          <button
            type="button"
            class="btn-edit-barang"
            onclick="editBarang('${b.id}')"
          >
            ✏️ Edit
          </button>

        </div>

      </div>

    `
      )
      .join("");

}


/* =====================================================
   EDIT BARANG
===================================================== */

function editBarang(id) {

  const barang =
    getBarangById(id);


  if (!barang) {

    showToast(
      "Barang tidak ditemukan"
    );

    return;

  }


  /*
   * Jika modal edit belum ada,
   * buat otomatis.
   */

  let modal =
    document.getElementById(
      "editBarangModal"
    );


  if (!modal) {

    modal =
      document.createElement(
        "div"
      );

    modal.id =
      "editBarangModal";

    modal.className =
      "modal hidden";


    modal.innerHTML = `

      <div class="modal-content">

        <div class="modal-header">

          <h3>Edit Barang</h3>

          <button
            type="button"
            onclick="closeModal('editBarangModal')"
          >
            ×
          </button>

        </div>


        <form id="editBarangForm">

          <input
            type="hidden"
            id="editBarangId"
          >


          <label>
            Nama Barang
          </label>

          <input
            type="text"
            id="editBarangNama"
            required
          >


          <label>
            Harga Modal
          </label>

          <input
            type="number"
            id="editBarangModalPrice"
            min="0"
          >


          <label>
            Harga Jual
          </label>

          <input
            type="number"
            id="editBarangJualPrice"
            min="0"
          >


          <label>
            Stok Riil
          </label>

          <input
            type="number"
            id="editBarangStok"
            min="0"
            required
          >


          <div class="modal-actions">

            <button
              type="button"
              onclick="closeModal('editBarangModal')"
            >
              Batal
            </button>

            <button
              type="submit"
            >
              Simpan Perubahan
            </button>

          </div>

        </form>

      </div>

    `;


    document.body.appendChild(
      modal
    );


    document
      .getElementById(
        "editBarangForm"
      )
      .addEventListener(
        "submit",
        saveEditBarang
      );

  }


  document.getElementById(
    "editBarangId"
  ).value =
    barang.id;


  document.getElementById(
    "editBarangNama"
  ).value =
    barang.nama;


  document.getElementById(
    "editBarangModalPrice"
  ).value =
    barang.hargaModal;


  document.getElementById(
    "editBarangJualPrice"
  ).value =
    barang.hargaJual;


  document.getElementById(
    "editBarangStok"
  ).value =
    barang.stok;


  modal.classList.remove(
    "hidden"
  );

}


/* =====================================================
   SIMPAN EDIT BARANG
===================================================== */

function saveEditBarang(e) {

  e.preventDefault();


  const id =
    document.getElementById(
      "editBarangId"
    ).value;


  const nama =
    document.getElementById(
      "editBarangNama"
    ).value.trim();


  const hargaModal =
    Number(
      document.getElementById(
        "editBarangModalPrice"
      ).value
    ) || 0;


  const hargaJual =
    Number(
      document.getElementById(
        "editBarangJualPrice"
      ).value
    ) || 0;


  const stok =
    Number(
      document.getElementById(
        "editBarangStok"
      ).value
    ) || 0;


  const barang =
    getBarangById(id);


  if (!barang) {

    showToast(
      "Barang tidak ditemukan"
    );

    return;

  }


  /*
   * CEK NAMA DUPLIKAT
   */

  const duplicate =
    appData.barang.find(
      b =>
        String(b.id) !==
          String(id) &&
        normalizeBarangName(
          b.nama
        ) ===
          normalizeBarangName(
            nama
          )
    );


  if (duplicate) {

    showToast(
      "Nama barang sudah digunakan"
    );

    return;

  }


  barang.nama =
    nama;

  barang.hargaModal =
    hargaModal;

  barang.hargaJual =
    hargaJual;

  barang.stok =
    stok;

  barang.sync =
    "LOCAL";


  saveData();


  queueSync({

    id,

    entity:
      "BARANG",

    action:
      "editBarang",

    nama,

    hargaModal,

    hargaJual,

    stok

  });


  closeModal(
    "editBarangModal"
  );


  showToast(
    "Perubahan tersimpan di perangkat"
  );


  if (navigator.onLine) {

    syncPendingData();

  }

}


/* =====================================================
   PENJUALAN
===================================================== */

document
  .getElementById(
    "penjualanForm"
  )
  ?.addEventListener(
    "submit",
    function(e) {

      e.preventDefault();


      const barangId =
        document.getElementById(
          "jualBarang"
        ).value;


      const qty =
        Number(
          document.getElementById(
            "jualQty"
          ).value
        ) || 1;


      const harga =
        Number(
          document.getElementById(
            "jualHarga"
          ).value
        ) || 0;


      const pelanggan =
        document.getElementById(
          "jualPelanggan"
        ).value ||
        "Umum";


      const barang =
        getBarangById(
          barangId
        );


      if (!barang) {

        showToast(
          "Pilih barang terlebih dahulu"
        );

        return;

      }


      if (
        qty >
        Number(
          barang.stok
        )
      ) {

        showToast(
          "Stok tidak cukup"
        );

        return;

      }


      barang.stok -=
        qty;


      const total =
        qty *
        harga;


      const item = {

        id:
          crypto.randomUUID
            ? crypto.randomUUID()
            : String(
                Date.now()
              ),

        entity:
          "PENJUALAN",

        type:
          "PEMASUKAN",

        tanggal:
          today(),

        kategori:
          "Penjualan Toko",

        keterangan:
          `Penjualan ${barang.nama} x${qty} (${pelanggan})`,

        nominal:
          total,

        rekening:
          "Kas",

        barangId:
          barang.id,

        barangNama:
          barang.nama,

        qty,

        harga,

        pelanggan

      };


      appData.transaksi.unshift(
        item
      );


      saveData();


      queueSync({

        id:
          item.id,

        entity:
          "PENJUALAN",

        tanggal:
          item.tanggal,

        barangId:
          barang.id,

        barangNama:
          barang.nama,

        qty,

        harga,

        pelanggan

      });


      showToast(
        "Penjualan berhasil dicatat"
      );


      this.reset();


      document.getElementById(
        "jualQty"
      ).value =
        1;


      updateJualTotal();


      showPage(
        "dashboard"
      );


      if (navigator.onLine) {

        syncPendingData();

      }

    }
  );


/* =====================================================
   BELANJA STOK
===================================================== */

document
  .getElementById(
    "belanjaForm"
  )
  ?.addEventListener(
    "submit",
    function(e) {

      e.preventDefault();


      const barangId =
        document.getElementById(
          "belanjaBarang"
        ).value;


      const qty =
        Number(
          document.getElementById(
            "belanjaQty"
          ).value
        ) || 1;


      const harga =
        Number(
          document.getElementById(
            "belanjaHarga"
          ).value
        ) || 0;


      const supplier =
        document.getElementById(
          "belanjaSupplier"
        ).value ||
        "-";


      const barang =
        getBarangById(
          barangId
        );


      if (!barang) {

        showToast(
          "Pilih barang terlebih dahulu"
        );

        return;

      }


      barang.stok +=
        qty;


      const total =
        qty *
        harga;


      const item = {

        id:
          crypto.randomUUID
            ? crypto.randomUUID()
            : String(
                Date.now()
              ),

        entity:
          "BELANJA",

        type:
          "PENGELUARAN",

        tanggal:
          today(),

        kategori:
          "Belanja Stok",

        keterangan:
          `Belanja ${barang.nama} x${qty} (${supplier})`,

        nominal:
          total,

        rekening:
          "Kas",

        barangId:
          barang.id,

        barangNama:
          barang.nama,

        qty,

        harga,

        supplier

      };


      appData.transaksi.unshift(
        item
      );


      saveData();


      queueSync({

        id:
          item.id,

        entity:
          "BELANJA",

        tanggal:
          item.tanggal,

        barangId:
          barang.id,

        barangNama:
          barang.nama,

        qty,

        harga,

        supplier

      });


      showToast(
        "Belanja stok berhasil dicatat"
      );


      this.reset();


      document.getElementById(
        "belanjaQty"
      ).value =
        1;


      updateBelanjaTotal();


      showPage(
        "dashboard"
      );


      if (navigator.onLine) {

        syncPendingData();

      }

    }
  );


/* =====================================================
   HUTANG
===================================================== */

document
  .getElementById(
    "hutangForm"
  )
  ?.addEventListener(
    "submit",
    function(e) {

      e.preventDefault();


      const nama =
        document.getElementById(
          "hutangNama"
        ).value;


      const nominal =
        Number(
          document.getElementById(
            "hutangNominal"
          ).value
        ) || 0;


      const tempo =
        document.getElementById(
          "hutangTempo"
        ).value;


      const keterangan =
        document.getElementById(
          "hutangKeterangan"
        ).value;


      const id =
        crypto.randomUUID
          ? crypto.randomUUID()
          : String(
              Date.now()
            );


      const item = {

        id,

        entity:
          "HUTANG",

        nama,

        nominal,

        dibayar:
          0,

        tempo,

        jatuhTempo:
          tempo,

        keterangan,

        sisa:
          nominal

      };


      appData.hutang.push(
        item
      );


      saveData();


      queueSync({

        id,

        entity:
          "HUTANG",

        tanggal:
          today(),

        nama,

        nominal,

        dibayar:
          0,

        jatuhTempo:
          tempo,

        keterangan,

        status:
          "BELUM LUNAS"

      });


      closeModal(
        "hutangModal"
      );


      this.reset();


      showToast(
        "Hutang dicatat"
      );


      if (navigator.onLine) {

        syncPendingData();

      }

    }
  );


/* =====================================================
   RENDER HUTANG
===================================================== */

function renderHutangList() {

  const container =
    document.getElementById(
      "hutangList"
    );

  if (!container) {
    return;
  }


  if (!appData.hutang.length) {

    container.innerHTML =
      '<div class="empty">Belum ada hutang.</div>';

    return;

  }


  container.innerHTML =
    appData.hutang
      .map(
        h => `

      <div class="item-card">

        <div class="item-left">

          <div class="item-title">
            ${escapeHtml(
              h.nama
            )}
          </div>

          <div class="item-sub">

            Jatuh Tempo:
            ${h.tempo ||
              h.jatuhTempo ||
              "-"}

            ${
              h.keterangan
                ? " • " +
                  escapeHtml(
                    h.keterangan
                  )
                : ""
            }

          </div>

        </div>

        <div class="item-amount amount-expense">

          ${rupiah(
            h.sisa ??
            h.nominal
          )}

        </div>

      </div>

    `
      )
      .join("");

}


/* =====================================================
   HISTORY
===================================================== */

function renderHistoryList() {

  const container =
    document.getElementById(
      "historyList"
    );

  if (!container) {
    return;
  }


  if (!appData.transaksi.length) {

    container.innerHTML =
      '<div class="empty">Belum ada transaksi.</div>';

    return;

  }


  container.innerHTML =
    appData.transaksi
      .map(
        t => `

      <div class="transaction-item item-card">

        <div class="item-left">

          <div class="item-title">

            ${escapeHtml(
              t.keterangan || "-"
            )}

          </div>

          <div class="item-sub">

            ${t.tanggal || "-"}

            •

            ${escapeHtml(
              t.kategori || "-"
            )}

            ${
              t.rekening
                ? `(${escapeHtml(
                    t.rekening
                  )})`
                : ""
            }

          </div>

        </div>


        <div class="item-amount ${
          t.type ===
          "PEMASUKAN"
            ? "amount-income"
            : "amount-expense"
        }">

          ${
            t.type ===
            "PEMASUKAN"
              ? "+"
              : "-"
          }

          ${rupiah(
            t.nominal
          )}

        </div>

      </div>

    `
      )
      .join("");

}


/* =====================================================
   LAPORAN
===================================================== */

function loadReport() {

  const start =
    document.getElementById(
      "reportStart"
    )?.value ||
    "";


  const end =
    document.getElementById(
      "reportEnd"
    )?.value ||
    "";


  let list =
    appData.transaksi;


  if (start) {

    list =
      list.filter(
        t =>
          t.tanggal >= start
      );

  }


  if (end) {

    list =
      list.filter(
        t =>
          t.tanggal <= end
      );

  }


  let pem = 0;

  let peng = 0;


  list.forEach(t => {

    if (
      t.type ===
      "PEMASUKAN"
    ) {

      pem +=
        Number(
          t.nominal
        ) || 0;

    } else {

      peng +=
        Number(
          t.nominal
        ) || 0;

    }

  });


  const result =
    document.getElementById(
      "reportResult"
    );


  if (!result) {
    return;
  }


  result.innerHTML = `

    <div>

      <strong>
        Hasil Laporan
      </strong>

      <div>
        Total ${list.length} transaksi
      </div>

      <hr>

      <div>
        Pemasukan:
        <strong>
          ${rupiah(pem)}
        </strong>
      </div>

      <div>
        Pengeluaran:
        <strong>
          ${rupiah(peng)}
        </strong>
      </div>

      <hr>

      <div>
        Bersih:
        <strong>
          ${rupiah(pem - peng)}
        </strong>
      </div>

    </div>

  `;

}


/* =====================================================
   FILTER BARANG
===================================================== */

function filterBarang(
  keyword
) {

  keyword =
    String(
      keyword || ""
    )
      .toLowerCase()
      .trim();


  document
    .querySelectorAll(
      "#barangList .product-item"
    )
    .forEach(
      item => {

        item.style.display =
          item.textContent
            .toLowerCase()
            .includes(
              keyword
            )
              ? ""
              : "none";

      }
    );

}


/* =====================================================
   FILTER HISTORY
===================================================== */

function filterHistory(
  keyword
) {

  keyword =
    String(
      keyword || ""
    )
      .toLowerCase()
      .trim();


  document
    .querySelectorAll(
      "#historyList .transaction-item"
    )
    .forEach(
      item => {

        item.style.display =
          item.textContent
            .toLowerCase()
            .includes(
              keyword
            )
              ? ""
              : "none";

      }
    );

}


/* =====================================================
   TOTAL JUAL
===================================================== */

function updateJualTotal() {

  const qty =
    Number(
      document.getElementById(
        "jualQty"
      )?.value
    ) || 0;


  const harga =
    Number(
      document.getElementById(
        "jualHarga"
      )?.value
    ) || 0;


  const el =
    document.getElementById(
      "jualTotalPreview"
    );


  if (el) {

    el.textContent =
      rupiah(
        qty * harga
      );

  }

}


/* =====================================================
   TOTAL BELANJA
===================================================== */

function updateBelanjaTotal() {

  const qty =
    Number(
      document.getElementById(
        "belanjaQty"
      )?.value
    ) || 0;


  const harga =
    Number(
      document.getElementById(
        "belanjaHarga"
      )?.value
    ) || 0;


  const el =
    document.getElementById(
      "belanjaTotalPreview"
    );


  if (el) {

    el.textContent =
      rupiah(
        qty * harga
      );

  }

}


/* =====================================================
   INPUT EVENT
===================================================== */

document.addEventListener(
  "input",
  function(e) {

    if (
      e.target.id ===
      "jualQty" ||
      e.target.id ===
      "jualHarga"
    ) {

      updateJualTotal();

    }


    if (
      e.target.id ===
      "belanjaQty" ||
      e.target.id ===
      "belanjaHarga"
    ) {

      updateBelanjaTotal();

    }

  }
);


/* =====================================================
   CHANGE EVENT
===================================================== */

document.addEventListener(
  "change",
  function(e) {

    if (
      e.target.id ===
      "jualBarang"
    ) {

      const barang =
        getBarangById(
          e.target.value
        );


      if (barang) {

        const harga =
          document.getElementById(
            "jualHarga"
          );

        if (harga) {

          harga.value =
            barang.hargaJual ||
            0;

        }

      }


      updateJualTotal();

    }


    if (
      e.target.id ===
      "belanjaBarang"
    ) {

      const barang =
        getBarangById(
          e.target.value
        );


      if (barang) {

        const harga =
          document.getElementById(
            "belanjaHarga"
          );

        if (harga) {

          harga.value =
            barang.hargaModal ||
            0;

        }

      }


      updateBelanjaTotal();

    }

  }
);


/* =====================================================
   QUICK MENU
===================================================== */

function openQuickAdd() {

  document
    .getElementById(
      "quickAddMenu"
    )
    ?.classList.toggle(
      "show"
    );

}


function closeQuickAdd() {

  document
    .getElementById(
      "quickAddMenu"
    )
    ?.classList.remove(
      "show"
    );

}


/* =====================================================
   MORE MENU
===================================================== */

function showMoreMenu() {

  document
    .getElementById(
      "moreMenu"
    )
    ?.classList.remove(
      "hidden"
    );

}


function closeMoreMenu() {

  document
    .getElementById(
      "moreMenu"
    )
    ?.classList.add(
      "hidden"
    );

}


function openFromMenu(
  page
) {

  closeMoreMenu();

  showPage(
    page
  );

}


/* =====================================================
   MODAL
===================================================== */

function openModal(
  id
) {

  document
    .getElementById(
      id
    )
    ?.classList.remove(
      "hidden"
    );

}


function closeModal(
  id
) {

  document
    .getElementById(
      id
    )
    ?.classList.add(
      "hidden"
    );

}


/* =====================================================
   QUICK MENU OUTSIDE CLICK
===================================================== */

document.addEventListener(
  "click",
  function(e) {

    const menu =
      document.getElementById(
        "quickAddMenu"
      );

    const plus =
      document.querySelector(
        ".nav-plus"
      );


    if (
      menu &&
      menu.classList.contains(
        "show"
      ) &&
      !menu.contains(
        e.target
      ) &&
      plus &&
      !plus.contains(
        e.target
      )
    ) {

      closeQuickAdd();

    }

  }
);


/* =====================================================
   GOOGLE SHEET API
===================================================== */

async function callAPI(
  action,
  payload = {}
) {

  const url =
    `${API_URL}?key=${encodeURIComponent(
      API_KEY
    )}` +
    `&action=${encodeURIComponent(
      action
    )}` +
    `&payload=${encodeURIComponent(
      JSON.stringify(
        payload
      )
    )}`;


  const response =
    await fetch(
      url,
      {
        method: "GET",
        cache: "no-store"
      }
    );


  if (!response.ok) {

    throw new Error(
      "Server Google Sheet tidak merespons."
    );

  }


  const result =
    await response.json();


  if (!result.success) {

    throw new Error(
      result.error ||
      "Gagal mengakses Google Sheet."
    );

  }


  return result.data;

}


/* =====================================================
   SYNC PENDING
===================================================== */

async function syncPendingData() {

  if (!navigator.onLine) {

    updateSyncIndicator();

    return;

  }


  const records =
    getPendingRecords();


  if (!records.length) {

    updateSyncIndicator();

    return;

  }


  updateSyncIndicator();


  try {

    const result =
      await callAPI(
        "sync",
        {
          records
        }
      );


    if (
      !result ||
      !Array.isArray(
        result.results
      )
    ) {

      throw new Error(
        "Response sync tidak valid."
      );

    }


    const failed = [];


    result.results.forEach(
      item => {

        if (
          item.success
        ) {

          /*
           * Tandai barang lokal
           * sebagai sudah sync
           */

          const barang =
            appData.barang.find(
              b =>
                String(
                  b.id
                ) ===
                String(
                  item.id
                )
            );


          if (barang) {

            barang.sync =
              "SYNCED";

          }

        } else {

          const original =
            records.find(
              r =>
                String(
                  r.id
                ) ===
                String(
                  item.id
                )
            );


          if (original) {

            failed.push(
              original
            );

          }

        }

      }
    );


    savePendingRecords(
      failed
    );


    saveLocalData();


    syncState.lastSync =
      new Date()
        .toISOString();


    updateSyncIndicator();

    renderBarangList();


    if (failed.length) {

      showToast(
        `${failed.length} data belum berhasil sync`
      );

    } else {

      showToast(
        "✓ Semua data tersimpan di Sheet"
      );

    }


  } catch (error) {

    console.error(
      "SYNC ERROR:",
      error
    );


    updateSyncIndicator();


    showToast(
      "Belum bisa sync. Data tetap aman di perangkat."
    );

  }

}


/* =====================================================
   ONLINE / OFFLINE
===================================================== */

window.addEventListener(
  "online",
  function() {

    updateSyncIndicator();

    showToast(
      "Internet tersedia. Sinkronisasi..."
    );

    syncPendingData();

  }
);


window.addEventListener(
  "offline",
  function() {

    updateSyncIndicator();

    showToast(
      "Offline. Data tetap disimpan di perangkat."
    );

  }
);


/* =====================================================
   LOAD DATA DARI SHEET
===================================================== */

async function loadFromSheet() {

  if (!navigator.onLine) {

    return;

  }


  try {

    const data =
      await callAPI(
        "appData"
      );


    /*
     * Jangan menimpa data lokal
     * yang belum sync.
     */

    const pending =
      getPendingRecords();


    if (
      pending.length === 0
    ) {

      /*
       * Dashboard
       */

      if (
        data.dashboard
      ) {

        /*
         * Tidak perlu menyimpan dashboard
         * karena dihitung dari data lokal.
         */

      }


      /*
       * Barang
       */

      if (
        Array.isArray(
          data.barang
        )
      ) {

        appData.barang =
          data.barang.map(
            b => ({
              ...b,
              sync:
                "SYNCED"
            })
          );

      }


      /*
       * Hutang
       */

      if (
        Array.isArray(
          data.hutang
        )
      ) {

        appData.hutang =
          data.hutang;

      }


      saveLocalData();

      renderBarangList();

      renderHutangList();

      updateBarangSelects();

    }


    updateSyncIndicator();


  } catch (error) {

    console.error(
      "LOAD SHEET ERROR:",
      error
    );

  }

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =====================================================
   TODAY
===================================================== */

function today() {

  return new Date()
    .toISOString()
    .split("T")[0];

}


/* =====================================================
   DOM READY
===================================================== */

window.addEventListener(
  "DOMContentLoaded",
  async function() {

    initApp();

    /*
     * Ambil database utama dari Sheet.
     */

    if (navigator.onLine) {

      await loadFromSheet();

      await syncPendingData();

    }

  }
);
