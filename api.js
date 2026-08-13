async function api(action, payload){
  let url = API_URL + '?action=' + encodeURIComponent(action) + '&key=' + encodeURIComponent(API_KEY);
  if(payload){
    url += '&payload=' + encodeURIComponent(JSON.stringify(payload));
  }
  const response = await fetch(url, { method:'GET', cache:'no-store' });
  if(!response.ok){
    throw new Error('HTTP Error ' + response.status);
  }
  const json = await response.json();
  if(!json.success){
    throw new Error(json.error || 'Terjadi kesalahan.');
  }
  return json.data;
}
