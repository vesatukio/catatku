```javascript
/*******************************************************
 * CATATKU
 * Frontend untuk GAS + 2 Sheet
 *
 * SHEET:
 * 1. DATA
 * 2. KATEGORI
 *
 * API KEY:
 * CATATKU-2026-PRIBADI
 *******************************************************/


/* =====================================================
   1. KONFIGURASI GAS
   =====================================================

   GANTI hanya URL di bawah dengan URL Web App GAS Anda.

   Format:
   https://script.google.com/macros/s/AKfycbyW1qBf0LX3qPtSwRrvaxIuiIcHMFkuy9PViZ-YZrTfZeM6WqCNlfcNJN1CVzE7M1F3/exec
*/

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyW1qBf0LX3qPtSwRrvaxIuiIcHMFkuy9PViZ-YZrTfZeM6WqCNlfcNJN1CVzE7M1F3/exec";


const API_KEY =
  "CATATKU-2026-PRIBADI";


/* =====================================================
   STATE
   ===================================================== */

let transactionType = "PEMASUKAN";

let appData = {
  dashboard: {},
  kategori: [],
  barang: [],
  penjualan: [],
  belanja: [],
  hutang: [],
  history: []
};


/* =====================================================
   HELPER
   ===================================================== */

function rupiah(value) {

  const number = Number(value) || 0;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(number);
}


function today() {

  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}


function esc(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function toast(message) {

  const el = document.getElementById("toast");

  el.textContent = message;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 2500);
}


/* =====================================================
   API GAS
   ===================================================== */

async function api(action, payload = {}) {

  if (!GAS_URL ||
      GAS_URL.includes("PASTE_URL")) {

    throw new Error(
      "URL Web App GAS belum diisi di app.js"
    );
  }

  const params = new URLSearchParams();

  params.set("action", action);
  params.set("key", API_KEY);

  if (payload &&
      Object.keys(payload).length > 0) {

    params.set(
      "payload",
      JSON.stringify(payload)
    );
  }

  const url =
    GAS_URL + "?" + params.toString();

  const response =
    await fetch(url, {
      method: "GET",
      cache: "no-store"
    });

  const text =
    await response.text();

  let result;

  try {

    result = JSON.parse(text);

  } catch (error) {

    console.error(text);

    throw new Error(
      "Response GAS bukan JSON. Periksa URL Web App dan deployment GAS."
    );
  }

  if (!result.success) {

    throw new Error(
      result.error || "API GAS gagal."
    );
  }

  return result.data;
}


/* =====================================================
   LOAD SEMUA DATA
   ===================================================== */

async function loadApp() {

  setLoading(true);

  try {

    const [
      dashboard,
      kategori,
      barang,
      history,
      hutang
    ] = await Promise.all([

      api("dashboard"),

      api("kategori"),

      api("barang"),

      api("history", {
        limit: 50
      }),

      api("hutang")

    ]);

    appData.dashboard =
      dashboard || {};

    appData.kategori =
      normalizeArray(kategori);

    appData.barang =
      normalizeArray(barang);

    appData.history =
      normalizeArray(history);

    appData.hutang =
      normalizeArray(hutang);


    renderDashboard();

    renderKategori();

    renderBarang();

    renderBarangSelect();

    renderHistory();

    renderHutang();

  } catch (error) {

    console.error(error);

    toast(error.message);

  } finally {

    setLoading(false);
  }
}


function normalizeArray(data) {

  if (Array.isArray(data)) {
    return data;
  }

  if (data &&
      Array.isArray(data.data)) {
    return data.data;
  }

  if (data &&
      Array.isArray(data.rows)) {
    return data.rows;
  }

  return [];
}


/* =====================================================
   DASHBOARD
   ===================================================== */

function renderDashboard() {

  const d =
    appData.dashboard || {};

  const pemasukan =
    Number(
      d.totalPemasukan ??
      d.pemasukan ??
      d.income ??
      0
    );

  const pengeluaran =
    Number(
      d.totalPengeluaran ??
      d.pengeluaran ??
      d.expense ??
      0
    );

  const penjualan =
    Number(
      d.totalPenjualan ??
      d.penjualan ??
      d.sales ??
      0
    );

  const hutang =
    Number(
      d.totalHutang ??
      d.hutang ??
      d.debt ??
      0
    );

  const saldo =
    Number(
      d.saldo ??
      d.balance ??
      (pemasukan - pengeluaran)
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


function renderRecent() {

  const el =
    document.getElementById(
      "recentTransactions"
    );

  const rows =
    appData.history.slice(0, 8);

  if (!rows.length) {

    el.innerHTML =
      `<div class="empty">
        Belum ada transaksi
      </div>`;

    return;
  }

  el.innerHTML =
    rows.map(transactionHTML).join("");
}


/* =====================================================
   KATEGORI
   ===================================================== */

function renderKategori() {

  const select =
    document.getElementById(
      "trxKategori"
    );

  if (!select) return;

  select.innerHTML =
    `<option value="">
      Pilih kategori
    </option>`;


  appData.kategori.forEach(item => {

    const nama =
      item.nama ??
      item.kategori ??
      item.name ??
      item.Kategori ??
      "";

    if (!nama) return;

    const option =
      document.createElement("option");

    option.value = nama;
    option.textContent = nama;

    select.appendChild(option);
  });
}


/* =====================================================
   BARANG
   ===================================================== */

function renderBarang() {

  const el =
    document.getElementById(
      "barangList"
    );

  if (!appData.barang.length) {

    el.innerHTML =
      `<div class="empty">
        Belum ada barang.
      </div>`;

    return;
  }

  el.innerHTML =
    appData.barang.map(item => {

      const nama =
        item.nama ??
        item.Nama ??
        item.name ??
        "";

      const stok =
        Number(
          item.stok ??
          item.Stok ??
          0
        );

      const hargaJual =
        Number(
          item.hargaJual ??
          item["Harga Jual"] ??
          item.hargajual ??
          0
        );

      return `
        <div class="product-item">

          <div>
            <div class="item-title">
              ${esc(nama)}
            </div>

            <div class="item-sub">
              Harga jual:
              ${rupiah(hargaJual)}
            </div>
          </div>

          <div class="stock">
            Stok ${stok}
          </div>

        </div>
      `;

    }).join("");
}


function renderBarangSelect() {

  const selects = [
    document.getElementById("jualBarang"),
    document.getElementById("belanjaBarang")
  ];

  selects.forEach(select => {

    if (!select) return;

    select.innerHTML =
      `<option value="">
        Pilih barang
      </option>`;

    appData.barang.forEach(item => {

      const id =
        item.id ??
        item.ID ??
        item.nama ??
        item.Nama ??
        "";

      const nama =
        item.nama ??
        item.Nama ??
        item.name ??
        id;

      const option =
        document.createElement("option");

      option.value = id;

      option.textContent =
        nama;

      select.appendChild(option);
    });

  });
}


/* =====================================================
   RIWAYAT
   ===================================================== */

function renderHistory() {

  const el =
    document.getElementById(
      "historyList"
    );

  if (!appData.history.length) {

    el.innerHTML =
      `<div class="empty">
        Belum ada transaksi.
      </div>`;

    return;
  }

  el.innerHTML =
    appData.history
      .map(transactionHTML)
      .join("");
}


function transactionHTML(item) {

  const tipe =
    String(
      item.tipe ??
      item.jenis ??
      item.type ??
      ""
    ).toUpperCase();

  const nominal =
    Number(
      item.nominal ??
      item.jumlah ??
      item.amount ??
      0
    );

  const tanggal =
    item.tanggal ??
    item.date ??
    "";

  const kategori =
    item.kategori ??
    item.category ??
    "";

  const keterangan =
    item.keterangan ??
    item.deskripsi ??
    item.description ??
    "";


  const income =
    tipe.includes("MASUK") ||
    tipe.includes("INCOME") ||
    tipe.includes("PENJUALAN");


  return `
    <div class="transaction-item">

      <div>

        <div class="item-title">
          ${esc(keterangan || kategori || tipe)}
        </div>

        <div class="item-sub">
          ${esc(tanggal)}
          ${kategori ? " • " + esc(kategori) : ""}
        </div>

      </div>

      <div class="amount ${income ? "in" : "out"}">
        ${income ? "+" : "-"}
        ${rupiah(nominal)}
      </div>

    </div>
  `;
}


/* =====================================================
   HUTANG
   ===================================================== */

function renderHutang() {

  const el =
    document.getElementById(
      "hutangList"
    );

  if (!appData.hutang.length) {

    el.innerHTML =
      `<div class="empty">
        Belum ada hutang.
      </div>`;

    return;
  }

  el.innerHTML =
    appData.hutang.map(item => {

      const nama =
        item.nama ??
        item.pihak ??
        item.Nama ??
        "";

      const nominal =
        Number(
          item.sisa ??
          item.nominal ??
          item.jumlah ??
          0
        );

      const tempo =
        item.jatuhTempo ??
        item.tempo ??
        item.tanggalJatuhTempo ??
        "";

      return `
        <div class="debt-item">

          <div>

            <div class="item-title">
              ${esc(nama)}
            </div>

            <div class="item-sub">
              Jatuh tempo:
              ${esc(tempo || "-")}
            </div>

          </div>

          <div class="debt-value">
            ${rupiah(nominal)}
          </div>

        </div>
      `;

    }).join("");
}


/* =====================================================
   NAVIGASI
   ===================================================== */

function showPage(name) {

  document
    .querySelectorAll(".page")
    .forEach(page => {
      page.classList.remove("active");
    });


  const target =
    document.getElementById(
      "page-" + name
    );

  if (target) {
    target.classList.add("active");
  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function showMoreMenu() {

  document
    .getElementById("moreMenu")
    .classList.remove("hidden");
}


function closeMoreMenu() {

  document
    .getElementById("moreMenu")
    .classList.add("hidden");
}


function openFromMenu(page) {

  closeMoreMenu();

  showPage(page);
}


/* =====================================================
   TRANSACTION TYPE
   ===================================================== */

function setTransactionType(type) {

  transactionType = type;

  document
    .getElementById("tabIncome")
    .classList.toggle(
      "active",
      type === "PEMASUKAN"
    );

  document
    .getElementById("tabExpense")
    .classList.toggle(
      "active",
      type === "PENGELUARAN"
    );
}


/* =====================================================
   MODAL
   ===================================================== */

function openModal(id) {

  document
    .getElementById(id)
    .classList.remove("hidden");
}


function closeModal(id) {

  document
    .getElementById(id)
    .classList.add("hidden");
}


/* =====================================================
   SIMPAN TRANSAKSI
   ===================================================== */

async function saveTransaction(event) {

  event.preventDefault();

  const payload = {

    tanggal:
      document.getElementById(
        "trxTanggal"
      ).value,

    tipe:
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


  try {

    await api(
      "tambahTransaksi",
      payload
    );

    toast("Transaksi berhasil disimpan.");

    event.target.reset();

    document.getElementById(
      "trxTanggal"
    ).value = today();

    await loadApp();

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   SIMPAN BARANG
   ===================================================== */

async function saveBarang(event) {

  event.preventDefault();

  const payload = {

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

    stok:
      Number(
        document.getElementById(
          "barangStok"
        ).value
      )

  };


  try {

    await api(
      "tambahBarang",
      payload
    );

    toast("Barang berhasil disimpan.");

    event.target.reset();

    closeModal("barangModal");

    await loadApp();

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   SIMPAN PENJUALAN
   ===================================================== */

async function savePenjualan(event) {

  event.preventDefault();

  const payload = {

    barangId:
      document.getElementById(
        "jualBarang"
      ).value,

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
      ).value,

    tanggal:
      today()

  };


  try {

    await api(
      "tambahPenjualan",
      payload
    );

    toast("Penjualan berhasil disimpan.");

    event.target.reset();

    await loadApp();

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   SIMPAN BELANJA
   ===================================================== */

async function saveBelanja(event) {

  event.preventDefault();

  const payload = {

    barangId:
      document.getElementById(
        "belanjaBarang"
      ).value,

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
      ).value,

    tanggal:
      today()

  };


  try {

    await api(
      "tambahBelanja",
      payload
    );

    toast("Belanja berhasil disimpan.");

    event.target.reset();

    await loadApp();

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   SIMPAN HUTANG
   ===================================================== */

async function saveHutang(event) {

  event.preventDefault();

  const payload = {

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

    jatuhTempo:
      document.getElementById(
        "hutangTempo"
      ).value,

    keterangan:
      document.getElementById(
        "hutangKeterangan"
      ).value,

    tanggal:
      today()

  };


  try {

    await api(
      "tambahHutang",
      payload
    );

    toast("Hutang berhasil disimpan.");

    event.target.reset();

    closeModal("hutangModal");

    await loadApp();

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   LAPORAN
   ===================================================== */

async function loadReport() {

  const mulai =
    document.getElementById(
      "reportStart"
    ).value;

  const akhir =
    document.getElementById(
      "reportEnd"
    ).value;


  if (!mulai || !akhir) {

    toast("Pilih tanggal laporan.");

    return;
  }


  const el =
    document.getElementById(
      "reportResult"
    );

  el.innerHTML =
    "Memuat laporan...";


  try {

    const result =
      await api(
        "laporan",
        {
          mulai,
          akhir
        }
      );


    const data =
      result || {};


    const pemasukan =
      Number(
        data.pemasukan ??
        data.totalPemasukan ??
        0
      );

    const pengeluaran =
      Number(
        data.pengeluaran ??
        data.totalPengeluaran ??
        0
      );

    const penjualan =
      Number(
        data.penjualan ??
        data.totalPenjualan ??
        0
      );

    const laba =
      Number(
        data.laba ??
        data.labaBersih ??
        (penjualan - pengeluaran)
      );


    el.innerHTML = `

      <div class="report-row">
        <span class="report-label">
          Periode
        </span>
        <strong>
          ${esc(mulai)} s/d ${esc(akhir)}
        </strong>
      </div>

      <div class="report-row">
        <span class="report-label">
          Pemasukan
        </span>
        <span class="report-value">
          ${rupiah(pemasukan)}
        </span>
      </div>

      <div class="report-row">
        <span class="report-label">
          Pengeluaran
        </span>
        <span class="report-value">
          ${rupiah(pengeluaran)}
        </span>
      </div>

      <div class="report-row">
        <span class="report-label">
          Penjualan
        </span>
        <span class="report-value">
          ${rupiah(penjualan)}
        </span>
      </div>

      <div class="report-row">
        <span class="report-label">
          Laba
        </span>
        <span class="report-value">
          ${rupiah(laba)}
        </span>
      </div>

    `;

  } catch (error) {

    el.innerHTML =
      `<div class="empty">
        ${esc(error.message)}
      </div>`;
  }
}


/* =====================================================
   UTIL
   ===================================================== */

function setText(id, value) {

  const el =
    document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}


function setLoading(show) {

  const el =
    document.getElementById(
      "loading"
    );

  if (!el) return;

  el.classList.toggle(
    "hidden",
    !show
  );
}


async function refreshApp() {

  closeMoreMenu();

  await loadApp();

  toast("Data diperbarui.");
}


/* =====================================================
   EVENT
   ===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    document.getElementById(
      "trxTanggal"
    ).value = today();


    document.getElementById(
      "reportEnd"
    ).value = today();


    const first =
      new Date();

    first.setDate(
      first.getDate() - 30
    );


    const y =
      first.getFullYear();

    const m =
      String(
        first.getMonth() + 1
      ).padStart(2, "0");

    const d =
      String(
        first.getDate()
      ).padStart(2, "0");


    document.getElementById(
      "reportStart"
    ).value =
      `${y}-${m}-${d}`;


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
      function () {

        const id =
          this.value;

        const barang =
          appData.barang.find(
            item =>
              String(
                item.id ??
                item.ID ??
                item.nama ??
                item.Nama ??
                ""
              ) === String(id)
          );


        if (barang) {

          document.getElementById(
            "jualHarga"
          ).value =
            Number(
              barang.hargaJual ??
              barang["Harga Jual"] ??
              0
            );

        }

      }
    );


    loadApp();

  }
);


/* =====================================================
   SERVICE WORKER
   =====================================================

   Service worker sengaja tidak dibuat sebagai file kelima.
   Agar GitHub tetap hanya memiliki 4 file, PWA dasar
   menggunakan manifest. Browser tetap dapat memasang
   aplikasi sebagai shortcut/PWA sesuai dukungan browser.
*/
```
