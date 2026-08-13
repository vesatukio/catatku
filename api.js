async function api(action, payload) {
  try {
    let url =
      API_URL +
      '?action=' +
      encodeURIComponent(action) +
      '&key=' +
      encodeURIComponent(API_KEY);

    if (payload !== undefined && payload !== null) {
      url += '&payload=' +
        encodeURIComponent(JSON.stringify(payload));
    }

    console.log('API:', action, url);

    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error('HTTP Error ' + response.status);
    }

    const text = await response.text();

    if (!text) {
      throw new Error('Server mengembalikan data kosong.');
    }

    let json;

    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error('Response bukan JSON:', text);
      throw new Error('Response API bukan JSON.');
    }

    if (!json.success) {
      throw new Error(
        json.error || 'Terjadi kesalahan pada server.'
      );
    }

    return json.data;

  } catch (err) {
    console.error('API ERROR [' + action + ']:', err);
    throw err;
  }
}
