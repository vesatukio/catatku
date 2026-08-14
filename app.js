/* =====================================================
   CATATKU
   OFFLINE FIRST + GOOGLE SHEET SYNC
   ===================================================== */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyW1qBf0LX3qPtSwRrvaxIuiIcHMFkuy9PViZ-YZrTfZeM6WqCNlfcNJN1CVzE7M1F3/exec";

const API_KEY =
  "CATATKU-2026-PRIBADI";


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
   APP STATE
===================================================== */

let appData = {

  transaksi: [],

  barang: [],

  hutang: [],

  syncQueue: [],

  currentType: "PEMASUKAN",

  lastSync: null

};


/* =====================================================
   LOCAL STORAGE
===================================================== */

function saveLocal() {

  localStorage.setItem(
    "catatku_data",
    JSON.stringify(appData)
  );

}


function loadLocal() {

  const saved =
    localStorage.getItem("catatku_data");

  if (!saved) return;

  try {

    const data =
      JSON.parse(saved);

    appData = {
      ...appData,
      ...data
    };

    if (!Array.isArray(appData.transaksi)) {
      appData.transaksi = [];
    }

    if (!Array.isArray(appData.barang)) {
      appData.barang = [];
    }

    if (!Array.isArray(appData.hutang)) {
      appData.hutang = [];
    }

    if (!Array.isArray(appData.syncQueue)) {
      appData.syncQueue = [];
    }

  } catch (e) {

    console.error(
      "Gagal membaca data lokal:",
      e
    );

  }

}


/* =====================================================
   ID
===================================================== */

function generateId(prefix = "cat") {

  return (
    prefix +
    "-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 8)
  );

}


/* =====================================================
   DATE
===================================================== */

function today() {

  return new Date()
    .toISOString()
    .split("T")[0];

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
  ).format(Number(number) || 0);

}


/* =====================================================
   TOAST
===================================================== */

function showToast(message) {

  const toast =
    document.getElementById("toast");

  if (!toast) return;

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {

    toast.classList.remove("show");

  }, 2500);

}


/* =====================================================
   SYNC STATUS INDICATOR
===================================================== */

function countPending() {

  return appData.syncQueue.filter(
    x => x.status !== "synced"
  ).length;

}


function updateSyncIndicator(
  mode = null
) {

  let indicator =
    document.getElementById(
      "syncIndicator"
    );

  /*
   * Kalau elemen belum ada di HTML,
   * buat otomatis.
   */
  if (!indicator) {

    indicator =
      document.createElement("div");

    indicator.id =
      "syncIndicator";

    indicator.style.cssText = `
      position:fixed;
      top:10px;
      right:10px;
      z-index:99999;
      padding:8px 12px;
      border-radius:20px;
      background:#fff;
      box-shadow:0 2px 10px rgba(0,0,0,.12);
      font-size:12px;
      font-weight:700;
      display:flex;
      align-items:center;
      gap:6px;
      max-width:260px;
    `;

    document.body.appendChild(
      indicator
    );

  }


  if (mode === "syncing") {

    indicator.innerHTML =
      "🔄 Menyinkronkan...";

    indicator.style.color =
      "#2563eb";

    return;
  }


  if (!navigator.onLine) {

    const pending =
      countPending();

    indicator.innerHTML =
      pending > 0
        ? `🔴 Offline • ${pending} menunggu`
        : "🔴 Offline • Data lokal";

    indicator.style.color =
      "#dc2626";

    return;
  }


  const pending =
    countPending();


  if (pending > 0) {

    indicator.innerHTML =
      `🟠 ${pending} data menunggu sinkronisasi`;

    indicator.style.color =
      "#d97706";

    return;

  }


  indicator.innerHTML =
    "🟢 Tersinkron ke Google Sheet";

  indicator.style.color =
    "#16a34a";

}


/* =====================================================
   LAST SYNC
===================================================== */

function getLastSyncText() {

  if (!appData.lastSync) {
    return "";
  }

  try {

    return new Date(
      appData.lastSync
    ).toLocaleString(
      "id-ID",
      {
        dateStyle: "short",
        timeStyle: "short"
      }
    );

  } catch (e) {

    return "";

  }

}


/* =====================================================
   SYNC QUEUE
===================================================== */

function queueRecord(
  record,
  localRef = null
) {

  const id =
    String(record.id);


  /*
   * Jangan memasukkan ID yang sama
   * dua kali ke antrean.
   */
  const existing =
    appData.syncQueue.find(
      x => String(x.id) === id
    );


  if (existing) {

    existing.record = record;

    existing.status = "pending";

    existing.localRef = localRef;

  } else {

    appData.syncQueue.push({

      id,

      record,

      status: "pending",

      localRef

    });

  }


  saveLocal();

  updateSyncIndicator();

}


/* =====================================================
   GAS REQUEST
===================================================== */

async function gasRequest(
  action,
  payload = {}
) {

  if (!navigator.onLine) {

    return null;

  }


  try {

    const params =
      new URLSearchParams();

    params.set(
      "key",
      API_KEY
    );

    params.set(
      "action",
      action
    );

    params.set(
      "payload",
      JSON.stringify(payload)
    );


    const response =
      await fetch(
        GAS_URL +
        "?" +
        params.toString(),
        {
          method: "GET",
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const result =
      await response.json();


    if (!result.success) {

      throw new Error(
        result.error ||
        "GAS error"
      );

    }


    return result.data;


  } catch (error) {

    console.error(
      "GAS:",
      error
    );

    return null;

  }

}


/* =====================================================
   SYNC LOCAL → SHEET
===================================================== */

async function syncToSheet() {

  if (!navigator.onLine) {

    updateSyncIndicator();

    return;

  }


  const pending =
    appData.syncQueue.filter(
      x => x.status !== "synced"
    );


  if (pending.length === 0) {

    updateSyncIndicator();

    return;

  }


  updateSyncIndicator(
    "syncing"
  );


  pending.forEach(item => {

    item.status =
      "syncing";

  });


  saveLocal();


  const records =
    pending.map(
      item => item.record
    );


  const result =
    await gasRequest(
      "sync",
      {
        records
      }
    );


  /*
   * Jika GAS gagal,
   * kembalikan menjadi pending.
   */
  if (!result) {

    pending.forEach(item => {

      item.status =
        "pending";

    });


    saveLocal();

    updateSyncIndicator();

    showToast(
      "Sync gagal. Data tetap aman di perangkat."
    );

    return;

  }


  /*
   * Tandai hasil satu per satu.
   */
  if (Array.isArray(result.results)) {

    result.results.forEach(
      item => {

        const queue =
          appData.syncQueue.find(
            x =>
              String(x.id) ===
              String(item.id)
          );


        if (!queue) return;


        if (item.success) {

          queue.status =
            "synced";

        } else {

          queue.status =
            "pending";

          console.error(
            "Sync gagal:",
            item.error
          );

        }

      }
    );

  }


  /*
   * Update status barang lokal.
   */
  appData.barang.forEach(
    barang => {

      const queue =
        appData.syncQueue.find(
          x =>
            String(x.id) ===
            String(barang.id)
        );


      if (
        queue &&
        queue.status === "synced"
      ) {

        barang.syncStatus =
          "synced";

      }

    }
  );


  /*
   * Update status hutang.
   */
  appData.hutang.forEach(
    hutang => {

      const queue =
        appData.syncQueue.find(
          x =>
            String(x.id) ===
            String(hutang.id)
        );


      if (
        queue &&
        queue.status === "synced"
      ) {

        hutang.syncStatus =
          "synced";

      }

    }
  );


  /*
   * Update status transaksi.
   */
  appData.transaksi.forEach(
    transaksi => {

      const queue =
        appData.syncQueue.find(
          x =>
            String(x.id) ===
            String(transaksi.id)
        );


      if (
        queue &&
        queue.status === "synced"
      ) {

        transaksi.syncStatus =
          "synced";

      }

    }
  );


  appData.lastSync =
    new Date().toISOString();


  saveLocal();


  updateSyncIndicator();


  if (result.failed > 0) {

    showToast(
      `Sync selesai: ${result.success} berhasil, ${result.failed} gagal`
    );

  } else {

    showToast(
      "✓ Semua data tersimpan ke Google Sheet"
    );

  }

}


/* =====================================================
   SHEET → LOCAL
===================================================== */

async function loadFromSheet() {

  if (!navigator.onLine) {

    return;

  }


  const data =
    await gasRequest(
      "appData"
    );


  if (!data) {

    return;

  }


  /*
   * TRANSAKSI
   */
  if (
    Array.isArray(data.history)
  ) {

    const sheetTransactions =
      data.history
        .filter(
          r =>
            String(r.entity)
              .toUpperCase() ===
            "TRANSAKSI"
        )
        .map(
          r => ({

            id: String(r.id),

            type:
              String(r.jenis)
                .toUpperCase() ===
              "PEMASUKAN"
                ? "PEMASUKAN"
                : "PENGELUARAN",

            tanggal:
              r.tanggal || "",

            kategori:
              r.kategori || "",

            keterangan:
              r.keterangan || "",

            nominal:
              Number(r.nominal) || 0,

            rekening:
              r.rekening || "Kas",

            syncStatus:
              "synced"

          })
        );


    mergeById(
      appData.transaksi,
      sheetTransactions
    );

  }


  /*
   * BARANG
   */
  if (
    Array.isArray(data.barang)
  ) {

    const sheetBarang =
      data.barang.map(
        b => ({

          id: String(b.id),

          nama:
            b.nama || "",

          hargaModal:
            Number(
              b.hargaModal
            ) || 0,

          hargaJual:
            Number(
              b.hargaJual
            ) || 0,

          stok:
            Number(b.stok) || 0,

          syncStatus:
            "synced"

        })
      );


    mergeById(
      appData.barang,
      sheetBarang
    );

  }


  /*
   * HUTANG
   */
  if (
    Array.isArray(data.hutang)
  ) {

    const sheetHutang =
      data.hutang.map(
        h => ({

          id: String(h.id),

          nama:
            h.nama || "",

          nominal:
            Number(
              h.nominal
            ) || 0,

          dibayar:
            Number(
              h.dibayar
            ) || 0,

          tempo:
            h.jatuhTempo || "",

          keterangan:
            h.keterangan || "",

          syncStatus:
            "synced"

        })
      );


    mergeById(
      appData.hutang,
      sheetHutang
    );

  }


  /*
   * Data lokal yang masih pending
   * TIDAK boleh ditimpa oleh Sheet.
   */
  appData.syncQueue
    .filter(
      q => q.status !== "synced"
    )
    .forEach(
      q => {

        const r =
          q.record;

        if (
          r.entity ===
          "BARANG"
        ) {

          const local =
            appData.barang.find(
              x =>
                String(x.id) ===
                String(r.id)
            );

          if (local) {

            local.syncStatus =
              "pending";

          }

        }

      }
    );


  appData.lastSync =
    new Date().toISOString();


  saveLocal();


  updateDashboard();
  renderBarangList();
  renderHutangList();
  renderHistoryList();
  updateBarangSelects();

}


/* =====================================================
   MERGE ARRAY BERDASARKAN ID
===================================================== */

function mergeById(
  localArray,
  remoteArray
) {

  const pendingIds =
    new Set(
      appData.syncQueue
        .filter(
          q =>
            q.status !==
            "synced"
        )
        .map(
          q =>
            String(q.id)
        )
    );


  const map =
    new Map();


  localArray.forEach(
    item => {

      map.set(
        String(item.id),
        item
      );

    }
  );


  remoteArray.forEach(
    item => {

      const id =
        String(item.id);


      /*
       * Jangan timpa data lokal
       * yang belum sync.
       */
      if (
        pendingIds.has(id)
      ) {

        return;

      }


      map.set(
        id,
        item
      );

    }
  );


  localArray.length = 0;

  map.forEach(
    item =>
      localArray.push(item)
  );

}


/* =====================================================
   INIT APP
===================================================== */

async function initApp() {

  loadLocal();


  /*
   * Render lokal dulu.
   */
  renderCategories();
  updateDashboard();
  renderBarangList();
  renderHutangList();
  renderHistoryList();
  updateBarangSelects();
  updateSyncIndicator();


  const date =
    document.getElementById(
      "trxTanggal"
    );

  if (date) {

    date.value =
      today();

  }


  /*
   * Jika online:
   * 1. ambil Sheet
   * 2. sync pending
   */
  if (navigator.onLine) {

    await loadFromSheet();

    await syncToSheet();

  }


  updateSyncIndicator();


  setTimeout(
    () => {

      const loading =
        document.getElementById(
          "loading"
        );

      if (loading) {

        loading.classList.add(
          "hidden"
        );

      }

    },
    400
  );

}


/* =====================================================
   TRANSACTION TYPE
===================================================== */

function setTransactionType(
  type
) {

  appData.currentType =
    type;


  const income =
    document.getElementById(
      "tabIncome"
    );

  const expense =
    document.getElementById(
      "tabExpense"
    );


  if (
    type ===
    "PEMASUKAN"
  ) {

    income?.classList.add(
      "active"
    );

    expense?.classList.remove(
      "active"
    );

  } else {

    expense?.classList.add(
      "active"
    );

    income?.classList.remove(
      "active"
    );

  }


  renderCategories();

}


/* =====================================================
   CATEGORIES
===================================================== */

function renderCategories() {

  const select =
    document.getElementById(
      "trxKategori"
    );

  if (!select) return;


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
          `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`
      )
      .join("");

}


/* =====================================================
   QUICK TRANSACTION
===================================================== */

function quickTransaction(
  type
) {

  closeQuickAdd();

  setTransactionType(
    type
  );

  showPage("add");

}


/* =====================================================
   TAMBAH TRANSAKSI
===================================================== */

function tambahTransaksiLocal(
  p
) {

  const id =
    String(
      p.id ||
      generateId("trx")
    );


  const item = {

    id,

    type:
      p.type ||
      p.tipe ||
      p.jenis ||
      "PENGELUARAN",

    tanggal:
      p.tanggal ||
      today(),

    kategori:
      p.kategori ||
      "",

    keterangan:
      p.keterangan ||
      "",

    nominal:
      Number(
        p.nominal
      ) || 0,

    rekening:
      p.rekening ||
      "Kas",

    syncStatus:
      "pending"

  };


  appData.transaksi.unshift(
    item
  );


  queueRecord(
    {
      id,
      entity:
        "TRANSAKSI",
      tanggal:
        item.tanggal,
      jenis:
        item.type,
      kategori:
        item.kategori,
      keterangan:
        item.keterangan,
      nominal:
        item.nominal,
      rekening:
        item.rekening
    }
  );


  saveLocal();


  updateDashboard();
  renderHistoryList();

}


/* =====================================================
   TRANSACTION FORM
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
        )?.value ||
        today();


      const kategori =
        document.getElementById(
          "trxKategori"
        )?.value ||
        "";


      const keterangan =
        document.getElementById(
          "trxKeterangan"
        )?.value ||
        "";


      const nominal =
        Number(
          document.getElementById(
            "trxNominal"
          )?.value
        ) || 0;


      const rekening =
        document.getElementById(
          "trxRekening"
        )?.value ||
        "Kas";


      if (
        nominal <= 0
      ) {

        showToast(
          "Nominal harus diisi"
        );

        return;

      }


      tambahTransaksiLocal({

        id:
          generateId("trx"),

        type:
          appData.currentType,

        tanggal,

        kategori,

        keterangan,

        nominal,

        rekening

      });


      showToast(
        "Transaksi tersimpan di perangkat"
      );


      this.reset();


      const date =
        document.getElementById(
          "trxTanggal"
        );

      if (date) {

        date.value =
          today();

      }


      showPage(
        "dashboard"
      );


      syncToSheet();

    }
  );


/* =====================================================
   DASHBOARD
===================================================== */

function updateDashboard() {

  let pemasukan = 0;

  let pengeluaran = 0;

  let penjualan = 0;


  appData.transaksi.forEach(
    t => {

      const nominal =
        Number(
          t.nominal
        ) || 0;


      if (
        t.type ===
        "PEMASUKAN"
      ) {

        pemasukan +=
          nominal;


        if (
          t.kategori ===
          "Penjualan Toko"
        ) {

          penjualan +=
            nominal;

        }

      } else {

        pengeluaran +=
          nominal;

      }

    }
  );


  const totalHutang =
    appData.hutang.reduce(
      (
        total,
        h
      ) => {

        const sisa =
          Math.max(
            0,
            Number(
              h.nominal
            ) -
            Number(
              h.dibayar || 0
            )
          );

        return total +
          sisa;

      },
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
   RECENT TRANSACTIONS
===================================================== */

function renderRecentTransactions() {

  const container =
    document.getElementById(
      "recentTransactions"
    );

  if (!container) return;


  const recent =
    appData.transaksi
      .slice(0, 5);


  if (
    recent.length === 0
  ) {

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
                t.keterangan ||
                "-"
              )}
            </div>

            <div class="item-sub">
              ${escapeHtml(
                t.tanggal || ""
              )}
              •
              ${escapeHtml(
                t.kategori || ""
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
            ${rupiah(t.nominal)}

          </div>

        </div>

      `
      )
      .join("");

}


/* =====================================================
   BARANG
===================================================== */

function getBarangSyncStatus(
  id
) {

  const queue =
    appData.syncQueue.find(
      x =>
        String(x.id) ===
        String(id)
    );


  if (
    queue &&
    queue.status !==
    "synced"
  ) {

    return "pending";

  }


  return "synced";

}


/* =====================================================
   UPDATE BARANG SELECT
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
        b => `

          <option value="${escapeHtml(
            b.id
          )}">

            ${escapeHtml(
              b.nama
            )}

            (Stok:
            ${Number(
              b.stok
            ) || 0})

          </option>

        `
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
        )?.value.trim();


      const hargaModal =
        Number(
          document.getElementById(
            "barangModalPrice"
          )?.value
        ) || 0;


      const hargaJual =
        Number(
          document.getElementById(
            "barangJualPrice"
          )?.value
        ) || 0;


      const stok =
        Number(
          document.getElementById(
            "barangStok"
          )?.value
        ) || 0;


      if (!nama) {

        showToast(
          "Nama barang harus diisi"
        );

        return;

      }


      const id =
        generateId("barang");


      const barang = {

        id,

        nama,

        hargaModal,

        hargaJual,

        stok,

        stokAwal:
          stok,

        syncStatus:
          "pending"

      };


      appData.barang.push(
        barang
      );


      /*
       * Record BARANG ke Sheet
       */
      queueRecord(
        {

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

          stokAwal:
            stok

        }
      );


      saveLocal();


      renderBarangList();
      updateBarangSelects();


      closeModal(
        "barangModal"
      );


      this.reset();


      showToast(
        "Barang tersimpan di perangkat"
      );


      syncToSheet();

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

  if (!container) return;


  if (
    appData.barang.length ===
    0
  ) {

    container.innerHTML =
      '<div class="empty">Belum ada barang.</div>';

    return;

  }


  container.innerHTML =
    appData.barang
      .map(
        b => {

          const status =
            getBarangSyncStatus(
              b.id
            );


          const badge =
            status ===
            "synced"

              ? `<div style="
                   color:#16a34a;
                   font-size:12px;
                   font-weight:700;
                   margin-top:5px;">
                   🟢 Tersimpan di Sheet
                 </div>`

              : `<div style="
                   color:#d97706;
                   font-size:12px;
                   font-weight:700;
                   margin-top:5px;">
                   🟠 Menunggu sinkronisasi
                 </div>`;


          return `

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

                ${badge}

              </div>


              <div class="item-amount">

                Stok:
                <strong>
                  ${Number(
                    b.stok
                  ) || 0}
                </strong>

              </div>

            </div>

          `;

        }
      )
      .join("");

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
        )?.value;


      const qty =
        Number(
          document.getElementById(
            "jualQty"
          )?.value
        ) || 1;


      const harga =
        Number(
          document.getElementById(
            "jualHarga"
          )?.value
        ) || 0;


      const pelanggan =
        document.getElementById(
          "jualPelanggan"
        )?.value ||
        "Umum";


      const barang =
        appData.barang.find(
          b =>
            String(b.id) ===
            String(barangId)
        );


      if (!barang) {

        showToast(
          "Pilih barang"
        );

        return;

      }


      if (
        qty <= 0
      ) {

        showToast(
          "Qty tidak valid"
        );

        return;

      }


      if (
        qty >
        Number(barang.stok)
      ) {

        showToast(
          "Stok tidak mencukupi"
        );

        return;

      }


      const tanggal =
        today();


      const penjualanId =
        generateId(
          "jual"
        );


      const transaksiId =
        generateId(
          "trx"
        );


      const total =
        qty * harga;


      /*
       * Update stok lokal.
       */
      barang.stok =
        Number(
          barang.stok
        ) -
        qty;


      /*
       * RECORD PENJUALAN
       */
      queueRecord(
        {

          id:
            penjualanId,

          entity:
            "PENJUALAN",

          tanggal,

          barangId:
            barang.id,

          barangNama:
            barang.nama,

          qty,

          harga,

          pelanggan

        }
      );


      /*
       * RECORD TRANSAKSI KEUANGAN
       */
      const transaksi = {

        id:
          transaksiId,

        type:
          "PEMASUKAN",

        tanggal,

        kategori:
          "Penjualan Toko",

        keterangan:
          `Penjualan ${barang.nama} x${qty} (${pelanggan})`,

        nominal:
          total,

        rekening:
          "Kas",

        syncStatus:
          "pending"

      };


      appData.transaksi.unshift(
        transaksi
      );


      queueRecord(
        {

          id:
            transaksiId,

          entity:
            "TRANSAKSI",

          tanggal,

          jenis:
            "PEMASUKAN",

          kategori:
            "Penjualan Toko",

          keterangan:
            transaksi.keterangan,

          nominal:
            total,

          rekening:
            "Kas"

        }
      );


      saveLocal();


      updateDashboard();
      renderBarangList();
      renderHistoryList();
      updateBarangSelects();


      this.reset();


      const qtyEl =
        document.getElementById(
          "jualQty"
        );

      if (qtyEl) {

        qtyEl.value =
          1;

      }


      updateJualTotal();


      showToast(
        "Penjualan tersimpan di perangkat"
      );


      showPage(
        "dashboard"
      );


      syncToSheet();

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
        )?.value;


      const qty =
        Number(
          document.getElementById(
            "belanjaQty"
          )?.value
        ) || 1;


      const harga =
        Number(
          document.getElementById(
            "belanjaHarga"
          )?.value
        ) || 0;


      const supplier =
        document.getElementById(
          "belanjaSupplier"
        )?.value ||
        "-";


      const barang =
        appData.barang.find(
          b =>
            String(b.id) ===
            String(barangId)
        );


      if (!barang) {

        showToast(
          "Pilih barang"
        );

        return;

      }


      const tanggal =
        today();


      const belanjaId =
        generateId(
          "belanja"
        );


      const transaksiId =
        generateId(
          "trx"
        );


      const total =
        qty * harga;


      /*
       * Update stok lokal.
       */
      barang.stok =
        Number(
          barang.stok
        ) +
        qty;


      /*
       * RECORD BELANJA
       */
      queueRecord(
        {

          id:
            belanjaId,

          entity:
            "BELANJA",

          tanggal,

          barangId:
            barang.id,

          barangNama:
            barang.nama,

          qty,

          harga,

          supplier

        }
      );


      /*
       * RECORD PENGELUARAN
       */
      const transaksi = {

        id:
          transaksiId,

        type:
          "PENGELUARAN",

        tanggal,

        kategori:
          "Belanja Stok",

        keterangan:
          `Belanja ${barang.nama} x${qty} (${supplier})`,

        nominal:
          total,

        rekening:
          "Kas",

        syncStatus:
          "pending"

      };


      appData.transaksi.unshift(
        transaksi
      );


      queueRecord(
        {

          id:
            transaksiId,

          entity:
            "TRANSAKSI",

          tanggal,

          jenis:
            "PENGELUARAN",

          kategori:
            "Belanja Stok",

          keterangan:
            transaksi.keterangan,

          nominal:
            total,

          rekening:
            "Kas"

        }
      );


      saveLocal();


      updateDashboard();
      renderBarangList();
      renderHistoryList();
      updateBarangSelects();


      this.reset();


      const qtyEl =
        document.getElementById(
          "belanjaQty"
        );

      if (qtyEl) {

        qtyEl.value =
          1;

      }


      updateBelanjaTotal();


      showToast(
        "Belanja stok tersimpan di perangkat"
      );


      showPage(
        "dashboard"
      );


      syncToSheet();

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
        )?.value.trim();


      const nominal =
        Number(
          document.getElementById(
            "hutangNominal"
          )?.value
        ) || 0;


      const tempo =
        document.getElementById(
          "hutangTempo"
        )?.value ||
        "";


      const keterangan =
        document.getElementById(
          "hutangKeterangan"
        )?.value ||
        "";


      if (
        !nama ||
        nominal <= 0
      ) {

        showToast(
          "Data hutang belum lengkap"
        );

        return;

      }


      const id =
        generateId(
          "hutang"
        );


      const hutang = {

        id,

        nama,

        nominal,

        dibayar:
          0,

        tempo,

        keterangan,

        syncStatus:
          "pending"

      };


      appData.hutang.push(
        hutang
      );


      queueRecord(
        {

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

        }
      );


      saveLocal();


      renderHutangList();
      updateDashboard();


      closeModal(
        "hutangModal"
      );


      this.reset();


      showToast(
        "Hutang tersimpan di perangkat"
      );


      syncToSheet();

    }
  );


/* =====================================================
   BAYAR HUTANG
   Jika HTML Anda mempunyai form pembayaran
===================================================== */

function bayarHutangLocal(
  hutangId,
  nominal,
  rekening = "Kas"
) {

  const hutang =
    appData.hutang.find(
      h =>
        String(h.id) ===
        String(hutangId)
    );


  if (!hutang) {

    showToast(
      "Hutang tidak ditemukan"
    );

    return;

  }


  nominal =
    Number(nominal) || 0;


  const sisa =
    Number(
      hutang.nominal
    ) -
    Number(
      hutang.dibayar || 0
    );


  if (
    nominal <= 0 ||
    nominal > sisa
  ) {

    showToast(
      "Nominal pembayaran tidak valid"
    );

    return;

  }


  const id =
    generateId(
      "bayar"
    );


  hutang.dibayar =
    Number(
      hutang.dibayar || 0
    ) +
    nominal;


  queueRecord(
    {

      id,

      entity:
        "BAYAR_HUTANG",

      tanggal:
        today(),

      nominal,

      keterangan:
        String(
          hutangId
        ),

      rekening

    }
  );


  saveLocal();


  renderHutangList();
  updateDashboard();


  showToast(
    "Pembayaran hutang tersimpan"
  );


  syncToSheet();

}


/* =====================================================
   RENDER HUTANG
===================================================== */

function renderHutangList() {

  const container =
    document.getElementById(
      "hutangList"
    );

  if (!container) return;


  if (
    appData.hutang.length ===
    0
  ) {

    container.innerHTML =
      '<div class="empty">Belum ada hutang.</div>';

    return;

  }


  container.innerHTML =
    appData.hutang
      .filter(
        h =>
          Number(
            h.nominal
          ) >
          Number(
            h.dibayar || 0
          )
      )
      .map(
        h => {

          const sisa =
            Math.max(
              0,
              Number(
                h.nominal
              ) -
              Number(
                h.dibayar || 0
              )
            );


          const queue =
            appData.syncQueue.find(
              x =>
                String(x.id) ===
                String(h.id)
            );


          const status =
            queue &&
            queue.status !==
            "synced"

              ? `<div style="
                    color:#d97706;
                    font-size:12px;
                    font-weight:700;">
                    🟠 Menunggu sinkronisasi
                 </div>`

              : `<div style="
                    color:#16a34a;
                    font-size:12px;
                    font-weight:700;">
                    🟢 Tersimpan di Sheet
                 </div>`;


          return `

            <div class="item-card">

              <div class="item-left">

                <div class="item-title">
                  ${escapeHtml(
                    h.nama
                  )}
                </div>

                <div class="item-sub">

                  Jatuh Tempo:
                  ${escapeHtml(
                    h.tempo || "-"
                  )}

                  ${
                    h.keterangan
                      ? " • " +
                        escapeHtml(
                          h.keterangan
                        )
                      : ""
                  }

                </div>

                <div style="
                  margin-top:5px;
                  font-size:12px;">
                  Dibayar:
                  ${rupiah(
                    h.dibayar
                  )}
                </div>

                ${status}

              </div>


              <div class="item-amount amount-expense">

                Sisa:
                ${rupiah(sisa)}

              </div>

            </div>

          `;

        }
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

  if (!container) return;


  if (
    appData.transaksi.length ===
    0
  ) {

    container.innerHTML =
      '<div class="empty">Belum ada transaksi.</div>';

    return;

  }


  container.innerHTML =
    appData.transaksi
      .map(
        t => {

          const queue =
            appData.syncQueue.find(
              x =>
                String(x.id) ===
                String(t.id)
            );


          const status =
            queue &&
            queue.status !==
            "synced"

              ? "🟠"

              : "🟢";


          return `

            <div class="transaction-item item-card">

              <div class="item-left">

                <div class="item-title">

                  ${escapeHtml(
                    t.keterangan ||
                    "-"
                  )}

                </div>

                <div class="item-sub">

                  ${escapeHtml(
                    t.tanggal ||
                    ""
                  )}

                  •

                  ${escapeHtml(
                    t.kategori ||
                    ""
                  )}

                  (${escapeHtml(
                    t.rekening ||
                    "Kas"
                  )})

                </div>

                <div style="
                  font-size:11px;
                  margin-top:4px;">
                  ${status}
                  ${
                    queue &&
                    queue.status !==
                    "synced"
                      ? "Menunggu sinkronisasi"
                      : "Tersimpan di Sheet"
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

          `;

        }
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
          t.tanggal >=
          start
      );

  }


  if (end) {

    list =
      list.filter(
        t =>
          t.tanggal <=
          end
      );

  }


  let pem =
    0;

  let peng =
    0;


  list.forEach(
    t => {

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

    }
  );


  const result =
    document.getElementById(
      "reportResult"
    );


  if (!result) return;


  result.innerHTML = `

    <div style="
      display:flex;
      flex-direction:column;
      gap:8px;">

      <div style="
        font-size:15px;
        font-weight:700;">
        Hasil Laporan
      </div>

      <div style="
        font-size:13px;
        color:var(--text-muted);">

        Total ${list.length}
        Transaksi

      </div>

      <hr style="
        border:none;
        border-top:1px solid var(--border-color);
        margin:4px 0;">

      <div style="
        display:flex;
        justify-content:space-between;
        font-size:14px;">

        <span>Pemasukan:</span>

        <strong style="
          color:#059669;">

          ${rupiah(pem)}

        </strong>

      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        font-size:14px;">

        <span>Pengeluaran:</span>

        <strong style="
          color:#dc2626;">

          ${rupiah(peng)}

        </strong>

      </div>

      <hr style="
        border:none;
        border-top:1px solid var(--border-color);
        margin:4px 0;">

      <div style="
        display:flex;
        justify-content:space-between;
        font-size:15px;
        font-weight:700;">

        <span>Laba / Bersih:</span>

        <span style="
          color:${
            pem - peng >= 0
              ? "#059669"
              : "#dc2626"
          }">

          ${rupiah(
            pem - peng
          )}

        </span>

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
            .includes(keyword)
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
            .includes(keyword)
              ? ""
              : "none";

      }
    );

}


/* =====================================================
   TOTAL PREVIEW
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
        appData.barang.find(
          x =>
            String(x.id) ===
            String(
              e.target.value
            )
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
        appData.barang.find(
          x =>
            String(x.id) ===
            String(
              e.target.value
            )
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
   OFFLINE / ONLINE
===================================================== */

window.addEventListener(
  "offline",
  function() {

    updateSyncIndicator();

    showToast(
      "🔴 Offline — data disimpan di perangkat"
    );

  }
);


window.addEventListener(
  "online",
  function() {

    updateSyncIndicator();

    showToast(
      "🟢 Internet kembali"
    );


    setTimeout(
      async () => {

        await syncToSheet();

      },
      1000
    );

  }
);


/* =====================================================
   MANUAL SYNC
===================================================== */

async function syncOffline() {

  if (!navigator.onLine) {

    showToast(
      "🔴 Offline — data tetap aman di perangkat"
    );

    updateSyncIndicator();

    return;

  }


  await syncToSheet();

}


/* =====================================================
   REFRESH
===================================================== */

async function refreshApp() {

  await initApp();

  showToast(
    "Aplikasi diperbarui"
  );

}


/* =====================================================
   PAGE NAVIGATION
===================================================== */

function showPage(
  pageId
) {

  document
    .querySelectorAll(
      ".page"
    )
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
    .querySelectorAll(
      ".nav-item"
    )
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
    navMap[pageId] !==
    undefined &&
    navItems[
      navMap[pageId]
    ]
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
   POPUP
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
   CLICK OUTSIDE
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
      plus &&
      menu.classList.contains(
        "show"
      ) &&
      !menu.contains(
        e.target
      ) &&
      !plus.contains(
        e.target
      )
    ) {

      closeQuickAdd();

    }

  }
);


/* =====================================================
   HELPERS
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


function escapeHtml(
  value
) {

  return String(
    value ??
    ""
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
   START
===================================================== */

window.addEventListener(
  "DOMContentLoaded",
  initApp
);
