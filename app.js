/*******************************************************
 * CATATKU OFFLINE-FIRST
 *******************************************************/

const GAS_URL =
  "PASTE_URL_WEB_APP_GAS_ANDA_DI_SINI";

const API_KEY =
  "CATATKU-2026-PRIBADI";


/*******************************************************
 * STATE
 *******************************************************/

let transactionType = "PEMASUKAN";

let appData = {
  dashboard: {},
  kategori: [],
  barang: [],
  history: [],
  hutang: []
};


/*******************************************************
 * INDEXED DB
 *******************************************************/

const DB_NAME = "CatatKuOfflineDB";
const DB_VERSION = 1;
const STORE = "queue";


function openDB() {

  return new Promise((resolve, reject) => {

    const request =
      indexedDB.open(
        DB_NAME,
        DB_VERSION
      );


    request.onupgradeneeded =
      function(event) {

        const db =
          event.target.result;

        if (
          !db.objectStoreNames
            .contains(STORE)
        ) {

          const store =
            db.createObjectStore(
              STORE,
              {
                keyPath: "id"
              }
            );

          store.createIndex(
            "status",
            "status",
            {
              unique: false
            }
          );

          store.createIndex(
            "createdAt",
            "createdAt",
            {
              unique: false
            }
          );
        }
      };


    request.onsuccess =
      function() {
        resolve(
          request.result
        );
      };


    request.onerror =
      function() {
        reject(
          request.error
        );
      };

  });
}


async function dbPut(record) {

  const db =
    await openDB();

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
          STORE,
          "readwrite"
        );

      tx.objectStore(
        STORE
      ).put(record);

      tx.oncomplete =
        () => resolve(true);

      tx.onerror =
        () => reject(tx.error);

    }
  );
}


async function dbDelete(id) {

  const db =
    await openDB();

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
          STORE,
          "readwrite"
        );

      tx.objectStore(
        STORE
      ).delete(id);

      tx.oncomplete =
        () => resolve(true);

      tx.onerror =
        () => reject(tx.error);

    }
  );
}


async function dbAll() {

  const db =
    await openDB();

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
          STORE,
          "readonly"
        );

      const request =
        tx.objectStore(
          STORE
        ).getAll();

      request.onsuccess =
        () => resolve(
          request.result || []
        );

      request.onerror =
        () => reject(
          request.error
        );

    }
  );
}


/*******************************************************
 * OFFLINE QUEUE
 *******************************************************/

async function queueData(data) {

  const record = {

    ...data,

    id:
      data.id ||
      crypto.randomUUID(),

    createdAt:
      data.createdAt ||
      new Date().toISOString(),

    status:
      "PENDING"

  };


  await dbPut(record);

  updateSyncStatus();

  return record;
}


async function getPending() {

  const all =
    await dbAll();

  return all.filter(
    x =>
      x.status === "PENDING"
  );
}


/*******************************************************
 * ONLINE / OFFLINE
 *******************************************************/

function updateOnlineStatus() {

  const online =
    navigator.onLine;

  const dot =
    document.getElementById(
      "onlineDot"
    );

  const text =
    document.getElementById(
      "onlineText"
    );


  if (dot) {

    dot.className =
      online
        ? "online-dot online"
        : "online-dot offline";
  }


  if (text) {

    text.textContent =
      online
        ? "ONLINE"
        : "OFFLINE";
  }


  updateSyncStatus();

  if (online) {

    syncOffline();

  }
}


async function updateSyncStatus() {

  const pending =
    await getPending();

  const badge =
    document.getElementById(
      "syncBadge"
    );


  if (!badge) return;


  if (pending.length > 0) {

    badge.textContent =
      pending.length +
      " menunggu";

    badge.classList.remove(
      "hidden"
    );

  } else {

    badge.classList.add(
      "hidden"
    );
  }
}


/*******************************************************
 * API
 *******************************************************/

async function api(
  action,
  payload = {}
) {

  if (
    !navigator.onLine
  ) {

    throw new Error(
      "OFFLINE"
    );
  }


  if (
    !GAS_URL ||
    GAS_URL.includes(
      "PASTE_URL"
    )
  ) {

    throw new Error(
      "URL GAS belum diisi."
    );
  }


  const params =
    new URLSearchParams();

  params.set(
    "action",
    action
  );

  params.set(
    "key",
    API_KEY
  );


  if (
    payload &&
    Object.keys(payload).length
  ) {

    params.set(
      "payload",
      JSON.stringify(payload)
    );
  }


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


  const text =
    await response.text();


  let result;

  try {

    result =
      JSON.parse(text);

  } catch (e) {

    throw new Error(
      "Response GAS tidak valid."
    );
  }


  if (!result.success) {

    throw new Error(
      result.error ||
      "GAS gagal."
    );
  }


  return result.data;
}


/*******************************************************
 * SYNC
 *******************************************************/

let syncing = false;


async function syncOffline() {

  if (syncing) {
    return;
  }

  if (!navigator.onLine) {
    return;
  }


  const pending =
    await getPending();


  if (!pending.length) {

    updateSyncStatus();

    return;
  }


  syncing = true;


  setSyncText(
    "Menyinkronkan..."
  );


  try {

    /*
     * Kirim maksimal 20 data sekali.
     * Menghindari URL terlalu panjang.
     */

    const batch =
      pending.slice(0, 20);


    const result =
      await api(
        "sync",
        {
          records: batch
        }
      );


    const results =
      result.results || [];


    for (
      const item of results
    ) {

      if (item.success) {

        await dbDelete(
          item.id
        );

      }

    }


    updateSyncStatus();


    if (
      result.failed > 0
    ) {

      setSyncText(
        "Sebagian gagal"
      );

    } else {

      setSyncText(
        "Sinkron selesai"
      );

    }


    /*
     * Kalau masih ada,
     * lanjut batch berikutnya.
     */

    const remaining =
      await getPending();


    if (
      remaining.length > 0
    ) {

      setTimeout(
        syncOffline,
        300
      );

    } else {

      await loadRemoteData();

    }

  } catch (error) {

    console.warn(
      "Sync gagal:",
      error
    );

    setSyncText(
      "Menunggu internet"
    );

  } finally {

    syncing = false;

    updateSyncStatus();
  }
}


/*******************************************************
 * SIMPAN DATA
 *
 * Selalu simpan lokal dulu.
 *******************************************************/

async function saveOfflineFirst(
  data,
  remoteAction
) {

  const record =
    await queueData({
      ...data,
      remoteAction
    });


  /*
   * Render lokal langsung.
   */

  applyLocalRecord(
    record
  );


  /*
   * Kalau online,
   * langsung sinkron.
   */

  if (navigator.onLine) {

    syncOffline();

  }


  return record;
}


/*******************************************************
 * APPLY LOCAL
 *******************************************************/

function applyLocalRecord(
  record
) {

  const entity =
    String(
      record.entity || ""
    ).toUpperCase();


  if (
    entity === "TRANSAKSI"
  ) {

    appData.history.unshift(
      record
    );

    const nominal =
      Number(
        record.nominal
      ) || 0;


    if (
      record.jenis ===
      "PEMASUKAN"
    ) {

      appData.dashboard
        .totalPemasukan =
        Number(
          appData.dashboard
            .totalPemasukan || 0
        ) + nominal;

    } else {

      appData.dashboard
        .totalPengeluaran =
        Number(
          appData.dashboard
            .totalPengeluaran || 0
        ) + nominal;

    }

  }


  if (
    entity === "PENJUALAN"
  ) {

    appData.history.unshift(
      record
    );

    appData.dashboard
      .totalPenjualan =
      Number(
        appData.dashboard
          .totalPenjualan || 0
      ) +
      (
        Number(record.qty) *
        Number(record.harga)
      );

  }


  if (
    entity === "BELANJA"
  ) {

    appData.history.unshift(
      record
    );

  }


  if (
    entity === "HUTANG"
  ) {

    appData.hutang.unshift(
      {
        ...record,
        sisa:
          Number(
            record.nominal
          ) || 0
      }
    );

    appData.history.unshift(
      record
    );


    appData.dashboard
      .totalHutang =
      Number(
        appData.dashboard
          .totalHutang || 0
      ) +
      Number(
        record.nominal
      );

  }


  if (
    entity === "BARANG"
  ) {

    appData.barang.push({
      id: record.id,
      nama: record.nama,
      hargaModal:
        Number(
          record.hargaModal
        ) || 0,
      hargaJual:
        Number(
          record.hargaJual
        ) || 0,
      stok:
        Number(
          record.stokAwal
        ) || 0
    });

  }


  renderDashboard();
  renderBarang();
  renderBarangSelect();
  renderHistory();
  renderHutang();
}


/*******************************************************
 * LOAD DATA SERVER
 *******************************************************/

async function loadRemoteData() {

  if (!navigator.onLine) {
    return;
  }


  try {

    const data =
      await api(
        "appData"
      );


    appData.dashboard =
      data.dashboard || {};

    appData.kategori =
      normalizeArray(
        data.kategori
      );

    appData.barang =
      normalizeArray(
        data.barang
      );

    appData.history =
      normalizeArray(
        data.history
      );

    appData.hutang =
      normalizeArray(
        data.hutang
      );


    /*
     * Tambahkan data pending
     * agar belum hilang dari tampilan.
     */

    const pending =
      await getPending();


    pending
      .forEach(applyLocalRecord);


    renderAll();


  } catch (error) {

    console.warn(
      "Load server gagal:",
      error
    );
  }
}


/*******************************************************
 * RENDER
 *******************************************************/

function renderAll() {

  renderDashboard();
  renderKategori();
  renderBarang();
  renderBarangSelect();
  renderHistory();
  renderHutang();

  updateSyncStatus();
}


function renderDashboard() {

  const d =
    appData.dashboard || {};


  const pemasukan =
    Number(
      d.totalPemasukan ||
      d.pemasukan ||
      0
    );


  const pengeluaran =
    Number(
      d.totalPengeluaran ||
      d.pengeluaran ||
      0
    );


  const penjualan =
    Number(
      d.totalPenjualan ||
      d.penjualan ||
      0
    );


  const hutang =
    Number(
      d.totalHutang ||
      d.hutang ||
      0
    );


  const saldo =
    Number(
      d.saldo ??
      (
        pemasukan -
        pengeluaran
      )
    );


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
    rupiah(hutang)
  );


  renderRecent();
}


function renderKategori(data) {
    const select = document.getElementById("trxKategori");

    if (!select) return;

    const nilaiLama = select.value;

    select.innerHTML = `
        <option value="">Pilih kategori</option>
    `;

    if (!Array.isArray(data)) return;

    data.forEach(function(item) {

        const nama =
            typeof item === "string"
                ? item
                : item.nama || item.kategori || "";

        if (!nama) return;

        const option = document.createElement("option");

        option.value = nama;
        option.textContent = nama;

        select.appendChild(option);
    });

    if (nilaiLama) {
        select.value = nilaiLama;
    }
}

function renderBarang() {

  const el =
    document.getElementById(
      "barangList"
    );

  if (!el) return;


  if (
    !appData.barang.length
  ) {

    el.innerHTML =
      `<div class="empty">
        Belum ada barang.
      </div>`;

    return;
  }


  el.innerHTML =
    appData.barang
      .map(item => {

        return `
          <div class="product-item">

            <div>
              <div class="item-title">
                ${esc(item.nama)}
              </div>

              <div class="item-sub">
                Jual:
                ${rupiah(
                  item.hargaJual
                )}
              </div>
            </div>

            <div class="stock">
              Stok ${Number(
                item.stok || 0
              )}
            </div>

          </div>
        `;

      })
      .join("");
}


function renderBarangSelect() {

  const ids = [
    "jualBarang",
    "belanjaBarang"
  ];


  ids.forEach(id => {

    const select =
      document.getElementById(
        id
      );

    if (!select) return;


    const old =
      select.value;


    select.innerHTML =
      `<option value="">
        Pilih barang
      </option>`;


    appData.barang
      .forEach(item => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          item.id;

        option.textContent =
          item.nama;

        select.appendChild(
          option
        );

      });


    if (old) {
      select.value = old;
    }

  });
}


function renderHistory() {

  const el =
    document.getElementById(
      "historyList"
    );

  if (!el) return;


  if (
    !appData.history.length
  ) {

    el.innerHTML =
      `<div class="empty">
        Belum ada transaksi.
      </div>`;

    return;
  }


  el.innerHTML =
    appData.history
      .slice(0, 100)
      .map(transactionHTML)
      .join("");
}


function renderRecent() {

  const el =
    document.getElementById(
      "recentTransactions"
    );

  if (!el) return;


  const rows =
    appData.history
      .slice(0, 8);


  if (!rows.length) {

    el.innerHTML =
      `<div class="empty">
        Belum ada transaksi.
      </div>`;

    return;
  }


  el.innerHTML =
    rows
      .map(transactionHTML)
      .join("");
}


function transactionHTML(
  item
) {

  const entity =
    String(
      item.entity || ""
    ).toUpperCase();


  const jenis =
    String(
      item.jenis ||
      item.tipe ||
      ""
    ).toUpperCase();


  let nominal =
    Number(
      item.nominal
    ) || 0;


  if (
    entity === "PENJUALAN" ||
    entity === "BELANJA"
  ) {

    nominal =
      Number(item.qty || 0) *
      Number(item.harga || 0);

  }


  let income =
    jenis === "PEMASUKAN" ||
    entity === "PENJUALAN";


  if (
    entity === "BELANJA"
  ) {

    income = false;
  }


  let title =
    item.keterangan ||
    item.nama ||
    item.barangNama ||
    entity;


  return `
    <div class="transaction-item">

      <div>

        <div class="item-title">
          ${esc(title)}
        </div>

        <div class="item-sub">

          ${esc(
            item.tanggal ||
            ""
          )}

          ${
            item.status ===
            "PENDING"
              ? " • ⏳ Offline"
              : ""
          }

        </div>

      </div>

      <div class="amount ${
        income ? "in" : "out"
      }">

        ${
          income
            ? "+"
            : "-"
        }

        ${rupiah(nominal)}

      </div>

    </div>
  `;
}


function renderHutang() {

  const el =
    document.getElementById(
      "hutangList"
    );

  if (!el) return;


  if (
    !appData.hutang.length
  ) {

    el.innerHTML =
      `<div class="empty">
        Belum ada hutang.
      </div>`;

    return;
  }


  el.innerHTML =
    appData.hutang
      .map(item => {

        return `
          <div class="debt-item">

            <div>

              <div class="item-title">
                ${esc(
                  item.nama || ""
                )}
              </div>

              <div class="item-sub">
                Jatuh tempo:
                ${esc(
                  item.jatuhTempo ||
                  "-"
                )}
              </div>

            </div>

            <div class="debt-value">
              ${rupiah(
                item.sisa ??
                item.nominal ??
                0
              )}
            </div>

          </div>
        `;

      })
      .join("");
}


/*******************************************************
 * SAVE TRANSACTION
 *******************************************************/

async function saveTransaction(
  event
) {

  event.preventDefault();


  const data = {

    id:
      crypto.randomUUID(),

    entity:
      "TRANSAKSI",

    tanggal:
      document.getElementById(
        "trxTanggal"
      ).value,

    jenis:
      transactionType,

    kategori:
      document.getElementById(
        "trxKategori"
      ).value,

    keterangan:
      document.getElementById(
        "trxKeterangan"
      ).value,

    nominal:
      Number(
        document.getElementById(
          "trxNominal"
        ).value
      ),

    rekening:
      document.getElementById(
        "trxRekening"
      ).value

  };


  await saveOfflineFirst(
    data,
    "tambahTransaksi"
  );


  toast(
    navigator.onLine
      ? "Transaksi tersimpan."
      : "Tersimpan offline."
  );


  event.target.reset();


  document.getElementById(
    "trxTanggal"
  ).value =
    today();
}


/*******************************************************
 * SAVE BARANG
 *******************************************************/

async function saveBarang(
  event
) {

  event.preventDefault();


  const data = {

    id:
      crypto.randomUUID(),

    entity:
      "BARANG",

    tanggal:
      today(),

    nama:
      document.getElementById(
        "barangNama"
      ).value,

    hargaModal:
      Number(
        document.getElementById(
          "barangModalPrice"
        ).value
      ),

    hargaJual:
      Number(
        document.getElementById(
          "barangJualPrice"
        ).value
      ),

    stokAwal:
      Number(
        document.getElementById(
          "barangStok"
        ).value
      )

  };


  await saveOfflineFirst(
    data,
    "tambahBarang"
  );


  toast(
    navigator.onLine
      ? "Barang tersimpan."
      : "Barang tersimpan offline."
  );


  event.target.reset();

  closeModal(
    "barangModal"
  );
}


/*******************************************************
 * SAVE PENJUALAN
 *******************************************************/

async function savePenjualan(
  event
) {

  event.preventDefault();


  const barangId =
    document.getElementById(
      "jualBarang"
    ).value;


  const barang =
    appData.barang.find(
      x =>
        String(x.id) ===
        String(barangId)
    );


  const data = {

    id:
      crypto.randomUUID(),

    entity:
      "PENJUALAN",

    tanggal:
      today(),

    barangId:

      barangId,

    barangNama:

      barang
        ? barang.nama
        : "",

    qty:
      Number(
        document.getElementById(
          "jualQty"
        ).value
      ),

    harga:
      Number(
        document.getElementById(
          "jualHarga"
        ).value
      ),

    pelanggan:
      document.getElementById(
        "jualPelanggan"
      ).value

  };


  await saveOfflineFirst(
    data,
    "tambahPenjualan"
  );


  toast(
    navigator.onLine
      ? "Penjualan tersimpan."
      : "Penjualan tersimpan offline."
  );


  event.target.reset();
}


/*******************************************************
 * SAVE BELANJA
 *******************************************************/

async function saveBelanja(
  event
) {

  event.preventDefault();


  const barangId =
    document.getElementById(
      "belanjaBarang"
    ).value;


  const barang =
    appData.barang.find(
      x =>
        String(x.id) ===
        String(barangId)
    );


  const data = {

    id:
      crypto.randomUUID(),

    entity:
      "BELANJA",

    tanggal:
      today(),

    barangId:

      barangId,

    barangNama:

      barang
        ? barang.nama
        : "",

    qty:
      Number(
        document.getElementById(
          "belanjaQty"
        ).value
      ),

    harga:
      Number(
        document.getElementById(
          "belanjaHarga"
        ).value
      ),

    supplier:
      document.getElementById(
        "belanjaSupplier"
      ).value

  };


  await saveOfflineFirst(
    data,
    "tambahBelanja"
  );


  toast(
    navigator.onLine
      ? "Belanja tersimpan."
      : "Belanja tersimpan offline."
  );


  event.target.reset();
}


/*******************************************************
 * SAVE HUTANG
 *******************************************************/

async function saveHutang(
  event
) {

  event.preventDefault();


  const data = {

    id:
      crypto.randomUUID(),

    entity:
      "HUTANG",

    tanggal:
      today(),

    nama:
      document.getElementById(
        "hutangNama"
      ).value,

    nominal:
      Number(
        document.getElementById(
          "hutangNominal"
        ).value
      ),

    dibayar: 0,

    jatuhTempo:
      document.getElementById(
        "hutangTempo"
      ).value,

    keterangan:
      document.getElementById(
        "hutangKeterangan"
      ).value,

    status:
      "BELUM LUNAS"

  };


  await saveOfflineFirst(
    data,
    "tambahHutang"
  );


  toast(
    navigator.onLine
      ? "Hutang tersimpan."
      : "Hutang tersimpan offline."
  );


  event.target.reset();

  closeModal(
    "hutangModal"
  );
}


/*******************************************************
 * LAPORAN
 *******************************************************/

async function loadReport() {

  const mulai =
    document.getElementById(
      "reportStart"
    ).value;

  const akhir =
    document.getElementById(
      "reportEnd"
    ).value;


  if (
    !mulai ||
    !akhir
  ) {

    toast(
      "Pilih periode."
    );

    return;
  }


  const el =
    document.getElementById(
      "reportResult"
    );


  if (!navigator.onLine) {

    el.innerHTML =
      `<div class="empty">
        Laporan server membutuhkan
        koneksi internet.
      </div>`;

    return;
  }


  try {

    const data =
      await api(
        "laporan",
        {
          mulai,
          akhir
        }
      );


    el.innerHTML = `

      <div class="report-row">
        <span class="report-label">
          Pemasukan
        </span>

        <span class="report-value">
          ${rupiah(
            data.pemasukan
          )}
        </span>
      </div>

      <div class="report-row">
        <span class="report-label">
          Pengeluaran
        </span>

        <span class="report-value">
          ${rupiah(
            data.pengeluaran
          )}
        </span>
      </div>

      <div class="report-row">
        <span class="report-label">
          Penjualan
        </span>

        <span class="report-value">
          ${rupiah(
            data.penjualan
          )}
        </span>
      </div>

      <div class="report-row">
        <span class="report-label">
          Modal Penjualan
        </span>

        <span class="report-value">
          ${rupiah(
            data.modalPenjualan
          )}
        </span>
      </div>

      <div class="report-row">
        <span class="report-label">
          Laba
        </span>

        <span class="report-value">
          ${rupiah(
            data.laba
          )}
        </span>
      </div>

    `;

  } catch (error) {

    toast(
      error.message
    );
  }
}


/*******************************************************
 * NAVIGATION
 *******************************************************/

function showPage(name) {

  document
    .querySelectorAll(".page")
    .forEach(
      p =>
        p.classList.remove(
          "active"
        )
    );


  const page =
    document.getElementById(
      "page-" + name
    );


  if (page) {

    page.classList.add(
      "active"
    );
  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function showMoreMenu() {

  document
    .getElementById(
      "moreMenu"
    )
    .classList.remove(
      "hidden"
    );
}


function closeMoreMenu() {

  document
    .getElementById(
      "moreMenu"
    )
    .classList.add(
      "hidden"
    );
}


function openFromMenu(
  page
) {

  closeMoreMenu();

  showPage(page);
}


/*******************************************************
 * TRANSACTION TYPE
 *******************************************************/

function setTransactionType(
  type
) {

  transactionType =
    type;


  document
    .getElementById(
      "tabIncome"
    )
    .classList.toggle(
      "active",
      type ===
        "PEMASUKAN"
    );


  document
    .getElementById(
      "tabExpense"
    )
    .classList.toggle(
      "active",
      type ===
        "PENGELUARAN"
    );
}


/*******************************************************
 * MODAL
 *******************************************************/

function openModal(id) {

  document
    .getElementById(id)
    .classList.remove(
      "hidden"
    );
}


function closeModal(id) {

  document
    .getElementById(id)
    .classList.add(
      "hidden"
    );
}


/*******************************************************
 * REFRESH
 *******************************************************/

async function refreshApp() {

  if (
    navigator.onLine
  ) {

    await syncOffline();

    await loadRemoteData();

    toast(
      "Data diperbarui."
    );

  } else {

    toast(
      "Offline — data lokal tetap aman."
    );

  }
}


/*******************************************************
 * HELPERS
 *******************************************************/

function normalizeArray(
  data
) {

  if (
    Array.isArray(data)
  ) {

    return data;
  }


  return [];
}


function rupiah(value) {

  return new Intl
    .NumberFormat(
      "id-ID",
      {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
      }
    )
    .format(
      Number(value) || 0
    );
}


function today() {

  const d =
    new Date();


  return [
    d.getFullYear(),

    String(
      d.getMonth() + 1
    ).padStart(2, "0"),

    String(
      d.getDate()
    ).padStart(2, "0")

  ].join("-");
}


function esc(value) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


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


function toast(message) {

  const el =
    document.getElementById(
      "toast"
    );


  if (!el) return;


  el.textContent =
    message;


  el.classList.add(
    "show"
  );


  setTimeout(
    () => {

      el.classList.remove(
        "show"
      );

    },
    2500
  );
}


function setSyncText(
  text
) {

  const el =
    document.getElementById(
      "syncText"
    );


  if (el) {

    el.textContent =
      text;
  }
}


/*******************************************************
 * INIT
 *******************************************************/

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    document.getElementById(
      "trxTanggal"
    ).value =
      today();


    document.getElementById(
      "reportEnd"
    ).value =
      today();


    const d =
      new Date();

    d.setDate(
      d.getDate() - 30
    );


    document.getElementById(
      "reportStart"
    ).value =
      [
        d.getFullYear(),

        String(
          d.getMonth() + 1
        ).padStart(2, "0"),

        String(
          d.getDate()
        ).padStart(2, "0")

      ].join("-");


    document.getElementById(
      "transactionForm"
    ).addEventListener(
      "submit",
      saveTransaction
    );


    document.getElementById(
      "barangForm"
    ).addEventListener(
      "submit",
      saveBarang
    );


    document.getElementById(
      "penjualanForm"
    ).addEventListener(
      "submit",
      savePenjualan
    );


    document.getElementById(
      "belanjaForm"
    ).addEventListener(
      "submit",
      saveBelanja
    );


    document.getElementById(
      "hutangForm"
    ).addEventListener(
      "submit",
      saveHutang
    );


    document.getElementById(
      "jualBarang"
    ).addEventListener(
      "change",
      function() {

        const barang =
          appData.barang.find(
            x =>
              String(x.id) ===
              String(
                this.value
              )
          );


        if (barang) {

          document.getElementById(
            "jualHarga"
          ).value =
            barang.hargaJual ||
            0;

        }

      }
    );


    /*
     * Online / Offline
     */

    window.addEventListener(
      "online",
      updateOnlineStatus
    );


    window.addEventListener(
      "offline",
      updateOnlineStatus
    );


    /*
     * Tampilan langsung
     */

    document
      .getElementById(
        "loading"
      )
      .classList.add(
        "hidden"
      );


    /*
     * Ambil data server
     */

    if (
      navigator.onLine
    ) {

      await loadRemoteData();

      await syncOffline();

    }


    /*
     * Status
     */

    updateOnlineStatus();

    updateSyncStatus();

  }
);
