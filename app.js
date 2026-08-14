/* =========================================================
   CATATKU
   APP.JS
   MOBILE FIRST + OFFLINE FIRST
   GOOGLE APPS SCRIPT BACKEND
   ========================================================= */

'use strict';


/* =========================================================
   KONFIGURASI
   ========================================================= */

/*
 * GANTI URL DI BAWAH DENGAN URL WEB APP GAS ANDA.
 *
 * Contoh:
 * https://script.google.com/macros/s/XXXXXXXXXXXX/exec
 */

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbxrgQIppwaphvBIQjMbV6e5EO18C6O066k0jbBvRWPCKKV1rp9A7TQhZfM9_I01lL6a/exec';


const DB_NAME =
  'CatatKuDB';

const DB_VERSION = 1;

const STORE_QUEUE =
  'offlineQueue';

const STORE_CACHE =
  'appCache';


/* =========================================================
   STATE APLIKASI
   ========================================================= */

const AppState = {

  online:
    navigator.onLine,

  loading:
    false,

  syncing:
    false,

  data: {

    dashboard: {},

    kategori: [],

    barang: [],

    history: [],

    hutang: []

  },

  queueCount: 0

};


/* =========================================================
   DOM HELPER
   ========================================================= */

function $(selector) {

  return document.querySelector(selector);

}


function $all(selector) {

  return Array.from(
    document.querySelectorAll(selector)
  );

}


function el(id) {

  return document.getElementById(id);

}


/* =========================================================
   FORMAT
   ========================================================= */

function rupiah(value) {

  const number =
    Number(value) || 0;

  return new Intl.NumberFormat(
    'id-ID',
    {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }
  ).format(number);

}


function number(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  if (
    typeof value === 'number'
  ) {
    return value;
  }

  const s =
    String(value)
      .replace(/[^\d.-]/g, '');

  return Number(s) || 0;

}


function today() {

  const d =
    new Date();

  const y =
    d.getFullYear();

  const m =
    String(
      d.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      d.getDate()
    ).padStart(2, '0');

  return `${y}-${m}-${day}`;

}


function formatTanggal(value) {

  if (!value) {
    return '-';
  }

  const d =
    new Date(value);

  if (
    isNaN(
      d.getTime()
    )
  ) {

    return String(value);

  }

  return d.toLocaleDateString(
    'id-ID',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  );

}


function escapeHTML(value) {

  return String(
    value ?? ''
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


/* =========================================================
   TOAST
   ========================================================= */

function toast(
  message,
  type = 'info'
) {

  let box =
    el('toast');

  if (!box) {

    box =
      document.createElement(
        'div'
      );

    box.id =
      'toast';

    document.body.appendChild(
      box
    );

  }

  box.className =
    `toast toast-${type}`;

  box.textContent =
    message;

  box.classList.add(
    'show'
  );

  clearTimeout(
    box._timer
  );

  box._timer =
    setTimeout(
      () => {

        box.classList.remove(
          'show'
        );

      },
      3000
    );

}


/* =========================================================
   STATUS ONLINE
   ========================================================= */

function updateConnectionStatus() {

  AppState.online =
    navigator.onLine;

  const badge =
    el('syncStatus');

  if (badge) {

    if (
      AppState.syncing
    ) {

      badge.textContent =
        '⟳ Menyinkronkan...';

      badge.className =
        'sync-status syncing';

    }

    else if (
      navigator.onLine
    ) {

      badge.textContent =
        '● Online';

      badge.className =
        'sync-status online';

    }

    else {

      badge.textContent =
        '● Offline';

      badge.className =
        'sync-status offline';

    }

  }

  updateQueueBadge();

}


/* =========================================================
   INDEXED DB
   ========================================================= */

let dbPromise = null;


function openDB() {

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise =
    new Promise(
      function(resolve, reject) {

        if (
          !window.indexedDB
        ) {

          reject(
            new Error(
              'Browser tidak mendukung IndexedDB.'
            )
          );

          return;

        }

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
              !db.objectStoreNames.contains(
                STORE_QUEUE
              )
            ) {

              const store =
                db.createObjectStore(
                  STORE_QUEUE,
                  {
                    keyPath: 'localId'
                  }
                );

              store.createIndex(
                'createdAt',
                'createdAt',
                {
                  unique: false
                }
              );

            }

            if (
              !db.objectStoreNames.contains(
                STORE_CACHE
              )
            ) {

              db.createObjectStore(
                STORE_CACHE,
                {
                  keyPath: 'key'
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

      }
    );

  return dbPromise;

}


/* =========================================================
   DB PUT QUEUE
   ========================================================= */

async function queueAdd(item) {

  const db =
    await openDB();

  return new Promise(
    function(resolve, reject) {

      const tx =
        db.transaction(
          STORE_QUEUE,
          'readwrite'
        );

      tx.objectStore(
        STORE_QUEUE
      ).put(item);

      tx.oncomplete =
        function() {

          resolve(true);

        };

      tx.onerror =
        function() {

          reject(
            tx.error
          );

        };

    }
  );

}


/* =========================================================
   DB GET QUEUE
   ========================================================= */

async function queueGetAll() {

  const db =
    await openDB();

  return new Promise(
    function(resolve, reject) {

      const tx =
        db.transaction(
          STORE_QUEUE,
          'readonly'
        );

      const request =
        tx.objectStore(
          STORE_QUEUE
        ).getAll();

      request.onsuccess =
        function() {

          const result =
            request.result || [];

          result.sort(
            function(a, b) {

              return (
                Number(a.createdAt || 0) -
                Number(b.createdAt || 0)
              );

            }
          );

          resolve(
            result
          );

        };

      request.onerror =
        function() {

          reject(
            request.error
          );

        };

    }
  );

}


/* =========================================================
   DB DELETE QUEUE
   ========================================================= */

async function queueDelete(
  localId
) {

  const db =
    await openDB();

  return new Promise(
    function(resolve, reject) {

      const tx =
        db.transaction(
          STORE_QUEUE,
          'readwrite'
        );

      tx.objectStore(
        STORE_QUEUE
      ).delete(
        localId
      );

      tx.oncomplete =
        function() {

          resolve(true);

        };

      tx.onerror =
        function() {

          reject(
            tx.error
          );

        };

    }
  );

}


/* =========================================================
   QUEUE COUNT
   ========================================================= */

async function updateQueueBadge() {

  try {

    const items =
      await queueGetAll();

    AppState.queueCount =
      items.length;

    const badge =
      el('queueCount');

    if (badge) {

      badge.textContent =
        items.length;

      badge.style.display =
        items.length
          ? 'inline-flex'
          : 'none';

    }

    const text =
      el('queueStatus');

    if (text) {

      text.textContent =
        items.length
          ? `${items.length} data menunggu sinkronisasi`
          : 'Semua data tersinkron';

    }

  } catch (err) {

    console.warn(
      'Queue:',
      err
    );

  }

}


/* =========================================================
   CACHE APP DATA
   ========================================================= */

async function cacheSet(
  key,
  value
) {

  try {

    const db =
      await openDB();

    return new Promise(
      function(resolve, reject) {

        const tx =
          db.transaction(
            STORE_CACHE,
            'readwrite'
          );

        tx.objectStore(
          STORE_CACHE
        ).put({

          key: key,

          value: value,

          updatedAt:
            Date.now()

        });

        tx.oncomplete =
          () => resolve(true);

        tx.onerror =
          () => reject(tx.error);

      }
    );

  } catch (err) {

    console.warn(
      'Cache set:',
      err
    );

  }

}


async function cacheGet(
  key
) {

  try {

    const db =
      await openDB();

    return new Promise(
      function(resolve, reject) {

        const tx =
          db.transaction(
            STORE_CACHE,
            'readonly'
          );

        const request =
          tx.objectStore(
            STORE_CACHE
          ).get(key);

        request.onsuccess =
          function() {

            resolve(
              request.result
                ? request.result.value
                : null
            );

          };

        request.onerror =
          function() {

            reject(
              request.error
            );

          };

      }
    );

  } catch (err) {

    return null;

  }

}


/* =========================================================
   FETCH GAS GET
   ========================================================= */

async function gasGet(
  action,
  params = {}
) {

  const url =
    new URL(
      GAS_URL
    );

  url.searchParams.set(
    'action',
    action
  );

  Object.keys(
    params
  ).forEach(
    function(key) {

      if (
        params[key] !== undefined &&
        params[key] !== null
      ) {

        url.searchParams.set(
          key,
          params[key]
        );

      }

    }
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      }
    );

  if (
    !response.ok
  ) {

    throw new Error(
      `HTTP ${response.status}`
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
      'GAS error'
    );

  }

  return result;

}


/* =========================================================
   FETCH GAS POST
   ========================================================= */

async function gasPost(
  payload
) {

  const response =
    await fetch(
      GAS_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'text/plain;charset=utf-8'
        },

        body:
          JSON.stringify(
            payload
          ),

        redirect:
          'follow'
      }
    );

  if (
    !response.ok
  ) {

    throw new Error(
      `HTTP ${response.status}`
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
      'GAS error'
    );

  }

  return result;

}


/* =========================================================
   LOAD APP DATA
   ========================================================= */

async function loadAppData(
  silent = false
) {

  if (
    !silent
  ) {

    AppState.loading =
      true;

  }

  try {

    if (
      navigator.onLine
    ) {

      const result =
        await gasGet(
          'appData'
        );

      const data =
        result.data ||
        result;

      AppState.data =
        normalizeAppData(
          data
        );

      await cacheSet(
        'appData',
        AppState.data
      );

      renderAll();

      await updateQueueBadge();

      return AppState.data;

    }

    throw new Error(
      'Offline'
    );

  } catch (err) {

    console.warn(
      'Gagal mengambil data server:',
      err
    );

    const cached =
      await cacheGet(
        'appData'
      );

    if (cached) {

      AppState.data =
        normalizeAppData(
          cached
        );

      renderAll();

      if (!silent) {

        toast(
          'Offline — memakai data terakhir.',
          'info'
        );

      }

      return AppState.data;

    }

    if (!silent) {

      toast(
        'Tidak dapat mengambil data.',
        'error'
      );

    }

    return null;

  } finally {

    AppState.loading =
      false;

    updateConnectionStatus();

  }

}


/* =========================================================
   NORMALIZE DATA
   ========================================================= */

function normalizeAppData(
  data
) {

  data =
    data || {};

  return {

    dashboard:
      data.dashboard || {},

    kategori:
      Array.isArray(
        data.kategori
      )
        ? data.kategori
        : [],

    barang:
      Array.isArray(
        data.barang
      )
        ? data.barang
        : [],

    history:
      Array.isArray(
        data.history
      )
        ? data.history
        : [],

    hutang:
      Array.isArray(
        data.hutang
      )
        ? data.hutang
        : [],

    serverTime:
      data.serverTime || ''

  };

}


/* =========================================================
   RENDER SEMUA
   ========================================================= */

function renderAll() {

  renderDashboard();

  renderBarang();

  renderKategori();

  renderHistory();

  renderHutang();

  updateSummary();

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  const d =
    AppState.data.dashboard ||
    {};

  setText(
    'saldo',
    rupiah(d.saldo)
  );

  setText(
    'pemasukan',
    rupiah(d.pemasukan)
  );

  setText(
    'pengeluaran',
    rupiah(d.pengeluaran)
  );

  setText(
    'penjualan',
    rupiah(d.penjualan)
  );

  setText(
    'saldoPribadi',
    rupiah(d.saldoPribadi)
  );

  setText(
    'saldoToko',
    rupiah(d.saldoToko)
  );

  setText(
    'pemasukanPribadi',
    rupiah(d.pemasukanPribadi)
  );

  setText(
    'pengeluaranPribadi',
    rupiah(d.pengeluaranPribadi)
  );

  setText(
    'pemasukanToko',
    rupiah(d.pemasukanToko)
  );

  setText(
    'pengeluaranToko',
    rupiah(d.pengeluaranToko)
  );

  setText(
    'pemasukanHariIni',
    rupiah(d.pemasukanHariIni)
  );

  setText(
    'pengeluaranHariIni',
    rupiah(d.pengeluaranHariIni)
  );

  setText(
    'totalHutang',
    rupiah(d.totalHutang)
  );

  setText(
    'nilaiStok',
    rupiah(d.nilaiStok)
  );

  setText(
    'jumlahBarang',
    d.jumlahBarang || 0
  );

}


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(
  id,
  value
) {

  const node =
    el(id);

  if (node) {

    node.textContent =
      value;

  }

}


/* =========================================================
   UPDATE SUMMARY
   ========================================================= */

function updateSummary() {

  const d =
    AppState.data.dashboard ||
    {};

  const mappings = {

    saldoTotal:
      d.saldo,

    totalSaldo:
      d.saldo,

    totalPemasukan:
      d.pemasukan,

    totalPengeluaran:
      d.pengeluaran,

    totalPenjualan:
      d.penjualan,

    stokValue:
      d.nilaiStok,

    hutangTotal:
      d.totalHutang

  };

  Object.keys(
    mappings
  ).forEach(
    function(id) {

      const node =
        el(id);

      if (node) {

        node.textContent =
          typeof mappings[id] === 'number'
            ? rupiah(mappings[id])
            : mappings[id];

      }

    }
  );

}


/* =========================================================
   BARANG
   ========================================================= */

function renderBarang(
  list = null
) {

  const barang =
    list ||
    AppState.data.barang ||
    [];

  const container =
    el('barangList') ||
    el('daftarBarang') ||
    el('produkList');

  if (!container) {
    return;
  }

  if (!barang.length) {

    container.innerHTML =
      `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <strong>Belum ada barang</strong>
        <small>Tambahkan barang pertama Anda.</small>
      </div>
      `;

    return;

  }

  container.innerHTML =
    barang.map(
      function(b) {

        const stok =
          number(b.stok);

        const minimum =
          number(b.minimum);

        const lowStock =
          minimum > 0 &&
          stok <= minimum;

        return `
          <div class="barang-card"
               data-id="${escapeHTML(b.id)}">

            <div class="barang-card-top">

              <div>

                <div class="barang-nama">
                  ${escapeHTML(
                    b.nama || 'Tanpa Nama'
                  )}
                </div>

                <div class="barang-kategori">
                  ${escapeHTML(
                    b.kategori || 'Lainnya'
                  )}
                </div>

              </div>

              ${
                lowStock
                  ? `<span class="stok-warning">
                       Stok menipis
                     </span>`
                  : ''
              }

            </div>

            <div class="barang-info">

              <div>
                <small>Modal</small>
                <strong>
                  ${rupiah(b.modal)}
                </strong>
              </div>

              <div>
                <small>Jual</small>
                <strong>
                  ${rupiah(b.jual)}
                </strong>
              </div>

              <div>
                <small>Stok</small>
                <strong>
                  ${stok}
                </strong>
              </div>

            </div>

          </div>
        `;

      }
    ).join('');

}


/* =========================================================
   SEARCH BARANG
   ========================================================= */

function searchBarang(
  keyword
) {

  const q =
    String(
      keyword || ''
    )
      .toLowerCase()
      .trim();

  const result =
    AppState.data.barang
      .filter(
        function(b) {

          return (

            String(b.nama || '')
              .toLowerCase()
              .includes(q)

            ||

            String(b.kategori || '')
              .toLowerCase()
              .includes(q)

            ||

            String(b.supplier || '')
              .toLowerCase()
              .includes(q)

          );

        }
      );

  renderBarang(
    result
  );

}


/* =========================================================
   KATEGORI
   ========================================================= */

function renderKategori() {

  const selects =
    $all(
      'select[name="kategori"], #kategori, .kategori-select'
    );

  const categories =
    AppState.data.kategori ||
    [];

  selects.forEach(
    function(select) {

      const current =
        select.value;

      select.innerHTML =
        '<option value="">Pilih kategori</option>' +

        categories.map(
          function(k) {

            return `
              <option value="${escapeHTML(k)}">
                ${escapeHTML(k)}
              </option>
            `;

          }
        ).join('');

      if (
        current &&
        categories.includes(current)
      ) {

        select.value =
          current;

      }

    }
  );

}


/* =========================================================
   HISTORY
   ========================================================= */

function renderHistory(
  list = null
) {

  const history =
    list ||
    AppState.data.history ||
    [];

  const container =
    el('historyList') ||
    el('riwayatList') ||
    el('transaksiList');

  if (!container) {
    return;
  }

  if (!history.length) {

    container.innerHTML =
      `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <strong>Belum ada transaksi</strong>
        <small>Transaksi yang Anda buat akan muncul di sini.</small>
      </div>
      `;

    return;

  }

  container.innerHTML =
    history.map(
      function(x) {

        const jenis =
          String(
            x.jenis || ''
          ).toUpperCase();

        const positive =
          jenis === 'PEMASUKAN' ||
          jenis === 'PENJUALAN';

        const nominal =
          number(x.nominal);

        return `
          <div class="history-item">

            <div class="history-main">

              <div class="history-title">
                ${escapeHTML(
                  x.keterangan ||
                  x.nama ||
                  x.barangNama ||
                  x.kategori ||
                  'Transaksi'
                )}
              </div>

              <div class="history-meta">

                ${escapeHTML(
                  x.tanggal || ''
                )}

                ${x.kategori
                  ? ' • ' +
                    escapeHTML(x.kategori)
                  : ''}

              </div>

            </div>

            <div class="
              history-nominal
              ${positive
                ? 'positive'
                : 'negative'}
            ">

              ${positive ? '+' : '-'}

              ${rupiah(nominal)}

            </div>

          </div>
        `;

      }
    ).join('');

}


/* =========================================================
   HUTANG
   ========================================================= */

function renderHutang(
  list = null
) {

  const hutang =
    list ||
    AppState.data.hutang ||
    [];

  const container =
    el('hutangList') ||
    el('daftarHutang');

  if (!container) {
    return;
  }

  if (!hutang.length) {

    container.innerHTML =
      `
      <div class="empty-state">
        <div class="empty-icon">💳</div>
        <strong>Belum ada hutang</strong>
        <small>Data hutang akan tampil di sini.</small>
      </div>
      `;

    return;

  }

  container.innerHTML =
    hutang.map(
      function(h) {

        const total =
          number(h.nominal);

        const dibayar =
          number(h.dibayar);

        const sisa =
          Math.max(
            0,
            total - dibayar
          );

        const lunas =
          String(
            h.status || ''
          ).toUpperCase() ===
          'LUNAS';

        return `
          <div class="hutang-card">

            <div class="hutang-top">

              <div>

                <strong>
                  ${escapeHTML(
                    h.nama ||
                    h.supplier ||
                    h.keterangan ||
                    'Hutang'
                  )}
                </strong>

                <small>
                  ${escapeHTML(
                    h.keterangan || ''
                  )}
                </small>

              </div>

              <span class="
                hutang-status
                ${lunas
                  ? 'lunas'
                  : 'belum-lunas'}
              ">
                ${
                  lunas
                    ? 'LUNAS'
                    : 'BELUM LUNAS'
                }
              </span>

            </div>

            <div class="hutang-detail">

              <div>
                <small>Total</small>
                <strong>
                  ${rupiah(total)}
                </strong>
              </div>

              <div>
                <small>Dibayar</small>
                <strong>
                  ${rupiah(dibayar)}
                </strong>
              </div>

              <div>
                <small>Sisa</small>
                <strong>
                  ${rupiah(sisa)}
                </strong>
              </div>

            </div>

            <div class="hutang-footer">

              <span>
                Jatuh tempo:
                ${formatTanggal(
                  h.jatuhTempo
                )}
              </span>

              ${
                !lunas
                  ? `
                    <button
                      type="button"
                      class="btn-bayar-hutang"
                      data-id="${escapeHTML(h.id)}"
                      data-sisa="${sisa}">
                      Bayar
                    </button>
                  `
                  : ''
              }

            </div>

          </div>
        `;

      }
    ).join('');

}


/* =========================================================
   SIMPAN DATA
   ========================================================= */

async function saveAction(
  action,
  data
) {

  const localId =
    data.id ||
    newIDLocal();

  const payload = {

    ...data,

    action:
      action,

    id:
      localId

  };


  /*
   * OFFLINE
   */

  if (
    !navigator.onLine
  ) {

    await queueAdd({

      localId:
        localId,

      action:
        action,

      payload:
        payload,

      createdAt:
        Date.now()

    });

    await updateQueueBadge();

    toast(
      'Disimpan offline. Akan dikirim saat online.',
      'info'
    );

    return {

      success:
        true,

      offline:
        true,

      id:
        localId

    };

  }


  /*
   * ONLINE
   */

  try {

    const result =
      await gasPost(
        payload
      );

    toast(
      result.data &&
      result.data.message
        ? result.data.message
        : 'Data berhasil disimpan.',
      'success'
    );

    await loadAppData(
      true
    );

    return result;

  } catch (err) {

    console.warn(
      'POST gagal:',
      err
    );


    /*
     * Jika gagal karena jaringan,
     * simpan ke queue.
     */

    await queueAdd({

      localId:
        localId,

      action:
        action,

      payload:
        payload,

      createdAt:
        Date.now(),

      error:
        err.message ||
        String(err)

    });

    await updateQueueBadge();

    toast(
      'Internet bermasalah. Data disimpan offline.',
      'info'
    );

    return {

      success:
        true,

      offline:
        true,

      id:
        localId

    };

  }

}


/* =========================================================
   ID LOCAL
   ========================================================= */

function newIDLocal() {

  return (
    'LOCAL_' +
    Date.now() +
    '_' +
    Math.floor(
      Math.random() * 999999
    )
  );

}


/* =========================================================
   TAMBAH TRANSAKSI
   ========================================================= */

async function tambahTransaksi(
  data
) {

  return saveAction(
    'tambahTransaksi',
    {

      id:
        data.id,

      tanggal:
        data.tanggal ||
        today(),

      jenis:
        data.jenis,

      kategori:
        data.kategori,

      keterangan:
        data.keterangan,

      nominal:
        number(data.nominal),

      rekening:
        data.rekening ||
        'Kas'

    }
  );

}


/* =========================================================
   TAMBAH BARANG
   ========================================================= */

async function tambahBarang(
  data
) {

  return saveAction(
    'tambahBarang',
    {

      id:
        data.id,

      nama:
        data.nama,

      kategori:
        data.kategori ||
        'Lainnya',

      modal:
        number(data.modal),

      jual:
        number(data.jual),

      stok:
        number(data.stok),

      minimum:
        number(data.minimum),

      supplier:
        data.supplier || ''

    }
  );

}


/* =========================================================
   PENJUALAN
   ========================================================= */

async function tambahPenjualan(
  data
) {

  return saveAction(
    'tambahPenjualan',
    {

      id:
        data.id,

      tanggal:
        data.tanggal ||
        today(),

      barangID:
        data.barangID,

      barangNama:
        data.barangNama,

      qty:
        Math.max(
          1,
          number(data.qty)
        ),

      harga:
        number(data.harga),

      rekening:
        data.rekening ||
        'Kas',

      pelanggan:
        data.pelanggan ||
        '',

      keterangan:
        data.keterangan ||
        ''

    }
  );

}


/* =========================================================
   BELANJA
   ========================================================= */

async function tambahBelanja(
  data
) {

  return saveAction(
    'tambahBelanja',
    {

      id:
        data.id,

      tanggal:
        data.tanggal ||
        today(),

      barangID:
        data.barangID,

      barangNama:
        data.barangNama,

      qty:
        Math.max(
          1,
          number(data.qty)
        ),

      harga:
        number(data.harga),

      rekening:
        data.rekening ||
        'Kas',

      supplier:
        data.supplier ||
        '',

      keterangan:
        data.keterangan ||
        ''

    }
  );

}


/* =========================================================
   HUTANG
   ========================================================= */

async function tambahHutang(
  data
) {

  return saveAction(
    'tambahHutang',
    {

      id:
        data.id,

      tanggal:
        data.tanggal ||
        today(),

      nama:
        data.nama,

      keterangan:
        data.keterangan,

      nominal:
        number(data.nominal),

      rekening:
        data.rekening ||
        'Kas',

      jatuhTempo:
        data.jatuhTempo || ''

    }
  );

}


/* =========================================================
   BAYAR HUTANG
   ========================================================= */

async function bayarHutang(
  id,
  nominal
) {

  return saveAction(
    'bayarHutang',
    {

      id:
        id,

      nominal:
        number(nominal)

    }
  );

}


/* =========================================================
   SINKRONISASI OFFLINE
   ========================================================= */

async function syncOffline() {

  if (
    AppState.syncing
  ) {

    return;

  }

  if (
    !navigator.onLine
  ) {

    await updateConnectionStatus();

    return;

  }

  const items =
    await queueGetAll();

  if (!items.length) {

    await updateQueueBadge();

    return;

  }

  AppState.syncing =
    true;

  updateConnectionStatus();

  try {

    /*
     * Kirim satu per satu.
     *
     * Ini sengaja agar jika salah satu gagal,
     * data lainnya tetap dapat diproses.
     */

    for (
      const item of items
    ) {

      if (
        !navigator.onLine
      ) {

        break;

      }

      try {

        await gasPost(
          item.payload
        );

        await queueDelete(
          item.localId
        );

      } catch (err) {

        console.warn(
          'Sync gagal:',
          item,
          err
        );

        /*
         * Jangan hapus.
         * Akan dicoba lagi nanti.
         */

      }

    }

  } finally {

    AppState.syncing =
      false;

    await updateQueueBadge();

    updateConnectionStatus();

  }


  /*
   * Ambil data terbaru dari server.
   */

  if (
    navigator.onLine
  ) {

    await loadAppData(
      true
    );

  }

}


/* =========================================================
   PING SERVER
   ========================================================= */

async function pingServer() {

  try {

    const result =
      await gasGet(
        'ping'
      );

    console.log(
      'CatatKu GAS:',
      result
    );

    return true;

  } catch (err) {

    console.warn(
      'Ping gagal:',
      err
    );

    return false;

  }

}


/* =========================================================
   LAPORAN
   ========================================================= */

async function loadLaporan(
  start,
  end
) {

  try {

    const result =
      await gasGet(
        'laporan',
        {
          start:
            start || '',

          end:
            end || ''
        }
      );

    return (
      result.data ||
      result
    );

  } catch (err) {

    toast(
      'Gagal mengambil laporan.',
      'error'
    );

    return null;

  }

}


/* =========================================================
   FORM TRANSAKSI
   ========================================================= */

function getFormData(
  form
) {

  const data = {};

  if (!form) {
    return data;
  }

  const fields =
    form.querySelectorAll(
      'input, select, textarea'
    );

  fields.forEach(
    function(field) {

      if (
        !field.name
      ) {
        return;
      }

      data[field.name] =
        field.value;

    }
  );

  return data;

}


/* =========================================================
   FORM HANDLER
   ========================================================= */

async function handleFormSubmit(
  form
) {

  const action =
    form.dataset.action ||
    form.getAttribute(
      'data-action'
    );

  if (!action) {

    return;

  }

  const data =
    getFormData(
      form
    );

  try {

    await saveAction(
      action,
      data
    );

    /*
     * Reset hanya jika berhasil.
     */

    form.reset();

    /*
     * Isi kembali tanggal hari ini
     * jika ada input tanggal.
     */

    const dateInput =
      form.querySelector(
        'input[type="date"]'
      );

    if (dateInput) {

      dateInput.value =
        today();

    }

  } catch (err) {

    console.error(
      err
    );

    toast(
      err.message ||
      'Gagal menyimpan data.',
      'error'
    );

  }

}


/* =========================================================
   EVENT FORM
   ========================================================= */

function initForms() {

  $all(
    'form[data-action]'
  ).forEach(
    function(form) {

      form.addEventListener(
        'submit',
        function(event) {

          event.preventDefault();

          handleFormSubmit(
            form
          );

        }
      );

    }
  );

}


/* =========================================================
   SEARCH EVENT
   ========================================================= */

function initSearch() {

  const inputs =
    $all(
      '#searchBarang, [data-search="barang"]'
    );

  inputs.forEach(
    function(input) {

      input.addEventListener(
        'input',
        function() {

          searchBarang(
            input.value
          );

        }
      );

    }
  );

}


/* =========================================================
   BUTTON BAYAR HUTANG
   ========================================================= */

function initHutangButtons() {

  document.addEventListener(
    'click',
    async function(event) {

      const button =
        event.target.closest(
          '.btn-bayar-hutang'
        );

      if (!button) {
        return;
      }

      const id =
        button.dataset.id;

      const sisa =
        number(
          button.dataset.sisa
        );

      if (!id) {
        return;
      }

      let nominal =
        prompt(
          `Masukkan jumlah pembayaran.\nSisa hutang: ${rupiah(sisa)}`
        );

      if (
        nominal === null
      ) {

        return;

      }

      nominal =
        number(
          nominal
        );

      if (
        nominal <= 0
      ) {

        toast(
          'Nominal pembayaran tidak valid.',
          'error'
        );

        return;

      }

      if (
        nominal > sisa
      ) {

        nominal =
          sisa;

      }

      await bayarHutang(
        id,
        nominal
      );

    }
  );

}


/* =========================================================
   REFRESH BUTTON
   ========================================================= */

function initRefresh() {

  $all(
    '[data-refresh], #btnRefresh'
  ).forEach(
    function(button) {

      button.addEventListener(
        'click',
        async function() {

          if (
            !navigator.onLine
          ) {

            toast(
              'Tidak ada internet.',
              'info'
            );

            return;

          }

          await syncOffline();

          await loadAppData();

          toast(
            'Data diperbarui.',
            'success'
          );

        }
      );

    }
  );

}


/* =========================================================
   SYNC BUTTON
   ========================================================= */

function initSyncButton() {

  $all(
    '[data-sync], #btnSync'
  ).forEach(
    function(button) {

      button.addEventListener(
        'click',
        async function() {

          if (
            !navigator.onLine
          ) {

            toast(
              'Masih offline.',
              'info'
            );

            return;

          }

          await syncOffline();

        }
      );

    }
  );

}


/* =========================================================
   NETWORK EVENT
   ========================================================= */

function initNetwork() {

  window.addEventListener(
    'online',
    async function() {

      updateConnectionStatus();

      toast(
        'Internet kembali. Sinkronisasi...',
        'success'
      );

      await syncOffline();

    }
  );


  window.addEventListener(
    'offline',
    function() {

      updateConnectionStatus();

      toast(
        'Offline. Data baru akan disimpan di perangkat.',
        'info'
      );

    }
  );

}


/* =========================================================
   SERVICE WORKER
   ========================================================= */

function initServiceWorker() {

  if (
    !('serviceWorker' in navigator)
  ) {

    return;

  }

  window.addEventListener(
    'load',
    function() {

      /*
       * Untuk GitHub Pages /catatku/
       * gunakan ./service-worker.js
       */

      navigator.serviceWorker
        .register(
          './service-worker.js'
        )
        .then(
          function(registration) {

            console.log(
              'Service Worker aktif:',
              registration.scope
            );

          }
        )
        .catch(
          function(err) {

            console.warn(
              'Service Worker gagal:',
              err
            );

          }
        );

    }
  );

}


/* =========================================================
   TANGGAL DEFAULT
   ========================================================= */

function initDateInputs() {

  $all(
    'input[type="date"]'
  ).forEach(
    function(input) {

      if (
        !input.value
      ) {

        input.value =
          today();

      }

    }
  );

}


/* =========================================================
   SELECT BARANG
   ========================================================= */

function populateBarangSelect() {

  const selects =
    $all(
      'select[name="barangID"], #barangID'
    );

  selects.forEach(
    function(select) {

      const current =
        select.value;

      select.innerHTML =
        '<option value="">Pilih barang</option>' +

        AppState.data.barang
          .map(
            function(b) {

              return `
                <option
                  value="${escapeHTML(b.id)}"
                  data-harga="${number(b.jual)}"
                  data-modal="${number(b.modal)}"
                  data-nama="${escapeHTML(b.nama)}">

                  ${escapeHTML(
                    b.nama || 'Tanpa Nama'
                  )}
                  — Stok ${number(b.stok)}

                </option>
              `;

            }
          )
          .join('');

      if (
        current
      ) {

        select.value =
          current;

      }

    }
  );

}


/* =========================================================
   BARANG CHANGE
   ========================================================= */

function initBarangSelect() {

  document.addEventListener(
    'change',
    function(event) {

      const select =
        event.target.closest(
          'select[name="barangID"], #barangID'
        );

      if (!select) {
        return;
      }

      const option =
        select.options[
          select.selectedIndex
        ];

      if (!option) {
        return;
      }

      const nama =
        option.dataset.nama ||
        '';

      const harga =
        option.dataset.harga ||
        '0';

      const namaInput =
        document.querySelector(
          '[name="barangNama"], #barangNama'
        );

      const hargaInput =
        document.querySelector(
          '[name="harga"], #harga'
        );

      if (
        namaInput &&
        !namaInput.value
      ) {

        namaInput.value =
          nama;

      }

      if (
        hargaInput &&
        !hargaInput.value
      ) {

        hargaInput.value =
          harga;

      }

    }
  );

}


/* =========================================================
   INIT
   ========================================================= */

async function initCatatKu() {

  console.log(
    'CatatKu mulai...'
  );

  updateConnectionStatus();

  initForms();

  initSearch();

  initHutangButtons();

  initRefresh();

  initSyncButton();

  initNetwork();

  initDateInputs();

  initBarangSelect();

  initServiceWorker();

  /*
   * Buka IndexedDB lebih awal.
   */

  try {

    await openDB();

  } catch (err) {

    console.warn(
      'IndexedDB:',
      err
    );

  }

  /*
   * Load data server/cache.
   */

  await loadAppData();

  /*
   * Jika online,
   * kirim antrean offline.
   */

  if (
    navigator.onLine
  ) {

    await syncOffline();

  }

  populateBarangSelect();

  renderAll();

  updateConnectionStatus();

  console.log(
    'CatatKu siap.'
  );

}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.CatatKu = {

  state:
    AppState,

  load:
    loadAppData,

  refresh:
    loadAppData,

  sync:
    syncOffline,

  ping:
    pingServer,

  laporan:
    loadLaporan,

  tambahTransaksi:
    tambahTransaksi,

  tambahBarang:
    tambahBarang,

  tambahPenjualan:
    tambahPenjualan,

  tambahBelanja:
    tambahBelanja,

  tambahHutang:
    tambahHutang,

  bayarHutang:
    bayarHutang,

  searchBarang:
    searchBarang,

  rupiah:
    rupiah

};


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    initCatatKu
  );

} else {

  initCatatKu();

}
