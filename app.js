window.addEventListener("load", async () => {
  const hasil = document.createElement("div");

  hasil.style.cssText = `
    position:fixed;
    top:10px;
    left:10px;
    right:10px;
    z-index:999999;
    padding:20px;
    background:#111;
    color:#fff;
    font-size:18px;
    border-radius:12px;
  `;

  try {
    if (!window.indexedDB) {
      hasil.textContent = "❌ IndexedDB TIDAK TERSEDIA";
    } else {
      const request = indexedDB.open("CatatKuTest", 1);

      request.onsuccess = () => {
        hasil.textContent = "✅ IndexedDB BERHASIL DIBUKA";
        document.body.appendChild(hasil);
      };

      request.onerror = () => {
        hasil.textContent =
          "❌ IndexedDB ERROR: " +
          request.error;

        document.body.appendChild(hasil);
      };

      request.onupgradeneeded = () => {
        hasil.textContent =
          "🔄 IndexedDB sedang membuat database...";

        document.body.appendChild(hasil);
      };

      return;
    }
  } catch (e) {
    hasil.textContent =
      "❌ ERROR: " + e.message;
  }

  document.body.appendChild(hasil);
});

/* =========================================================
   CATATKU
   APP.JS FINAL - CHROME HP
   =========================================================

   MODE
   - OFFLINE FIRST
   - INDEXEDDB
   - GOOGLE APPS SCRIPT
   - AUTO SYNC
   - MANUAL REFRESH
   - BARANG
   - STOK
   - PENJUALAN
   - OMZET
   - UNTUNG
   - TRANSAKSI MASUK / KELUAR
   - QUEUE OFFLINE

   DATABASE LOKAL
   - Menggunakan database baru untuk menghindari
     database CatatKuDB lama yang rusak di Chrome HP.

   SERVER
   - Google Apps Script
   - Google Sheets

   KHUSUS
   - 1 HP
   ========================================================= */

"use strict";


/* =========================================================
   KONFIGURASI
   ========================================================= */

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzYYBPcHEKLcVHjOz0O1nTAkUrX6YbH3PgHWAWscVNX9-sBKwWRSgkqwd7ET02w_brc/exec";


/*
 * PENTING
 *
 * Jangan gunakan lagi "CatatKuDB".
 *
 * Database lama di Chrome HP bermasalah.
 * Kita gunakan nama baru.
 */
/* =========================================================
   INDEXEDDB
   CATATKU - CHROME HP SAFE
   ========================================================= */

const DB_NAME = "CatatKuDB_HP";
const DB_VERSION = 3;

const STORE = {
  transaksi: "transaksi",
  barang: "barang",
  penjualan: "penjualan",
  queue: "queue"
};

let db = null;
let dbOpening = null;


/* =========================================================
   CEK OBJECT STORE
   ========================================================= */

function hasAllStores(database) {

  return (
    database.objectStoreNames.contains(STORE.transaksi) &&
    database.objectStoreNames.contains(STORE.barang) &&
    database.objectStoreNames.contains(STORE.penjualan) &&
    database.objectStoreNames.contains(STORE.queue)
  );

}


/* =========================================================
   BUAT OBJECT STORE
   ========================================================= */

function createStores(database) {

  if (
    !database.objectStoreNames.contains(
      STORE.transaksi
    )
  ) {

    database.createObjectStore(
      STORE.transaksi,
      {
        keyPath: "id"
      }
    );

  }


  if (
    !database.objectStoreNames.contains(
      STORE.barang
    )
  ) {

    database.createObjectStore(
      STORE.barang,
      {
        keyPath: "id"
      }
    );

  }


  if (
    !database.objectStoreNames.contains(
      STORE.penjualan
    )
  ) {

    database.createObjectStore(
      STORE.penjualan,
      {
        keyPath: "id"
      }
    );

  }


  if (
    !database.objectStoreNames.contains(
      STORE.queue
    )
  ) {

    database.createObjectStore(
      STORE.queue,
      {
        keyPath: "id"
      }
    );

  }

}


/* =========================================================
   OPEN DATABASE
   ========================================================= */

function openDB() {

  /* -------------------------------------------------------
     Jika database sudah terbuka
     ------------------------------------------------------- */

  if (db) {

    try {

      if (
        hasAllStores(db)
      ) {

        return Promise.resolve(
          db
        );

      }

    }
    catch (error) {

      console.warn(
        "Koneksi DB lama tidak valid:",
        error
      );

      try {

        db.close();

      }
      catch (e) {}

      db = null;

    }

  }


  /* -------------------------------------------------------
     Jangan buka database berkali-kali
     ------------------------------------------------------- */

  if (dbOpening) {

    return dbOpening;

  }


  /* -------------------------------------------------------
     Cek IndexedDB
     ------------------------------------------------------- */

  if (
    !window.indexedDB
  ) {

    const error =
      new Error(
        "Chrome tidak menyediakan IndexedDB"
      );

    setDatabaseStatus(
      "IndexedDB tidak tersedia"
    );

    return Promise.reject(
      error
    );

  }


  /* -------------------------------------------------------
     Mulai membuka database
     ------------------------------------------------------- */

  dbOpening =
    new Promise(
      function(resolve, reject) {

        let request;


        try {

          request =
            indexedDB.open(
              DB_NAME,
              DB_VERSION
            );

        }
        catch (error) {

          dbOpening = null;

          setDatabaseStatus(
            "Gagal membuka database"
          );

          reject(
            error
          );

          return;

        }


        /* =================================================
           UPGRADE DATABASE
           ================================================= */

        request.onupgradeneeded =
          function(event) {

            try {

              const database =
                event.target.result;

              console.log(
                "IndexedDB upgrade:",
                event.oldVersion,
                "→",
                event.newVersion
              );


              createStores(
                database
              );

            }
            catch (error) {

              console.error(
                "IndexedDB UPGRADE ERROR:",
                error
              );

              throw error;

            }

          };


        /* =================================================
           BERHASIL
           ================================================= */

        request.onsuccess =
          function(event) {

            try {

              const database =
                event.target.result;


              /* -----------------------------------------
                 Pastikan semua store tersedia
                 ----------------------------------------- */

              if (
                !hasAllStores(
                  database
                )
              ) {

                console.error(
                  "Object store belum lengkap"
                );

                try {

                  database.close();

                }
                catch (e) {}

                db = null;
                dbOpening = null;

                reject(
                  new Error(
                    "Struktur database tidak lengkap"
                  )
                );

                return;

              }


              db =
                database;


              /* -----------------------------------------
                 Jika ada upgrade dari tab lain
                 ----------------------------------------- */

              database.onversionchange =
                function() {

                  console.log(
                    "Database version berubah"
                  );

                  try {

                    database.close();

                  }
                  catch (error) {

                    console.warn(
                      error
                    );

                  }

                  if (
                    db === database
                  ) {

                    db = null;

                  }

                };


              /* -----------------------------------------
                 Jika koneksi ditutup
                 ----------------------------------------- */

              database.onclose =
                function() {

                  console.warn(
                    "IndexedDB connection closed"
                  );

                  if (
                    db === database
                  ) {

                    db = null;

                  }

                };


              /* -----------------------------------------
                 Database siap
                 ----------------------------------------- */

              setDatabaseStatus(
                "Database lokal siap"
              );


              dbOpening =
                null;


              resolve(
                database
              );

            }
            catch (error) {

              db = null;
              dbOpening = null;

              reject(
                error
              );

            }

          };


        /* =================================================
           ERROR
           ================================================= */

        request.onerror =
          function(event) {

            const error =
              event.target.error ||
              new Error(
                "IndexedDB gagal dibuka"
              );


            console.error(
              "CATATKU IndexedDB ERROR:",
              error.name,
              error.message
            );


            db = null;
            dbOpening = null;


            setDatabaseStatus(
              "Database lokal gagal"
            );


            reject(
              error
            );

          };


        /* =================================================
           BLOCKED
           ================================================= */

        request.onblocked =
          function() {

            console.warn(
              "IndexedDB OPEN BLOCKED"
            );


            setDatabaseStatus(
              "Database sedang digunakan"
            );

          };

      }
    );


  return dbOpening;

}


/* =========================================================
   PASTIKAN DATABASE SIAP
   ========================================================= */

async function ensureDB() {

  try {

    const database =
      await openDB();


    if (
      !database
    ) {

      throw new Error(
        "Database tidak tersedia"
      );

    }


    if (
      !hasAllStores(
        database
      )
    ) {

      throw new Error(
        "Object store database tidak lengkap"
      );

    }


    return database;

  }
  catch (error) {

    console.error(
      "ensureDB:",
      error
    );


    db = null;


    throw error;

  }

}


/* =========================================================
   DB PUT
   ========================================================= */

async function dbPut(
  storeName,
  value
) {

  const database =
    await ensureDB();


  if (
    !Object.values(STORE)
      .includes(storeName)
  ) {

    throw new Error(
      "Store tidak dikenal: " +
      storeName
    );

  }


  return new Promise(
    function(resolve, reject) {

      let tx;


      try {

        tx =
          database.transaction(
            storeName,
            "readwrite"
          );


        const store =
          tx.objectStore(
            storeName
          );


        store.put(
          value
        );


        tx.oncomplete =
          function() {

            resolve(
              value
            );

          };


        tx.onerror =
          function() {

            reject(
              tx.error ||
              new Error(
                "Gagal menyimpan data"
              )
            );

          };


        tx.onabort =
          function() {

            reject(
              tx.error ||
              new Error(
                "Transaksi database dibatalkan"
              )
            );

          };

      }
      catch (error) {

        console.error(
          "dbPut:",
          error
        );


        /* ---------------------------------------------
           Jika koneksi DB sudah mati
           coba buka ulang
           --------------------------------------------- */

        db = null;


        reject(
          error
        );

      }

    }
  );

}


/* =========================================================
   DB GET ALL
   ========================================================= */

async function dbGetAll(
  storeName
) {

  const database =
    await ensureDB();


  return new Promise(
    function(resolve, reject) {

      try {

        const tx =
          database.transaction(
            storeName,
            "readonly"
          );


        const request =
          tx
            .objectStore(
              storeName
            )
            .getAll();


        request.onsuccess =
          function() {

            resolve(
              request.result || []
            );

          };


        request.onerror =
          function() {

            reject(
              request.error ||
              new Error(
                "Gagal membaca database"
              )
            );

          };

      }
      catch (error) {

        db = null;

        reject(
          error
        );

      }

    }
  );

}


/* =========================================================
   DB GET
   ========================================================= */

async function dbGet(
  storeName,
  id
) {

  if (!id) {

    return undefined;

  }


  const database =
    await ensureDB();


  return new Promise(
    function(resolve, reject) {

      try {

        const tx =
          database.transaction(
            storeName,
            "readonly"
          );


        const request =
          tx
            .objectStore(
              storeName
            )
            .get(id);


        request.onsuccess =
          function() {

            resolve(
              request.result
            );

          };


        request.onerror =
          function() {

            reject(
              request.error ||
              new Error(
                "Gagal membaca data"
              )
            );

          };

      }
      catch (error) {

        db = null;

        reject(
          error
        );

      }

    }
  );

}


/* =========================================================
   DB DELETE
   ========================================================= */

async function dbDelete(
  storeName,
  id
) {

  if (!id) {

    return false;

  }


  const database =
    await ensureDB();


  return new Promise(
    function(resolve, reject) {

      try {

        const tx =
          database.transaction(
            storeName,
            "readwrite"
          );


        tx.objectStore(
          storeName
        ).delete(
          id
        );


        tx.oncomplete =
          function() {

            resolve(
              true
            );

          };


        tx.onerror =
          function() {

            reject(
              tx.error ||
              new Error(
                "Gagal menghapus data"
              )
            );

          };


        tx.onabort =
          function() {

            reject(
              tx.error ||
              new Error(
                "Penghapusan dibatalkan"
              )
            );

          };

      }
      catch (error) {

        db = null;

        reject(
          error
        );

      }

    }
  );

}

/* =========================================================
   QUEUE
   ========================================================= */

async function addToQueue(
  type,
  data
) {

  const item = {

    id:
      uid("SYNC"),

    type:
      type,

    data:
      data,

    createdAt:
      new Date().toISOString()

  };


  await dbPut(
    STORE.queue,
    item
  );


  await updateSyncCount();


  return item;

}


/* =========================================================
   JUMLAH QUEUE
   ========================================================= */

async function updateSyncCount() {

  try {

    const queue =
      await dbGetAll(
        STORE.queue
      );


    if (!queue.length) {

      setSyncStatus(
        navigator.onLine
          ? "Tersinkron"
          : "Offline"
      );

    }
    else {

      setSyncStatus(
        queue.length +
        " data menunggu sync"
      );

    }

  }
  catch(error) {

    console.error(
      "updateSyncCount:",
      error
    );

  }

}


/* =========================================================
   GAS GET
   ========================================================= */

async function gasGet(
  action
) {

  if (
    !GAS_URL
  ) {

    throw new Error(
      "GAS_URL belum diisi"
    );

  }


  const url =
    GAS_URL +
    "?action=" +
    encodeURIComponent(
      action
    ) +
    "&t=" +
    Date.now();


  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        cache:
          "no-store"
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


  if (
    result &&
    result.success === false
  ) {

    throw new Error(
      result.error ||
      "GAS error"
    );

  }


  return result;

}


/* =========================================================
   GAS POST
   ========================================================= */

async function gasPost(
  action,
  data
) {

  if (
    !GAS_URL
  ) {

    throw new Error(
      "GAS_URL belum diisi"
    );

  }


  const response =
    await fetch(
      GAS_URL,
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "text/plain;charset=utf-8"

        },

        body:
          JSON.stringify({

            action:
              action,

            ...(data || {})

          })

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


  if (
    result &&
    result.success === false
  ) {

    throw new Error(
      result.error ||
      "GAS error"
    );

  }


  return result;

}


/* =========================================================
   SIMPAN TRANSAKSI
   ========================================================= */

async function saveTransaksi(
  data
) {

  const item = {

    id:
      data.id ||
      uid("TRX"),

    tanggal:
      data.tanggal ||
      today(),

    jenis:
      data.jenis ||
      "masuk",

    kategori:
      data.kategori ||
      "",

    keterangan:
      data.keterangan ||
      "",

    jumlah:
      Number(
        data.jumlah || 0
      ),

    sumber:
      data.sumber ||
      "toko",

    createdAt:
      data.createdAt ||
      new Date().toISOString(),

    _local:
      true

  };


  await dbPut(
    STORE.transaksi,
    item
  );


  await addToQueue(
    "transaksi",
    item
  );


  return item;

}


/* =========================================================
   SIMPAN BARANG
   ========================================================= */

async function saveBarang(
  data
) {

  const item = {

    id:
      data.id ||
      uid("BRG"),

    kode:
      data.kode ||
      "",

    nama:
      data.nama ||
      "",

    stok:
      Number(
        data.stok || 0
      ),

    hargaModal:
      Number(
        data.hargaModal || 0
      ),

    hargaJual:
      Number(
        data.hargaJual || 0
      ),

    terjual:
      Number(
        data.terjual || 0
      ),

    omzet:
      Number(
        data.omzet || 0
      ),

    untung:
      Number(
        data.untung || 0
      ),

    stokMin:
      Number(
        data.stokMin || 0
      ),

    updatedAt:
      data.updatedAt ||
      new Date().toISOString(),

    _local:
      true

  };


  await dbPut(
    STORE.barang,
    item
  );


  await addToQueue(
    "barang",
    item
  );


  return item;

}


/* =========================================================
   SIMPAN PENJUALAN
   ========================================================= */

async function savePenjualan(
  data
) {

  const barang =
    await dbGet(
      STORE.barang,
      data.barangId
    );


  if (!barang) {

    throw new Error(
      "Barang tidak ditemukan"
    );

  }


  const qty =
    Number(
      data.qty || 0
    );


  if (
    !Number.isFinite(qty) ||
    qty <= 0
  ) {

    throw new Error(
      "Jumlah penjualan tidak valid"
    );

  }


  const stok =
    Number(
      barang.stok || 0
    );


  if (
    qty > stok
  ) {

    throw new Error(
      "Stok tidak cukup. Tersedia " +
      stok
    );

  }


  const hargaModal =
    Number(
      barang.hargaModal || 0
    );


  const hargaJual =
    data.hargaJual !== undefined &&
    data.hargaJual !== ""
      ? Number(
          data.hargaJual
        )
      : Number(
          barang.hargaJual || 0
        );


  if (
    !Number.isFinite(hargaJual) ||
    hargaJual < 0
  ) {

    throw new Error(
      "Harga jual tidak valid"
    );

  }


  const omzet =
    qty *
    hargaJual;


  const modal =
    qty *
    hargaModal;


  const untung =
    omzet -
    modal;


  const item = {

    id:
      data.id ||
      uid("JUAL"),

    tanggal:
      data.tanggal ||
      today(),

    barangId:
      barang.id,

    namaBarang:
      barang.nama,

    kodeBarang:
      barang.kode ||
      "",

    qty:
      qty,

    hargaModal:
      hargaModal,

    hargaJual:
      hargaJual,

    omzet:
      omzet,

    modal:
      modal,

    untung:
      untung,

    createdAt:
      data.createdAt ||
      new Date().toISOString(),

    _local:
      true

  };


  /*
   * UPDATE STOK
   */

  barang.stok =
    stok -
    qty;


  barang.terjual =
    Number(
      barang.terjual || 0
    ) +
    qty;


  barang.omzet =
    Number(
      barang.omzet || 0
    ) +
    omzet;


  barang.untung =
    Number(
      barang.untung || 0
    ) +
    untung;


  barang.updatedAt =
    new Date().toISOString();


  await dbPut(
    STORE.barang,
    barang
  );


  await dbPut(
    STORE.penjualan,
    item
  );


  await addToQueue(
    "penjualan",
    item
  );


  return item;

}


/* =========================================================
   LOAD DATA SERVER
   ========================================================= */

async function loadRemoteData() {

  if (!navigator.onLine) {
    return false;
  }


  try {

    setSyncStatus(
      "Mengambil data server..."
    );


    const result =
      await gasGet(
        "appData"
      );


    if (
      !result ||
      !result.data
    ) {

      throw new Error(
        "Data GAS kosong"
      );

    }


    const data =
      result.data;


    /*
     * TRANSAKSI
     */

    if (
      Array.isArray(
        data.transaksi
      )
    ) {

      for (
        const item
        of data.transaksi
      ) {

        if (
          item &&
          item.id
        ) {

          await dbPut(
            STORE.transaksi,
            {
              ...item,
              _local: false
            }
          );

        }

      }

    }


    /*
     * BARANG
     */

    if (
      Array.isArray(
        data.barang
      )
    ) {

      for (
        const item
        of data.barang
      ) {

        if (
          item &&
          item.id
        ) {

          await dbPut(
            STORE.barang,
            {
              ...item,
              _local: false
            }
          );

        }

      }

    }


    /*
     * PENJUALAN
     */

    if (
      Array.isArray(
        data.penjualan
      )
    ) {

      for (
        const item
        of data.penjualan
      ) {

        if (
          item &&
          item.id
        ) {

          await dbPut(
            STORE.penjualan,
            {
              ...item,
              _local: false
            }
          );

        }

      }

    }


    setDatabaseStatus(
      "Database tersambung"
    );


    return true;

  }
  catch(error) {

    console.error(
      "loadRemoteData:",
      error
    );


    setDatabaseStatus(
      "Database lokal"
    );


    return false;

  }

}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {

  try {

    const transaksi =
      await dbGetAll(
        STORE.transaksi
      );


    const barang =
      await dbGetAll(
        STORE.barang
      );


    const penjualan =
      await dbGetAll(
        STORE.penjualan
      );


    let uangMasuk = 0;

    let uangKeluar = 0;

    let omzet = 0;

    let untung = 0;

    let jumlahStok = 0;

    let nilaiStok = 0;


    transaksi.forEach(
      function(item) {

        const jumlah =
          Number(
            item.jumlah || 0
          );


        if (
          String(
            item.jenis
          ).toLowerCase() ===
          "masuk"
        ) {

          uangMasuk +=
            jumlah;

        }
        else {

          uangKeluar +=
            jumlah;

        }

      }
    );


    penjualan.forEach(
      function(item) {

        omzet +=
          Number(
            item.omzet || 0
          );

        untung +=
          Number(
            item.untung || 0
          );

      }
    );


    barang.forEach(
      function(item) {

        const stok =
          Number(
            item.stok || 0
          );

        const modal =
          Number(
            item.hargaModal || 0
          );


        jumlahStok +=
          stok;

        nilaiStok +=
          stok *
          modal;

      }
    );


    setText(
      "saldo",
      rupiah(
        uangMasuk -
        uangKeluar
      )
    );


    setText(
      "pemasukan",
      rupiah(
        uangMasuk
      )
    );


    setText(
      "pengeluaran",
      rupiah(
        uangKeluar
      )
    );


    setText(
      "omzet",
      rupiah(
        omzet
      )
    );


    setText(
      "untung",
      rupiah(
        untung
      )
    );


    setText(
      "nilaiStok",
      rupiah(
        nilaiStok
      )
    );


    setText(
      "jumlahBarang",
      barang.length
    );


    setText(
      "jumlahStok",
      jumlahStok
    );


    renderPenjualanTerbaru(
      penjualan
    );

  }
  catch(error) {

    console.error(
      "loadDashboard:",
      error
    );

  }

}


/* =========================================================
   SET TEXT
   ========================================================= */

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


/* =========================================================
   PENJUALAN TERBARU
   ========================================================= */

function renderPenjualanTerbaru(
  data
) {

  const container =
    document.getElementById(
      "penjualanList"
    );


  if (!container) {
    return;
  }


  if (!data.length) {

    container.innerHTML =
      "<p>Belum ada penjualan.</p>";

    return;

  }


  const sorted =
    [...data]
      .sort(
        function(a, b) {

          return String(
            b.createdAt ||
            b.tanggal ||
            ""
          ).localeCompare(
            String(
              a.createdAt ||
              a.tanggal ||
              ""
            )
          );

        }
      )
      .slice(
        0,
        5
      );


  container.innerHTML =
    sorted
      .map(
        function(item) {

          return `

            <div class="list-item">

              <div>

                <strong>
                  ${escapeHtml(
                    item.namaBarang
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    item.tanggal || ""
                  )}

                  ·

                  ${Number(
                    item.qty || 0
                  )}

                  pcs
                </small>

              </div>

              <div>

                <strong>
                  ${rupiah(
                    item.omzet
                  )}
                </strong>

                <small>
                  Untung
                  ${rupiah(
                    item.untung
                  )}
                </small>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   TRANSAKSI
   ========================================================= */

async function loadTransaksi() {

  const data =
    await dbGetAll(
      STORE.transaksi
    );


  const container =
    document.getElementById(
      "transaksiList"
    );


  if (!container) {
    return data;
  }


  if (!data.length) {

    container.innerHTML =
      "<p>Belum ada transaksi.</p>";

    return data;

  }


  const sorted =
    [...data]
      .sort(
        function(a, b) {

          return String(
            b.createdAt ||
            b.tanggal ||
            ""
          ).localeCompare(
            String(
              a.createdAt ||
              a.tanggal ||
              ""
            )
          );

        }
      );


  container.innerHTML =
    sorted
      .map(
        function(item) {

          const masuk =
            String(
              item.jenis
            ).toLowerCase() ===
            "masuk";


          return `

            <div class="list-item">

              <div>

                <strong>
                  ${escapeHtml(
                    item.keterangan ||
                    item.kategori ||
                    "Transaksi"
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    item.tanggal || ""
                  )}

                  ·

                  ${escapeHtml(
                    item.sumber || ""
                  )}
                </small>

              </div>

              <strong class="${
                masuk
                  ? "text-success"
                  : "text-danger"
              }">

                ${
                  masuk
                    ? "+"
                    : "-"
                }

                ${rupiah(
                  item.jumlah
                )}

              </strong>

            </div>

          `;

        }
      )
      .join("");


  return data;

}


/* =========================================================
   BARANG
   ========================================================= */

async function loadBarang() {

  const data =
    await dbGetAll(
      STORE.barang
    );


  const container =
    document.getElementById(
      "barangList"
    );


  const select =
    document.getElementById(
      "barangId"
    );


  if (container) {

    if (!data.length) {

      container.innerHTML =
        "<p>Belum ada barang.</p>";

    }
    else {

      container.innerHTML =
        data
          .map(
            function(item) {

              const stok =
                Number(
                  item.stok || 0
                );


              const low =
                stok <=
                Number(
                  item.stokMin || 0
                );


              return `

                <div class="list-item">

                  <div>

                    <strong>
                      ${escapeHtml(
                        item.nama
                      )}
                    </strong>

                    <small>
                      ${escapeHtml(
                        item.kode || ""
                      )}
                    </small>

                  </div>

                  <div>

                    <strong>
                      ${rupiah(
                        item.hargaJual
                      )}
                    </strong>

                    <small class="${
                      low
                        ? "text-danger"
                        : ""
                    }">

                      Stok:
                      ${stok}

                    </small>

                  </div>

                </div>

              `;

            }
          )
          .join("");

    }

  }


  if (select) {

    const current =
      select.value;


    select.innerHTML =
      `
        <option value="">
          Pilih barang
        </option>
      `;


    data.forEach(
      function(item) {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          item.id;


        option.textContent =
          (
            item.kode
              ? item.kode + " - "
              : ""
          ) +
          item.nama +
          " | Stok " +
          Number(
            item.stok || 0
          );


        option.dataset.harga =
          Number(
            item.hargaJual || 0
          );


        select.appendChild(
          option
        );

      }
    );


    if (current) {

      select.value =
        current;

    }

  }


  return data;

}


/* =========================================================
   PENJUALAN
   ========================================================= */

async function loadPenjualan() {

  const data =
    await dbGetAll(
      STORE.penjualan
    );


  return data.sort(
    function(a, b) {

      return String(
        b.createdAt ||
        b.tanggal ||
        ""
      ).localeCompare(
        String(
          a.createdAt ||
          a.tanggal ||
          ""
        )
      );

    }
  );

}


async function renderPenjualanHistory() {

  const container =
    document.getElementById(
      "penjualanHistory"
    );


  if (!container) {
    return;
  }


  const data =
    await loadPenjualan();


  if (!data.length) {

    container.innerHTML =
      "<p>Belum ada penjualan.</p>";

    return;

  }


  container.innerHTML =
    data
      .map(
        function(item) {

          return `

            <div class="list-item">

              <div>

                <strong>
                  ${escapeHtml(
                    item.namaBarang
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    item.tanggal || ""
                  )}

                  ·

                  ${Number(
                    item.qty || 0
                  )}

                  pcs
                </small>

              </div>

              <div>

                <strong>
                  ${rupiah(
                    item.omzet
                  )}
                </strong>

                <small>
                  Untung:
                  ${rupiah(
                    item.untung
                  )}
                </small>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   FORM TRANSAKSI
   ========================================================= */

async function handleTransaksi(
  event
) {

  event.preventDefault();


  const form =
    event.target;


  const fd =
    new FormData(
      form
    );


  const data = {

    id:
      uid("TRX"),

    tanggal:
      fd.get("tanggal") ||
      today(),

    jenis:
      fd.get("jenis") ||
      "masuk",

    kategori:
      fd.get("kategori") ||
      "",

    keterangan:
      fd.get("keterangan") ||
      "",

    jumlah:
      Number(
        fd.get("jumlah") || 0
      ),

    sumber:
      fd.get("sumber") ||
      "toko",

    createdAt:
      new Date().toISOString()

  };


  if (
    !Number.isFinite(
      data.jumlah
    ) ||
    data.jumlah <= 0
  ) {

    toast(
      "Jumlah harus diisi"
    );

    return;

  }


  try {

    await saveTransaksi(
      data
    );


    form.reset();


    setDateDefaults();


    await loadTransaksi();

    await loadDashboard();


    toast(
      navigator.onLine
        ? "Transaksi disimpan"
        : "Disimpan offline"
    );


    if (navigator.onLine) {

      await sync();

    }

  }
  catch(error) {

    console.error(
      "handleTransaksi:",
      error
    );


    toast(
      error.message ||
      "Gagal menyimpan transaksi"
    );

  }

}


/* =========================================================
   FORM BARANG
   ========================================================= */

async function handleBarang(
  event
) {

  event.preventDefault();


  const form =
    event.target;


  const fd =
    new FormData(
      form
    );


  const nama =
    String(
      fd.get("nama") || ""
    ).trim();


  if (!nama) {

    toast(
      "Nama barang wajib diisi"
    );

    return;

  }


  const data = {

    id:
      uid("BRG"),

    kode:
      String(
        fd.get("kode") || ""
      ).trim(),

    nama:
      nama,

    stok:
      Number(
        fd.get("stok") || 0
      ),

    hargaModal:
      Number(
        fd.get("hargaModal") || 0
      ),

    hargaJual:
      Number(
        fd.get("hargaJual") || 0
      ),

    stokMin:
      Number(
        fd.get("stokMin") || 2
      ),

    terjual:
      0,

    omzet:
      0,

    untung:
      0,

    updatedAt:
      new Date().toISOString()

  };


  if (
    data.stok < 0
  ) {

    toast(
      "Stok tidak boleh minus"
    );

    return;

  }


  try {

    await saveBarang(
      data
    );


    form.reset();


    const stokMin =
      form.querySelector(
        '[name="stokMin"]'
      );


    if (stokMin) {

      stokMin.value =
        "2";

    }


    await loadBarang();

    await loadDashboard();


    toast(
      navigator.onLine
        ? "Barang disimpan"
        : "Barang disimpan offline"
    );


    if (navigator.onLine) {

      await sync();

    }

  }
  catch(error) {

    console.error(
      "handleBarang:",
      error
    );


    toast(
      error.message ||
      "Gagal menyimpan barang"
    );

  }

}


/* =========================================================
   SELECT BARANG
   ========================================================= */

function setupBarangSelect() {

  const select =
    document.getElementById(
      "barangId"
    );


  const harga =
    document.querySelector(
      '#penjualanForm [name="hargaJual"]'
    );


  if (
    !select ||
    !harga
  ) {

    return;

  }


  select.addEventListener(
    "change",
    async function() {

      if (!select.value) {

        harga.value =
          "";

        return;

      }


      try {

        const barang =
          await dbGet(
            STORE.barang,
            select.value
          );


        if (barang) {

          harga.value =
            Number(
              barang.hargaJual || 0
            );

        }
        else {

          harga.value =
            "";

        }

      }
      catch(error) {

        console.error(
          "barang select:",
          error
        );

      }

    }
  );

}


/* =========================================================
   FORM PENJUALAN
   ========================================================= */

async function handlePenjualan(
  event
) {

  event.preventDefault();


  const form =
    event.target;


  const fd =
    new FormData(
      form
    );


  const data = {

    id:
      uid("JUAL"),

    tanggal:
      fd.get("tanggal") ||
      today(),

    barangId:
      fd.get("barangId"),

    qty:
      Number(
        fd.get("qty") || 0
      ),

    hargaJual:
      fd.get("hargaJual"),

    createdAt:
      new Date().toISOString()

  };


  if (!data.barangId) {

    toast(
      "Pilih barang"
    );

    return;

  }


  if (
    !Number.isFinite(
      data.qty
    ) ||
    data.qty <= 0
  ) {

    toast(
      "Jumlah penjualan tidak valid"
    );

    return;

  }


  try {

    await savePenjualan(
      data
    );


    form.reset();


    setDateDefaults();


    const qty =
      form.querySelector(
        '[name="qty"]'
      );


    if (qty) {

      qty.value =
        "1";

    }


    await loadBarang();

    await loadDashboard();

    await renderPenjualanHistory();


    toast(
      navigator.onLine
        ? "Penjualan disimpan"
        : "Penjualan disimpan offline"
    );


    if (navigator.onLine) {

      await sync();

    }

  }
  catch(error) {

    console.error(
      "handlePenjualan:",
      error
    );


    toast(
      error.message ||
      "Gagal menyimpan penjualan"
    );

  }

}


/* =========================================================
   SYNC
   ========================================================= */

async function sync() {

  if (syncRunning) {
    return;
  }


  if (!navigator.onLine) {

    await updateSyncCount();

    setSyncStatus(
      "Offline - menunggu internet"
    );

    return;

  }


  syncRunning =
    true;


  try {

    const queue =
      await dbGetAll(
        STORE.queue
      );


    if (!queue.length) {

      setSyncStatus(
        "Tersinkron"
      );

      return;

    }


    setSyncStatus(
      "Mengirim " +
      queue.length +
      " data..."
    );


    const result =
      await gasPost(
        "sync",
        {
          items:
            queue
        }
      );


    if (
      !result ||
      !Array.isArray(
        result.results
      )
    ) {

      throw new Error(
        "Response sync tidak valid"
      );

    }


    let berhasil =
      0;

    let gagal =
      0;


    for (
      const resultItem
      of result.results
    ) {

      if (
        resultItem &&
        resultItem.success &&
        resultItem.id
      ) {

        await dbDelete(
          STORE.queue,
          resultItem.id
        );

        berhasil++;

      }
      else {

        gagal++;

      }

    }


    await updateSyncCount();


    /*
     * Jangan loadRemoteData di sini.
     *
     * Data lokal jangan langsung ditimpa
     * setelah berhasil sync.
     */

    await loadDashboard();

    await loadTransaksi();

    await loadBarang();

    await renderPenjualanHistory();


    if (gagal > 0) {

      setSyncStatus(
        gagal +
        " data gagal sync"
      );


      toast(
        berhasil +
        " berhasil, " +
        gagal +
        " gagal"
      );

    }
    else {

      setSyncStatus(
        "Tersinkron"
      );


      if (berhasil > 0) {

        toast(
          berhasil +
          " data berhasil sync"
        );

      }

    }

  }
  catch(error) {

    console.error(
      "SYNC ERROR:",
      error
    );


    setSyncStatus(
      "Sync gagal - data tetap aman"
    );

  }
  finally {

    syncRunning =
      false;

  }

}


/* =========================================================
   REFRESH
   ========================================================= */

async function refresh() {

  if (!navigator.onLine) {

    await loadDashboard();

    await loadTransaksi();

    await loadBarang();

    await renderPenjualanHistory();

    await updateSyncCount();


    toast(
      "Offline - menampilkan data HP"
    );


    return;

  }


  try {

    setSyncStatus(
      "Memeriksa data..."
    );


    await sync();


    const queue =
      await dbGetAll(
        STORE.queue
      );


    if (
      queue.length === 0
    ) {

      await loadRemoteData();

    }


    await loadDashboard();

    await loadTransaksi();

    await loadBarang();

    await renderPenjualanHistory();

    await updateSyncCount();


    setSyncStatus(
      "Tersinkron"
    );


    toast(
      "Data diperbarui"
    );

  }
  catch(error) {

    console.error(
      "REFRESH ERROR:",
      error
    );


    await loadDashboard();

    await loadTransaksi();

    await loadBarang();

    await renderPenjualanHistory();


    toast(
      "Gagal mengambil data server"
    );

  }

}


/* =========================================================
   DATE DEFAULT
   ========================================================= */

function setDateDefaults() {

  document
    .querySelectorAll(
      'input[type="date"]'
    )
    .forEach(
      function(input) {

        if (!input.value) {

          input.value =
            today();

        }

      }
    );

}


/* =========================================================
   TEST GOOGLE APPS SCRIPT
   ========================================================= */

async function testConnection() {

  if (!navigator.onLine) {

    setConnectionStatus(
      false,
      "Offline"
    );

    return false;

  }


  try {

    await gasGet(
      "ping"
    );


    setConnectionStatus(
      true,
      "Online"
    );


    setDatabaseStatus(
      "Database tersambung"
    );


    return true;

  }
  catch(error) {

    console.error(
      "TEST GAS:",
      error
    );


    setConnectionStatus(
      false,
      "GAS gagal"
    );


    setDatabaseStatus(
      "Database lokal"
    );


    return false;

  }

}


/* =========================================================
   INIT
   ========================================================= */

async function init() {

  try {

    updateConnection();

    setDateDefaults();


    /*
     * Buka database BARU.
     */

    await openDB();
await dbGetAll(STORE.barang);
await dbGetAll(STORE.transaksi);
await dbGetAll(STORE.penjualan);
await dbGetAll(STORE.queue);

    setDatabaseStatus(
      "Database lokal siap"
    );


    await updateSyncCount();


    /*
     * Tampilkan data lokal.
     */

    await loadDashboard();

    await loadTransaksi();

    await loadBarang();

    await renderPenjualanHistory();


    setupBarangSelect();


    /*
     * Jika online:
     *
     * 1. Tes GAS
     * 2. Ambil data server
     * 3. Sync queue
     */

    if (
      navigator.onLine
    ) {

      const connected =
        await testConnection();


      if (connected) {

        /*
         * Server menjadi sumber data
         * untuk database baru.
         */

        await loadRemoteData();


        await loadDashboard();

        await loadTransaksi();

        await loadBarang();

        await renderPenjualanHistory();


        await sync();

      }

    }


    setDateDefaults();

  }
  catch(error) {

    console.error(
      "INIT ERROR:",
      error
    );


    setDatabaseStatus(
      "Database lokal gagal"
    );


    toast(
      "Database lokal belum siap"
    );

  }

}


/* =========================================================
   EVENT FORM
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    const transaksiForm =
      document.getElementById(
        "transaksiForm"
      );


    if (transaksiForm) {

      transaksiForm.addEventListener(
        "submit",
        handleTransaksi
      );

    }


    const barangForm =
      document.getElementById(
        "barangForm"
      );


    if (barangForm) {

      barangForm.addEventListener(
        "submit",
        handleBarang
      );

    }


    const penjualanForm =
      document.getElementById(
        "penjualanForm"
      );


    if (penjualanForm) {

      penjualanForm.addEventListener(
        "submit",
        handlePenjualan
      );

    }


    setDateDefaults();


    init();

  }
);


/* =========================================================
   AUTO SYNC
   ========================================================= */

setInterval(
  async function() {

    if (
      navigator.onLine
    ) {

      try {

        await sync();

      }
      catch(error) {

        console.error(
          "AUTO SYNC:",
          error
        );

      }

    }

  },
  30000
);


/* =========================================================
   PUBLIC API
   ========================================================= */

window.CatatKu = {

  refresh:
    refresh,

  sync:
    sync,

  loadDashboard:
    loadDashboard,

  loadTransaksi:
    loadTransaksi,

  loadBarang:
    loadBarang,

  loadPenjualan:
    loadPenjualan,

  renderPenjualanHistory:
    renderPenjualanHistory,

  testConnection:
    testConnection,

  db:
    function() {

      return openDB();

    }

};
