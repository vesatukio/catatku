/* =====================================================
   CATATKU
   OFFLINE FIRST + GOOGLE SHEET SYNC
   ===================================================== */

/* =====================================================
   KONFIGURASI GAS
===================================================== */

const CATATKU_CONFIG = {
  // GANTI dengan URL Web App GAS Anda
  // Contoh:
  // https://script.google.com/macros/s/XXXXXXXXXXXX/exec
  GAS_URL: "https://script.google.com/macros/s/AKfycbyW1qBf0LX3qPtSwRrvaxIuiIcHMFkuy9PViZ-YZrTfZeM6WqCNlfcNJN1CVzE7M1F3/exec",

  API_KEY: "CATATKU-2026-PRIBADI",

  STORAGE_KEY: "catatku_data",
  SYNC_KEY: "catatku_last_sync",

  AUTO_SYNC: true,
  SYNC_INTERVAL: 30000
};


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

let isSyncing = false;


/* =====================================================
   UTIL ID
===================================================== */

function generateLocalId(prefix = "ctk") {
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
   LOCAL STORAGE
===================================================== */

function loadLocalData() {

  const saved =
    localStorage.getItem(
      CATATKU_CONFIG.STORAGE_KEY
    );

  if (!saved) return;

  try {

    const parsed = JSON.parse(saved);

    appData = {
      ...appData,
      ...parsed
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

  } catch (err) {

    console.error(
      "Gagal membaca data lokal:",
      err
    );

  }
}


/* =====================================================
   NORMALISASI STATUS SYNC
===================================================== */

function normalizeSyncStatus(item) {

  if (!item.syncStatus) {
    item.syncStatus = "pending";
  }

  return item;
}


function normalizeAllLocalData() {

  appData.transaksi =
    appData.transaksi.map(normalizeSyncStatus);

  appData.barang =
    appData.barang.map(normalizeSyncStatus);

  appData.hutang =
    appData.hutang.map(normalizeSyncStatus);
}


/* =====================================================
   SIMPAN LOCAL
===================================================== */

function saveLocalOnly() {

  localStorage.setItem(
    CATATKU_CONFIG.STORAGE_KEY,
    JSON.stringify(appData)
  );
}


/* =====================================================
   SAVE DATA
===================================================== */

function saveData() {

  normalizeAllLocalData();

  saveLocalOnly();

  updateDashboard();
  renderBarangList();
  renderHutangList();
  renderHistoryList();
  updateBarangSelects();

  updateSyncIndicator();

  /*
   * Jangan menunggu server.
   * Data langsung tersimpan di HP.
   */
  if (
    CATATKU_CONFIG.AUTO_SYNC &&
    navigator.onLine
  ) {

    setTimeout(() => {
      syncOffline(true);
    }, 300);
  }
}


/* =====================================================
   INIT APP
===================================================== */

async function initApp() {

  loadLocalData();

  normalizeAllLocalData();

  saveLocalOnly();

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const elTrxDate =
    document.getElementById("trxTanggal");

  if (elTrxDate) {
    elTrxDate.value = today;
  }

  renderCategories();
  updateDashboard();
  renderBarangList();
  renderHutangList();
  renderHistoryList();
  updateBarangSelects();

  updateSyncIndicator();

  /*
   * Jika online:
   * 1. kirim data pending
   * 2. ambil data terbaru dari Sheet
   */
  if (
    navigator.onLine &&
    isGasConfigured()
  ) {

    setTimeout(async () => {

      await syncOffline(true);
      await loadServerData();

    }, 500);

  }

  setTimeout(() => {

    const loading =
      document.getElementById("loading");

    if (loading) {
      loading.classList.add("hidden");
    }

  }, 400);
}


/* =====================================================
   CEK GAS
===================================================== */

function isGasConfigured() {

  return (
    CATATKU_CONFIG.GAS_URL &&
    CATATKU_CONFIG.GAS_URL.indexOf(
      "script.google.com"
    ) !== -1 &&
    CATATKU_CONFIG.GAS_URL.indexOf(
      "/exec"
    ) !== -1
  );
}


/* =====================================================
   FORMAT RUPIAH
===================================================== */

function rupiah(number) {

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(number || 0);

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
   STATUS SYNC
===================================================== */

function getPendingCount() {

  let count = 0;

  appData.transaksi.forEach(x => {
    if (x.syncStatus !== "synced") count++;
  });

  appData.barang.forEach(x => {
    if (x.syncStatus !== "synced") count++;
  });

  appData.hutang.forEach(x => {
    if (x.syncStatus !== "synced") count++;
  });

  return count;
}


function updateSyncIndicator() {

  const pending =
    getPendingCount();

  const online =
    navigator.onLine;

  /*
   * Cari beberapa ID umum jika HTML
   * Anda sudah memilikinya.
   */

  const status =
    document.getElementById(
      "syncStatus"
    );

  const text =
    document.getElementById(
      "syncStatusText"
    );

  if (status) {

    status.classList.remove(
      "online",
      "offline",
      "syncing",
      "pending"
    );

    if (isSyncing) {

      status.classList.add("syncing");

    } else if (!online) {

      status.classList.add("offline");

    } else if (pending > 0) {

      status.classList.add("pending");

    } else {

      status.classList.add("online");

    }

  }

  if (text) {

    if (isSyncing) {

      text.textContent =
        "Menyinkronkan...";

    } else if (!online) {

      text.textContent =
        pending > 0
          ? `Offline • ${pending} menunggu`
          : "Offline";

    } else if (pending > 0) {

      text.textContent =
        `${pending} data menunggu sync`;

    } else {

      text.textContent =
        "Tersinkron";

    }

  }
}


/* =====================================================
   PAGE NAVIGATION
===================================================== */

function showPage(pageId) {

  document
    .querySelectorAll(".page")
    .forEach(page =>
      page.classList.remove("active")
    );

  const target =
    document.getElementById(
      `page-${pageId}`
    );

  if (target) {
    target.classList.add("active");
  }

  document
    .querySelectorAll(".nav-item")
    .forEach(item =>
      item.classList.remove("active")
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
    ].classList.add("active");

  }

  window.scrollTo(0, 0);
}


function refreshApp() {

  initApp();

  showToast(
    "Aplikasi diperbarui"
  );

}


/* =====================================================
   TRANSACTION TYPE
===================================================== */

function setTransactionType(type) {

  appData.currentType = type;

  const tabIncome =
    document.getElementById(
      "tabIncome"
    );

  const tabExpense =
    document.getElementById(
      "tabExpense"
    );

  if (type === "PEMASUKAN") {

    tabIncome?.classList.add("active");
    tabExpense?.classList.remove("active");

  } else {

    tabExpense?.classList.add("active");
    tabIncome?.classList.remove("active");

  }

  renderCategories();
}


function renderCategories() {

  const select =
    document.getElementById(
      "trxKategori"
    );

  if (!select) return;

  const list =
    appData.currentType === "PEMASUKAN"
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


function quickTransaction(type) {

  closeQuickAdd();

  setTransactionType(type);

  showPage("add");
}


/* =====================================================
   TRANSAKSI
===================================================== */

document
  .getElementById("transactionForm")
  ?.addEventListener(
    "submit",
    function (e) {

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
        ).value || "Kas";

      if (!nominal || nominal <= 0) {

        showToast(
          "Nominal belum diisi"
        );

        return;
      }

      const item = {

        id: generateLocalId("trx"),

        type:
          appData.currentType,

        tanggal,

        kategori,

        keterangan,

        nominal,

        rekening,

        syncStatus: "pending"

      };

      appData.transaksi.unshift(item);

      saveData();

      showToast(
        navigator.onLine
          ? "Tersimpan, sedang sync..."
          : "Tersimpan di perangkat"
      );

      this.reset();

      document.getElementById(
        "trxTanggal"
      ).value =
        new Date()
          .toISOString()
          .split("T")[0];

      showPage("dashboard");

    }
  );


/* =====================================================
   DASHBOARD
===================================================== */

function updateDashboard() {

  let pemasukan = 0;
  let pengeluaran = 0;
  let penjualan = 0;

  appData.transaksi.forEach(t => {

    const nominal =
      Number(t.nominal) || 0;

    if (
      t.type === "PEMASUKAN"
    ) {

      pemasukan += nominal;

      if (
        t.kategori ===
        "Penjualan Toko"
      ) {

        penjualan += nominal;

      }

    } else if (
      t.type === "PENGELUARAN"
    ) {

      pengeluaran += nominal;

    }

  });

  const totalHutang =
    appData.hutang.reduce(
      (acc, h) =>
        acc +
        Math.max(
          0,
          (Number(h.nominal) || 0) -
          (Number(h.dibayar) || 0)
        ),
      0
    );

  const saldo =
    pemasukan -
    pengeluaran;

  const saldoEl =
    document.getElementById(
      "saldo"
    );

  const pemasukanEl =
    document.getElementById(
      "totalPemasukan"
    );

  const pengeluaranEl =
    document.getElementById(
      "totalPengeluaran"
    );

  const penjualanEl =
    document.getElementById(
      "totalPenjualan"
    );

  const hutangEl =
    document.getElementById(
      "totalHutang"
    );

  if (saldoEl)
    saldoEl.textContent =
      rupiah(saldo);

  if (pemasukanEl)
    pemasukanEl.textContent =
      rupiah(pemasukan);

  if (pengeluaranEl)
    pengeluaranEl.textContent =
      rupiah(pengeluaran);

  if (penjualanEl)
    penjualanEl.textContent =
      rupiah(penjualan);

  if (hutangEl)
    hutangEl.textContent =
      rupiah(totalHutang);

  renderRecentTransactions();
}


function renderRecentTransactions() {

  const container =
    document.getElementById(
      "recentTransactions"
    );

  if (!container) return;

  const recent =
    appData.transaksi.slice(0, 5);

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
              ${escapeHtml(
                t.tanggal || "-"
              )}
              •
              ${escapeHtml(
                t.kategori || "-"
              )}
            </div>

          </div>

          <div class="item-amount ${
            t.type === "PEMASUKAN"
              ? "amount-income"
              : "amount-expense"
          }">

            ${
              t.type === "PEMASUKAN"
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
            (Stok: ${Number(b.stok) || 0})
          </option>`
      )
      .join("");

  if (jualSelect)
    jualSelect.innerHTML =
      options;

  if (belanjaSelect)
    belanjaSelect.innerHTML =
      options;
}


/* =====================================================
   TAMBAH BARANG
===================================================== */

document
  .getElementById("barangForm")
  ?.addEventListener(
    "submit",
    function (e) {

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
          "Nama barang belum diisi"
        );

        return;
      }

      appData.barang.push({

        id: generateLocalId("brg"),

        nama,

        hargaModal,

        hargaJual,

        stok,

        syncStatus: "pending"

      });

      saveData();

      closeModal(
        "barangModal"
      );

      this.reset();

      showToast(
        navigator.onLine
          ? "Barang disimpan, sync..."
          : "Barang tersimpan di perangkat"
      );

    }
  );


function renderBarangList() {

  const container =
    document.getElementById(
      "barangList"
    );

  if (!container) return;

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
              ${escapeHtml(b.nama)}
            </div>

            <div class="item-sub">
              Modal:
              ${rupiah(b.hargaModal)}
              |
              Jual:
              ${rupiah(b.hargaJual)}
            </div>

          </div>

          <div class="item-amount">

            Stok:
            <strong>
              ${Number(b.stok) || 0}
            </strong>

          </div>

        </div>

      `
      )
      .join("");
}


/* =====================================================
   PENJUALAN
===================================================== */

document
  .getElementById("penjualanForm")
  ?.addEventListener(
    "submit",
    function (e) {

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
        qty <= 0 ||
        harga <= 0
      ) {

        showToast(
          "Qty atau harga tidak valid"
        );

        return;
      }

      if (
        Number(barang.stok) < qty
      ) {

        showToast(
          "Stok tidak mencukupi"
        );

        return;
      }

      barang.stok =
        Number(barang.stok) -
        qty;

      const total =
        qty * harga;

      /*
       * Transaksi lokal untuk dashboard.
       */
      appData.transaksi.unshift({

        id: generateLocalId("jual"),

        type: "PEMASUKAN",

        tanggal:
          new Date()
            .toISOString()
            .split("T")[0],

        kategori:
          "Penjualan Toko",

        keterangan:
          `Penjualan ${barang.nama} x${qty} (${pelanggan})`,

        nominal: total,

        rekening: "Kas",

        /*
         * Data asli untuk GAS.
         */
        serverEntity:
          "PENJUALAN",

        barangId:
          barang.id,

        barangNama:
          barang.nama,

        qty,

        harga,

        pelanggan,

        syncStatus: "pending"

      });

      /*
       * Barang juga harus disinkronkan
       * agar server mendapatkan perubahan.
       *
       * Untuk versi GAS saat ini stok dihitung
       * dari BARANG + BELANJA - PENJUALAN.
       * Karena itu transaksi penjualan di atas
       * sudah cukup menjadi sumber stok server.
       */

      saveData();

      this.reset();

      const qtyEl =
        document.getElementById(
          "jualQty"
        );

      if (qtyEl)
        qtyEl.value = 1;

      updateJualTotal();

      showToast(
        navigator.onLine
          ? "Penjualan disimpan, sync..."
          : "Penjualan tersimpan offline"
      );

      showPage("dashboard");

    }
  );


/* =====================================================
   BELANJA
===================================================== */

document
  .getElementById("belanjaForm")
  ?.addEventListener(
    "submit",
    function (e) {

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
        qty <= 0 ||
        harga <= 0
      ) {

        showToast(
          "Qty atau harga tidak valid"
        );

        return;
      }

      barang.stok =
        Number(barang.stok) +
        qty;

      const total =
        qty * harga;

      appData.transaksi.unshift({

        id: generateLocalId("belanja"),

        type: "PENGELUARAN",

        tanggal:
          new Date()
            .toISOString()
            .split("T")[0],

        kategori:
          "Belanja Stok",

        keterangan:
          `Belanja ${barang.nama} x${qty} (${supplier})`,

        nominal: total,

        rekening: "Kas",

        serverEntity:
          "BELANJA",

        barangId:
          barang.id,

        barangNama:
          barang.nama,

        qty,

        harga,

        supplier,

        syncStatus: "pending"

      });

      saveData();

      this.reset();

      const qtyEl =
        document.getElementById(
          "belanjaQty"
        );

      if (qtyEl)
        qtyEl.value = 1;

      updateBelanjaTotal();

      showToast(
        navigator.onLine
          ? "Belanja disimpan, sync..."
          : "Belanja tersimpan offline"
      );

      showPage("dashboard");

    }
  );


/* =====================================================
   HUTANG
===================================================== */

document
  .getElementById("hutangForm")
  ?.addEventListener(
    "submit",
    function (e) {

      e.preventDefault();

      const nama =
        document.getElementById(
          "hutangNama"
        ).value.trim();

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

      if (
        !nama ||
        nominal <= 0
      ) {

        showToast(
          "Data hutang belum lengkap"
        );

        return;
      }

      appData.hutang.push({

        id: generateLocalId("hutang"),

        nama,

        nominal,

        dibayar: 0,

        tempo,

        jatuhTempo: tempo,

        keterangan,

        syncStatus: "pending"

      });

      saveData();

      closeModal(
        "hutangModal"
      );

      this.reset();

      showToast(
        navigator.onLine
          ? "Hutang disimpan, sync..."
          : "Hutang tersimpan offline"
      );

    }
  );


function renderHutangList() {

  const container =
    document.getElementById(
      "hutangList"
    );

  if (!container) return;

  if (!appData.hutang.length) {

    container.innerHTML =
      '<div class="empty">Belum ada hutang.</div>';

    return;
  }

  container.innerHTML =
    appData.hutang
      .map(
        h => {

          const sisa =
            Math.max(
              0,
              (Number(h.nominal) || 0) -
              (Number(h.dibayar) || 0)
            );

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
                    h.tempo ||
                    h.jatuhTempo ||
                    "-"
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

              </div>

              <div class="item-amount amount-expense">

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
                t.keterangan ||
                "-"
              )}
            </div>

            <div class="item-sub">

              ${escapeHtml(
                t.tanggal ||
                "-"
              )}

              •
              ${escapeHtml(
                t.kategori ||
                "-"
              )}

              ${
                t.rekening
                  ? ` (${escapeHtml(
                      t.rekening
                    )})`
                  : ""
              }

            </div>

          </div>

          <div class="item-amount ${
            t.type === "PEMASUKAN"
              ? "amount-income"
              : "amount-expense"
          }">

            ${
              t.type === "PEMASUKAN"
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
   REPORT
===================================================== */

function loadReport() {

  const start =
    document.getElementById(
      "reportStart"
    )?.value || "";

  const end =
    document.getElementById(
      "reportEnd"
    )?.value || "";

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

    const nominal =
      Number(t.nominal) || 0;

    if (
      t.type === "PEMASUKAN"
    ) {

      pem += nominal;

    } else {

      peng += nominal;

    }

  });

  const result =
    document.getElementById(
      "reportResult"
    );

  if (!result) return;

  result.innerHTML = `

    <div style="
      display:flex;
      flex-direction:column;
      gap:8px;
    ">

      <div style="
        font-size:15px;
        font-weight:700;
      ">
        Hasil Laporan
      </div>

      <div style="
        font-size:13px;
        color:var(--text-muted);
      ">
        Total ${list.length} Transaksi
      </div>

      <hr style="
        border:none;
        border-top:1px solid var(--border-color);
        margin:4px 0;
      ">

      <div style="
        display:flex;
        justify-content:space-between;
        font-size:14px;
      ">

        <span>Pemasukan:</span>

        <strong style="
          color:#059669
        ">
          ${rupiah(pem)}
        </strong>

      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        font-size:14px;
      ">

        <span>Pengeluaran:</span>

        <strong style="
          color:#dc2626
        ">
          ${rupiah(peng)}
        </strong>

      </div>

      <hr style="
        border:none;
        border-top:1px solid var(--border-color);
        margin:4px 0;
      ">

      <div style="
        display:flex;
        justify-content:space-between;
        font-size:15px;
        font-weight:700;
      ">

        <span>Laba / Bersih:</span>

        <span style="
          color:${pem - peng >= 0
            ? "#059669"
            : "#dc2626"}
        ">
          ${rupiah(pem - peng)}
        </span>

      </div>

    </div>

  `;

}


/* =====================================================
   FILTER
===================================================== */

function filterBarang(keyword) {

  keyword =
    String(keyword || "")
      .toLowerCase()
      .trim();

  document
    .querySelectorAll(
      "#barangList .product-item"
    )
    .forEach(item => {

      item.style.display =
        item.textContent
          .toLowerCase()
          .includes(keyword)
          ? ""
          : "none";

    });

}


function filterHistory(keyword) {

  keyword =
    String(keyword || "")
      .toLowerCase()
      .trim();

  document
    .querySelectorAll(
      "#historyList .transaction-item"
    )
    .forEach(item => {

      item.style.display =
        item.textContent
          .toLowerCase()
          .includes(keyword)
          ? ""
          : "none";

    });

}


/* =====================================================
   TOTAL
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
      rupiah(qty * harga);

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
      rupiah(qty * harga);

  }

}


/* =====================================================
   INPUT / CHANGE
===================================================== */

document.addEventListener(
  "input",
  function (e) {

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


document.addEventListener(
  "change",
  function (e) {

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

        const hargaEl =
          document.getElementById(
            "jualHarga"
          );

        if (hargaEl) {

          hargaEl.value =
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

        const hargaEl =
          document.getElementById(
            "belanjaHarga"
          );

        if (hargaEl) {

          hargaEl.value =
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
  "online",
  async function () {

    updateSyncIndicator();

    showToast(
      "Internet kembali. Sinkronisasi..."
    );

    await syncOffline(true);

    await loadServerData();

  }
);


window.addEventListener(
  "offline",
  function () {

    updateSyncIndicator();

    showToast(
      "Offline. Data tetap disimpan di perangkat."
    );

  }
);


/* =====================================================
   SYNC MANUAL
===================================================== */

async function syncOffline(silent = false) {

  if (isSyncing) return;

  if (!navigator.onLine) {

    updateSyncIndicator();

    if (!silent) {

      showToast(
        "Tidak ada internet. Data tetap aman di perangkat."
      );

    }

    return;

  }

  if (!isGasConfigured()) {

    if (!silent) {

      showToast(
        "URL GAS belum diatur."
      );

    }

    return;

  }

  const pending = [];

  /*
   * TRANSAKSI
   */
  appData.transaksi.forEach(t => {

    if (
      t.syncStatus !==
      "synced"
    ) {

      pending.push(
        convertTransactionToServer(t)
      );

    }

  });


  /*
   * BARANG
   */
  appData.barang.forEach(b => {

    if (
      b.syncStatus !==
      "synced"
    ) {

      pending.push(
        convertBarangToServer(b)
      );

    }

  });


  /*
   * HUTANG
   */
  appData.hutang.forEach(h => {

    if (
      h.syncStatus !==
      "synced"
    ) {

      pending.push(
        convertHutangToServer(h)
      );

    }

  });


  if (!pending.length) {

    updateSyncIndicator();

    if (!silent) {

      showToast(
        "Semua data sudah tersinkron."
      );

    }

    return;

  }


  isSyncing = true;

  updateSyncIndicator();

  /*
   * Tandai lokal sebagai syncing.
   */

  markLocalSyncing(
    pending
  );


  try {

    /*
     * Kirim maksimal 10 data sekali jalan.
     * GAS Anda menggunakan GET + payload,
     * sehingga jangan mengirim terlalu besar.
     */

    const BATCH_SIZE = 10;

    for (
      let i = 0;
      i < pending.length;
      i += BATCH_SIZE
    ) {

      const batch =
        pending.slice(
          i,
          i + BATCH_SIZE
        );

      const response =
        await callGas(
          "sync",
          {
            records: batch
          }
        );

      if (
        !response ||
        !response.success
      ) {

        throw new Error(
          response?.error ||
          "Sync gagal."
        );

      }

      /*
       * Tandai yang berhasil.
       */

      markBatchSynced(
        batch
      );

      saveLocalOnly();

      updateSyncIndicator();

    }


    if (!silent) {

      showToast(
        `✅ ${pending.length} data berhasil disinkronkan`
      );

    }

  } catch (err) {

    console.error(
      "SYNC ERROR:",
      err
    );

    markBatchPending(
      pending
    );

    saveLocalOnly();

    if (!silent) {

      showToast(
        "Sync gagal. Data tetap aman di perangkat."
      );

    }

  } finally {

    isSyncing = false;

    updateSyncIndicator();

  }

}


/* =====================================================
   CONVERT TRANSACTION
===================================================== */

function convertTransactionToServer(t) {

  /*
   * Penjualan dan belanja memiliki entity khusus.
   */

  if (
    t.serverEntity ===
    "PENJUALAN"
  ) {

    return {

      id: t.id,

      entity:
        "PENJUALAN",

      tanggal:
        t.tanggal,

      barangId:
        t.barangId,

      barangNama:
        t.barangNama,

      qty:
        Number(t.qty) || 0,

      harga:
        Number(t.harga) || 0,

      pelanggan:
        t.pelanggan || ""

    };

  }


  if (
    t.serverEntity ===
    "BELANJA"
  ) {

    return {

      id: t.id,

      entity:
        "BELANJA",

      tanggal:
        t.tanggal,

      barangId:
        t.barangId,

      barangNama:
        t.barangNama,

      qty:
        Number(t.qty) || 0,

      harga:
        Number(t.harga) || 0,

      supplier:
        t.supplier || ""

    };

  }


  /*
   * TRANSAKSI biasa.
   */

  return {

    id: t.id,

    entity:
      "TRANSAKSI",

    tanggal:
      t.tanggal,

    jenis:
      t.type,

    kategori:
      t.kategori || "",

    keterangan:
      t.keterangan || "",

    nominal:
      Number(t.nominal) || 0,

    rekening:
      t.rekening || "Kas"

  };

}


/* =====================================================
   CONVERT BARANG
===================================================== */

function convertBarangToServer(b) {

  return {

    id: b.id,

    entity:
      "BARANG",

    tanggal:
      new Date()
        .toISOString()
        .split("T")[0],

    nama:
      b.nama || "",

    barangNama:
      b.nama || "",

    hargaModal:
      Number(
        b.hargaModal
      ) || 0,

    hargaJual:
      Number(
        b.hargaJual
      ) || 0,

    stokAwal:
      Number(
        b.stok
      ) || 0

  };

}


/* =====================================================
   CONVERT HUTANG
===================================================== */

function convertHutangToServer(h) {

  return {

    id: h.id,

    entity:
      "HUTANG",

    tanggal:
      h.tanggal ||
      new Date()
        .toISOString()
        .split("T")[0],

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

    jatuhTempo:
      h.jatuhTempo ||
      h.tempo ||
      "",

    keterangan:
      h.keterangan || "",

    status:
      "BELUM LUNAS"

  };

}


/* =====================================================
   MARK SYNC
===================================================== */

function markLocalSyncing(
  records
) {

  const ids =
    new Set(
      records.map(
        r =>
          String(r.id)
      )
    );

  appData.transaksi.forEach(
    t => {

      if (
        ids.has(
          String(t.id)
        )
      ) {

        t.syncStatus =
          "syncing";

      }

    }
  );

  appData.barang.forEach(
    b => {

      if (
        ids.has(
          String(b.id)
        )
      ) {

        b.syncStatus =
          "syncing";

      }

    }
  );

  appData.hutang.forEach(
    h => {

      if (
        ids.has(
          String(h.id)
        )
      ) {

        h.syncStatus =
          "syncing";

      }

    }
  );

  saveLocalOnly();

}


function markBatchSynced(
  records
) {

  const ids =
    new Set(
      records.map(
        r =>
          String(r.id)
      )
    );

  appData.transaksi.forEach(
    t => {

      if (
        ids.has(
          String(t.id)
        )
      ) {

        t.syncStatus =
          "synced";

      }

    }
  );

  appData.barang.forEach(
    b => {

      if (
        ids.has(
          String(b.id)
        )
      ) {

        b.syncStatus =
          "synced";

      }

    }
  );

  appData.hutang.forEach(
    h => {

      if (
        ids.has(
          String(h.id)
        )
      ) {

        h.syncStatus =
          "synced";

      }

    }
  );

}


function markBatchPending(
  records
) {

  const ids =
    new Set(
      records.map(
        r =>
          String(r.id)
      )
    );

  appData.transaksi.forEach(
    t => {

      if (
        ids.has(
          String(t.id)
        )
      ) {

        t.syncStatus =
          "pending";

      }

    }
  );

  appData.barang.forEach(
    b => {

      if (
        ids.has(
          String(b.id)
        )
      ) {

        b.syncStatus =
          "pending";

      }

    }
  );

  appData.hutang.forEach(
    h => {

      if (
        ids.has(
          String(h.id)
        )
      ) {

        h.syncStatus =
          "pending";

      }

    }
  );

}


/* =====================================================
   CALL GAS
===================================================== */

async function callGas(
  action,
  payload = {}
) {

  const params =
    new URLSearchParams();

  params.set(
    "key",
    CATATKU_CONFIG.API_KEY
  );

  params.set(
    "action",
    action
  );

  params.set(
    "payload",
    JSON.stringify(payload)
  );

  const url =
    CATATKU_CONFIG.GAS_URL +
    "?" +
    params.toString();

  const response =
    await fetch(
      url,
      {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      }
    );

  if (!response.ok) {

    throw new Error(
      "HTTP " +
      response.status
    );

  }

  const text =
    await response.text();

  let json;

  try {

    json =
      JSON.parse(text);

  } catch (err) {

    console.error(
      "RESPON GAS:",
      text
    );

    throw new Error(
      "Response GAS bukan JSON."
    );

  }

  return json;

}


/* =====================================================
   LOAD DATA DARI GOOGLE SHEET
===================================================== */

async function loadServerData() {

  if (
    !navigator.onLine ||
    !isGasConfigured()
  ) {

    return;

  }

  try {

    const response =
      await callGas(
        "appData",
        {}
      );

    if (
      !response ||
      !response.success ||
      !response.data
    ) {

      throw new Error(
        response?.error ||
        "Gagal mengambil data server."
      );

    }

    mergeServerData(
      response.data
    );

    saveLocalOnly();

    updateDashboard();
    renderBarangList();
    renderHutangList();
    renderHistoryList();
    updateBarangSelects();
    updateSyncIndicator();

    localStorage.setItem(
      CATATKU_CONFIG.SYNC_KEY,
      new Date().toISOString()
    );

  } catch (err) {

    console.error(
      "LOAD SERVER ERROR:",
      err
    );

  }

}


/* =====================================================
   MERGE SERVER
===================================================== */

function mergeServerData(
  server
) {

  /*
   * Jangan menimpa data PENDING lokal.
   */

  const pendingIds =
    new Set();

  appData.transaksi
    .filter(
      x =>
        x.syncStatus !==
        "synced"
    )
    .forEach(
      x =>
        pendingIds.add(
          String(x.id)
        )
    );

  appData.barang
    .filter(
      x =>
        x.syncStatus !==
        "synced"
    )
    .forEach(
      x =>
        pendingIds.add(
          String(x.id)
        )
    );

  appData.hutang
    .filter(
      x =>
        x.syncStatus !==
        "synced"
    )
    .forEach(
      x =>
        pendingIds.add(
          String(x.id)
        )
    );


  /*
   * BARANG SERVER
   */

  if (
    Array.isArray(
      server.barang
    )
  ) {

    const serverBarang =
      server.barang.map(
        b => ({

          id: b.id,

          nama:
            b.nama ||
            b.barangNama ||
            "",

          hargaModal:
            Number(
              b.hargaModal
            ) || 0,

          hargaJual:
            Number(
              b.hargaJual
            ) || 0,

          stok:
            Number(
              b.stok
            ) || 0,

          syncStatus:
            "synced"

        })
      );

    const localPendingBarang =
      appData.barang.filter(
        b =>
          pendingIds.has(
            String(b.id)
          )
      );

    appData.barang =
      mergeUnique(
        serverBarang,
        localPendingBarang
      );

  }


  /*
   * HUTANG SERVER
   */

  if (
    Array.isArray(
      server.hutang
    )
  ) {

    const serverHutang =
      server.hutang.map(
        h => ({

          id: h.id,

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
            h.jatuhTempo ||
            "",

          jatuhTempo:
            h.jatuhTempo ||
            "",

          keterangan:
            h.keterangan ||
            "",

          syncStatus:
            "synced"

        })
      );

    const localPendingHutang =
      appData.hutang.filter(
        h =>
          pendingIds.has(
            String(h.id)
          )
      );

    appData.hutang =
      mergeUnique(
        serverHutang,
        localPendingHutang
      );

  }


  /*
   * HISTORY SERVER
   */

  if (
    Array.isArray(
      server.history
    )
  ) {

    const serverTransactions =
      [];

    server.history.forEach(
      r => {

        const entity =
          String(
            r.entity ||
            ""
          ).toUpperCase();


        if (
          entity ===
          "TRANSAKSI"
        ) {

          serverTransactions.push({

            id: r.id,

            type:
              String(
                r.jenis ||
                "PENGELUARAN"
              ).toUpperCase(),

            tanggal:
              normalizeDate(
                r.tanggal
              ),

            kategori:
              r.kategori ||
              "",

            keterangan:
              r.keterangan ||
              "",

            nominal:
              Number(
                r.nominal
              ) || 0,

            rekening:
              r.rekening ||
              "Kas",

            syncStatus:
              "synced"

          });

        }


        if (
          entity ===
          "PENJUALAN"
        ) {

          const qty =
            Number(
              r.qty
            ) || 0;

          const harga =
            Number(
              r.harga
            ) || 0;

          serverTransactions.push({

            id: r.id,

            type:
              "PEMASUKAN",

            tanggal:
              normalizeDate(
                r.tanggal
              ),

            kategori:
              "Penjualan Toko",

            keterangan:
              `Penjualan ${
                r.barangNama || ""
              } x${qty}`,

            nominal:
              qty * harga,

            rekening:
              "Kas",

            serverEntity:
              "PENJUALAN",

            barangId:
              r.barangId,

            barangNama:
              r.barangNama,

            qty,

            harga,

            pelanggan:
              r.pelanggan ||
              "",

            syncStatus:
              "synced"

          });

        }


        if (
          entity ===
          "BELANJA"
        ) {

          const qty =
            Number(
              r.qty
            ) || 0;

          const harga =
            Number(
              r.harga
            ) || 0;

          serverTransactions.push({

            id: r.id,

            type:
              "PENGELUARAN",

            tanggal:
              normalizeDate(
                r.tanggal
              ),

            kategori:
              "Belanja Stok",

            keterangan:
              `Belanja ${
                r.barangNama || ""
              } x${qty}`,

            nominal:
              qty * harga,

            rekening:
              "Kas",

            serverEntity:
              "BELANJA",

            barangId:
              r.barangId,

            barangNama:
              r.barangNama,

            qty,

            harga,

            supplier:
              r.supplier ||
              "",

            syncStatus:
              "synced"

          });

        }

      }
    );


    const localPendingTransactions =
      appData.transaksi.filter(
        t =>
          pendingIds.has(
            String(t.id)
          )
      );


    appData.transaksi =
      mergeUnique(
        serverTransactions,
        localPendingTransactions
      );

  }


  /*
   * Urutkan terbaru.
   */

  appData.transaksi.sort(
    (a, b) =>
      new Date(
        b.tanggal || 0
      ) -
      new Date(
        a.tanggal || 0
      )
  );

}


/* =====================================================
   MERGE UNIQUE
===================================================== */

function mergeUnique(
  serverItems,
  localItems
) {

  const map =
    new Map();

  serverItems.forEach(
    item =>
      map.set(
        String(item.id),
        item
      )
  );

  localItems.forEach(
    item =>
      map.set(
        String(item.id),
        item
      )
  );

  return Array.from(
    map.values()
  );

}


/* =====================================================
   DATE
===================================================== */

function normalizeDate(
  value
) {

  if (!value) return "";

  if (
    typeof value ===
    "string"
  ) {

    return value.substring(
      0,
      10
    );

  }

  return String(value)
    .substring(
      0,
      10
    );

}


/* =====================================================
   HTML ESCAPE
===================================================== */

function escapeHtml(value) {

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


function openFromMenu(page) {

  closeMoreMenu();

  showPage(page);

}


function openModal(id) {

  document
    .getElementById(id)
    ?.classList.remove(
      "hidden"
    );

}


function closeModal(id) {

  document
    .getElementById(id)
    ?.classList.add(
      "hidden"
    );

}


/* =====================================================
   CLICK OUTSIDE
===================================================== */

document.addEventListener(
  "click",
  function (e) {

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
      !menu.contains(e.target) &&
      plus &&
      !plus.contains(e.target)
    ) {

      closeQuickAdd();

    }

  }
);


/* =====================================================
   SYNC BERKALA
===================================================== */

setInterval(
  function () {

    if (
      CATATKU_CONFIG.AUTO_SYNC &&
      navigator.onLine &&
      !isSyncing
    ) {

      syncOffline(true);

    }

  },
  CATATKU_CONFIG.SYNC_INTERVAL
);


/* =====================================================
   TOMBOL SYNC DARI HTML
===================================================== */

window.syncCatatKu =
  function () {

    syncOffline(false)
      .then(
        () =>
          loadServerData()
      );

  };


/*
 * Tetap dukung nama fungsi lama.
 */
window.syncOffline =
  syncOffline;


/* =====================================================
   INIT
===================================================== */

window.addEventListener(
  "DOMContentLoaded",
  initApp
);
