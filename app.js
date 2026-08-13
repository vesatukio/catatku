/*******************************************************
 * CATATKU OFFLINE-FIRST
 * VERSI PERBAIKAN
 *******************************************************/

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyW1qBf0LX3qPtSwRrvaxIuiIcHMFkuy9PViZ-YZrTfZeM6WqCNlfcNJN1CVzE7M1F3/exec";

const API_KEY =
  "CATATKU-2026-PRIBADI";


/*******************************************************
 * STATE
 *******************************************************/

let transactionType = "PEMASUKAN";

let appData = {
  dashboard: {
    saldo: 0,
    totalPemasukan: 0,
    totalPengeluaran: 0,
    totalPenjualan: 0,
    totalHutang: 0
  },

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
          !db.objectStoreNames.contains(STORE)
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
      generateLocalId(),

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


function generateLocalId() {

  if (
    window.crypto &&
    typeof crypto.randomUUID === "function"
  ) {

    return crypto.randomUUID();

  }

  return (
    "catatku-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 10)
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

  try {

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

  } catch (error) {

    console.warn(
      "Status sync:",
      error
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

  if (!navigator.onLine) {

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

    console.error(
      "Response GAS:",
      text
    );

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
 * SYNC OFFLINE
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

    await updateSyncStatus();

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

    const remaining =
      await getPending();

    if (
      remaining.length > 0
    ) {

      syncing = false;

      setTimeout(
        syncOffline,
        300
      );

      return;

    }

    await loadRemoteData();

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
   * Tampilkan langsung
   */

  addLocalRecord(
    record
  );

  /*
   * Jika online,
   * kirim ke server
   */

  if (navigator.onLine) {

    syncOffline();

  }

  return record;
}


/*******************************************************
 * TAMBAH RECORD LOKAL
 *
 * Mencegah data transaksi
 * tampil dua kali.
 *******************************************************/

function addLocalRecord(record) {

  const id =
    String(
      record.id || ""
    );

  const exists =
    appData.history.some(
      item =>
        String(item.id || "") === id
    );

  if (!exists) {

    appData.history.unshift(
      record
    );

  }

  rebuildDashboardLocal();

  renderAll();
}


/*******************************************************
 * REBUILD DASHBOARD
 *******************************************************/

function rebuildDashboardLocal() {

  let pemasukan = 0;
  let pengeluaran = 0;
  let penjualan = 0;

  appData.history.forEach(
    item => {

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

      if (
        entity === "TRANSAKSI"
      ) {

        const nominal =
          Number(
            item.nominal
          ) || 0;

        if (
          jenis === "PEMASUKAN"
        ) {

          pemasukan += nominal;

        }

        if (
          jenis === "PENGELUARAN"
        ) {

          pengeluaran += nominal;

        }

      }

      if (
        entity === "PENJUALAN"
      ) {

        penjualan +=
          (
            Number(item.qty) || 0
          ) *
          (
            Number(item.harga) || 0
          );

      }

    }
  );

  /*
   * Data server sudah menjadi dasar.
   * History dipakai untuk memastikan
   * transaksi lokal tetap masuk.
   */

  appData.dashboard = {

    ...appData.dashboard,

    totalPemasukan:
      pemasukan,

    totalPengeluaran:
      pengeluaran,

    totalPenjualan:
      penjualan,

    saldo:
      pemasukan -
      pengeluaran

  };

}


/*******************************************************
 * APPLY LOCAL RECORD
 *******************************************************/

function applyLocalRecord(
  record
) {

  const entity =
    String(
      record.entity || ""
    ).toUpperCase();

  if (
    entity === "TRANSAKSI" ||
    entity === "PENJUALAN" ||
    entity === "BELANJA" ||
    entity === "HUTANG" ||
    entity === "BAYAR_HUTANG"
  ) {

    addHistoryIfMissing(
      record
    );

  }

  if (
    entity === "BARANG"
  ) {

    const exists =
      appData.barang.some(
        x =>
          String(x.id) ===
          String(record.id)
      );

    if (!exists) {

      appData.barang.push({

        id:
          record.id,

        nama:
          record.nama ||
          record.barangNama ||
          "",

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

  }

  if (
    entity === "HUTANG"
  ) {

    const exists =
      appData.hutang.some(
        x =>
          String(x.id) ===
          String(record.id)
      );

    if (!exists) {

      appData.hutang.unshift({

        ...record,

        sisa:
          Number(
            record.nominal
          ) || 0

      });

    }

  }

}


/*******************************************************
 * HISTORY ANTI DUPLIKAT
 *******************************************************/

function addHistoryIfMissing(
  record
) {

  const id =
    String(
      record.id || ""
    );

  const exists =
    appData.history.some(
      item =>
        String(
          item.id || ""
        ) === id
    );

  if (!exists) {

    appData.history.unshift(
      record
    );

  }

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

    /*
     * DATA SERVER
     */

    appData.dashboard =
      data.dashboard || {
        saldo: 0,
        totalPemasukan: 0,
        totalPengeluaran: 0,
        totalPenjualan: 0,
        totalHutang: 0
      };

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
     * Ambil transaksi offline
     * yang belum terkirim.
     */

    const pending =
      await getPending();

    pending.forEach(
      record => {

        applyLocalRecord(
          record
        );

      }
    );


    /*
     * Render semua
     */

    renderAll();

  } catch (error) {

    console.warn(
      "Load server gagal:",
      error
    );

  }
}


/*******************************************************
 * RENDER SEMUA
 *******************************************************/

function renderAll() {

  renderDashboard();

  renderKategori(
    appData.kategori
  );

  renderBarang();

  renderBarangSelect();

  renderHistory();

  renderRecent();

  renderHutang();

  updateSyncStatus();

}


/*******************************************************
 * DASHBOARD
 *******************************************************/

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


/*******************************************************
 * KATEGORI
 *******************************************************/

function renderKategori(data) {

  const select =
    document.getElementById(
      "trxKategori"
    );

  if (!select) return;

  const nilaiLama =
    select.value;

  select.innerHTML = `
    <option value="">
      Pilih kategori
    </option>
  `;

  if (
    !Array.isArray(data)
  ) {
    return;
  }

  data.forEach(
    function(item) {

      const nama =
        typeof item === "string"
          ? item
          : (
              item.nama ||
              item.kategori ||
              item.name ||
              ""
            );

      if (!nama) return;

      const option =
        document.createElement(
          "option"
        );

      option.value =
        nama;

      option.textContent =
        nama;

      select.appendChild(
        option
      );

    }
  );

  if (nilaiLama) {

    select.value =
      nilaiLama;

  }

}


/*******************************************************
 * BARANG
 *******************************************************/

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


/*******************************************************
 * BARANG SELECT
 *******************************************************/

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

      select.value =
        old;

    }

  });

}


/*******************************************************
 * HISTORY / TRANSAKSI
 *******************************************************/

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

  const sorted =
    [...appData.history]
      .sort(
        (a, b) =>
          getTime(b) -
          getTime(a)
      );

  el.innerHTML =
    sorted
      .slice(0, 100)
      .map(
        transactionHTML
      )
      .join("");

}


/*******************************************************
 * DASHBOARD RECENT
 *******************************************************/

function renderRecent() {

  const el =
    document.getElementById(
      "recentTransactions"
    );

  if (!el) return;

  const rows =
    [...appData.history]
      .sort(
        (a, b) =>
          getTime(b) -
          getTime(a)
      )
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
      .map(
        transactionHTML
      )
      .join("");

}


/*******************************************************
 * GET TIME
 *******************************************************/

function getTime(item) {

  const value =
    item.createdAt ||
    item.tanggal ||
    0;

  const time =
    new Date(
      value
    ).getTime();

  return isNaN(time)
    ? 0
    : time;
}


/*******************************************************
 * TRANSACTION HTML
 *******************************************************/

function transactionHTML(
  item
) {

  const entity =
    String(
      item.entity || ""
    ).toUpperCase();

  let jenis =
    String(
      item.jenis ||
      item.tipe ||
      ""
    ).toUpperCase();


  /*
   * Pastikan transaksi
   * mempunyai jenis.
   */

  if (
    entity === "TRANSAKSI" &&
    jenis !== "PEMASUKAN" &&
    jenis !== "PENGELUARAN"
  ) {

    jenis =
      "PENGELUARAN";

  }


  let nominal =
    Number(
      item.nominal
    ) || 0;


  if (
    entity === "PENJUALAN" ||
    entity === "BELANJA"
  ) {

    nominal =
      (
        Number(item.qty) || 0
      ) *
      (
        Number(item.harga) || 0
      );

  }


  /*
   * WARNA PEMASUKAN /
   * PENGELUARAN
   */

  let income =
    jenis === "PEMASUKAN" ||
    entity === "PENJUALAN";

  if (
    entity === "BELANJA"
  ) {

    income = false;

  }


  /*
   * JUDUL
   */

  let title =
    item.keterangan ||
    item.nama ||
    item.barangNama ||
    "";


  if (!title) {

    if (
      entity === "TRANSAKSI"
    ) {

      title =
        jenis === "PEMASUKAN"
          ? "Pemasukan"
          : "Pengeluaran";

    } else {

      title =
        entity;

    }

  }


  /*
   * SUBTITLE
   */

  let subtitle =
    item.tanggal ||
    "";

  if (
    entity === "TRANSAKSI"
  ) {

    if (item.kategori) {

      subtitle +=
        " • " +
        item.kategori;

    }

    if (item.rekening) {

      subtitle +=
        " • " +
        item.rekening;

    }

  }


  if (
    item.status ===
    "PENDING"
  ) {

    subtitle +=
      " • ⏳ Offline";

  }


  return `
    <div class="transaction-item">

      <div>

        <div class="item-title">
          ${esc(title)}
        </div>

        <div class="item-sub">
          ${esc(subtitle)}
        </div>

      </div>

      <div class="amount ${
        income
          ? "in"
          : "out"
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


/*******************************************************
 * HUTANG
 *******************************************************/

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

  const tanggalEl =
    document.getElementById(
      "trxTanggal"
    );

  const kategoriEl =
    document.getElementById(
      "trxKategori"
    );

  const keteranganEl =
    document.getElementById(
      "trxKeterangan"
    );

  const nominalEl =
    document.getElementById(
      "trxNominal"
    );

  const rekeningEl =
    document.getElementById(
      "trxRekening"
    );


  const data = {

    id:
      generateLocalId(),

    entity:
      "TRANSAKSI",

    tanggal:
      tanggalEl
        ? tanggalEl.value
        : today(),

    jenis:
      transactionType,

    tipe:
      transactionType,

    kategori:
      kategoriEl
        ? kategoriEl.value
        : "",

    keterangan:
      keteranganEl
        ? keteranganEl.value
        : "",

    nominal:
      Number(
        nominalEl
          ? nominalEl.value
          : 0
      ),

    rekening:
      rekeningEl
        ? rekeningEl.value
        : "Kas"

  };


  if (
    data.nominal <= 0
  ) {

    toast(
      "Nominal harus lebih dari 0."
    );

    return;

  }


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


  if (tanggalEl) {

    tanggalEl.value =
      today();

  }


  /*
   * Pastikan halaman transaksi
   * langsung menampilkan data.
   */

  renderHistory();

  renderRecent();

  renderDashboard();

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
      generateLocalId(),

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
      generateLocalId(),

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
      generateLocalId(),

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
      generateLocalId(),

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

    dibayar:
      0,

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


/*******************************************************
 * MORE MENU
 *******************************************************/

function showMoreMenu() {

  const menu =
    document.getElementById(
      "moreMenu"
    );

  if (menu) {

    menu.classList.remove(
      "hidden"
    );

  }

}


function closeMoreMenu() {

  const menu =
    document.getElementById(
      "moreMenu"
    );

  if (menu) {

    menu.classList.add(
      "hidden"
    );

  }

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
    String(
      type
    ).toUpperCase();


  const income =
    document.getElementById(
      "tabIncome"
    );

  const expense =
    document.getElementById(
      "tabExpense"
    );


  if (income) {

    income.classList.toggle(
      "active",
      transactionType ===
        "PEMASUKAN"
    );

  }


  if (expense) {

    expense.classList.toggle(
      "active",
      transactionType ===
        "PENGELUARAN"
    );

  }

}


/*******************************************************
 * MODAL
 *******************************************************/

function openModal(id) {

  const el =
    document.getElementById(
      id
    );

  if (el) {

    el.classList.remove(
      "hidden"
    );

  }

}


function closeModal(id) {

  const el =
    document.getElementById(
      id
    );

  if (el) {

    el.classList.add(
      "hidden"
    );

  }

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


function toast(
  message
) {

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
 * QUICK ADD
 *******************************************************/

function openQuickAdd() {

  let menu =
    document.getElementById(
      "quickAddMenu"
    );

  if (!menu) {

    menu =
      document.createElement(
        "div"
      );

    menu.id =
      "quickAddMenu";

    menu.className =
      "quick-add";

    menu.innerHTML = `

      <button
        class="quick-income"
        onclick="
          quickTransaction('PEMASUKAN')
        ">

        💰 Pemasukan

      </button>


      <button
        class="quick-expense"
        onclick="
          quickTransaction('PENGELUARAN')
        ">

        💸 Pengeluaran

      </button>


      <button
        class="quick-sale"
        onclick="
          showPage('penjualan');
          closeQuickAdd()
        ">

        🛒 Penjualan

      </button>

    `;

    document.body.appendChild(
      menu
    );

  }

  menu.classList.toggle(
    "show"
  );

}


function closeQuickAdd() {

  const menu =
    document.getElementById(
      "quickAddMenu"
    );

  if (menu) {

    menu.classList.remove(
      "show"
    );

  }

}


function quickTransaction(
  type
) {

  closeQuickAdd();

  setTransactionType(
    type
  );

  showPage(
    "transaksi"
  );

}


/*******************************************************
 * INIT
 *******************************************************/

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    /*
     * TANGGAL
     */

    const trxTanggal =
      document.getElementById(
        "trxTanggal"
      );

    if (trxTanggal) {

      trxTanggal.value =
        today();

    }


    const reportEnd =
      document.getElementById(
        "reportEnd"
      );

    if (reportEnd) {

      reportEnd.value =
        today();

    }


    const reportStart =
      document.getElementById(
        "reportStart"
      );

    if (reportStart) {

      const d =
        new Date();

      d.setDate(
        d.getDate() - 30
      );

      reportStart.value =
        [
          d.getFullYear(),

          String(
            d.getMonth() + 1
          ).padStart(2, "0"),

          String(
            d.getDate()
          ).padStart(2, "0")

        ].join("-");

    }


    /*
     * FORM
     */

    const transactionForm =
      document.getElementById(
        "transactionForm"
      );

    if (transactionForm) {

      transactionForm.addEventListener(
        "submit",
        saveTransaction
      );

    }


    const barangForm =
      document.getElementById(
        "barangForm"
      );

    if (barangForm) {

      barangForm.addEventListener(
        "submit",
        saveBarang
      );

    }


    const penjualanForm =
      document.getElementById(
        "penjualanForm"
      );

    if (penjualanForm) {

      penjualanForm.addEventListener(
        "submit",
        savePenjualan
      );

    }


    const belanjaForm =
      document.getElementById(
        "belanjaForm"
      );

    if (belanjaForm) {

      belanjaForm.addEventListener(
        "submit",
        saveBelanja
      );

    }


    const hutangForm =
      document.getElementById(
        "hutangForm"
      );

    if (hutangForm) {

      hutangForm.addEventListener(
        "submit",
        saveHutang
      );

    }


    /*
     * PILIH BARANG PENJUALAN
     */

    const jualBarang =
      document.getElementById(
        "jualBarang"
      );

    if (jualBarang) {

      jualBarang.addEventListener(
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

            const jualHarga =
              document.getElementById(
                "jualHarga"
              );

            if (jualHarga) {

              jualHarga.value =
                barang.hargaJual ||
                0;

            }

          }

        }
      );

    }


    /*
     * ONLINE / OFFLINE
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
     * LOADING
     */

    const loading =
      document.getElementById(
        "loading"
      );

    if (loading) {

      loading.classList.add(
        "hidden"
      );

    }


    /*
     * LOAD DATA SERVER
     */

    if (
      navigator.onLine
    ) {

      await loadRemoteData();

      await syncOffline();

    }


    /*
     * STATUS
     */

    updateOnlineStatus();

    updateSyncStatus();

  }
);
