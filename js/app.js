// Endpoints ThingSpeak (can ajustarse al canal que uses)
// - THINGSPEAK_LAST: devuelve el último registro del canal en formato JSON
// - THINGSPEAK_FEEDS: devuelve un conjunto (results=50) de registros históricos
const THINGSPEAK_LAST = 'https://api.thingspeak.com/channels/3403595/feeds/last.json';
const THINGSPEAK_FEEDS = 'https://api.thingspeak.com/channels/3403595/feeds.json?results=50';

// Referencias a elementos del DOM usados para mostrar estado, botones e valores
const statusEl = document.getElementById('status');          // indicador online/offline
const btnRefresh = document.getElementById('btn-refresh');   // botón para refrescar datos
const btnDevice = document.getElementById('btn-device');     // botón para mostrar info del dispositivo
const btnCloseDevice = document.getElementById('btn-close-device'); // botón para cerrar panel de dispositivo

// Elementos donde mostramos las lecturas (humedad, temperaturas, id de sesión)
const valHumedad = document.getElementById('val-humedad');   // muestra humedad (field1)
const valTempAmb = document.getElementById('val-temp-amb');  // muestra temp ambiente (field2)
const valTempBio = document.getElementById('val-temp-bio');  // muestra temp biorreactor (field3)
const valId = document.getElementById('val-id');            // muestra id o session (field4)

// Panel informativo de dispositivo (abierto/oculto) y contenedor JSON
const deviceInfo = document.getElementById('device-info');
const deviceJson = document.getElementById('device-json');

// Variables para Chart.js (se inicializan en createCharts)
let chartHumedad, chartTempAmb, chartTempBio;

function setStatus(online){
  statusEl.textContent = online ? 'Online' : 'Offline';
  statusEl.className = 'status ' + (online ? 'online' : 'offline');
}

async function fetchLast(){
  try{
    const res = await fetch(THINGSPEAK_LAST);
    if(!res.ok) throw new Error(res.status);
    // parsea la respuesta JSON a objeto JS
    const data = await res.json();

    // ThingSpeak devuelve los campos como propiedades 'field1'..'fieldN'.
    // Aquí se asume la convención del canal:
    //  - field1 => humedad (string numérico)
    //  - field2 => temperatura ambiente
    //  - field3 => temperatura biorreactor
    //  - field4 => id o session
    const f1 = data.field1; // humedad (puede ser string o undefined)
    const f2 = data.field2; // temp ambiente
    const f3 = data.field3; // temp biorreactor
    const f4 = data.field4; // id / session

    // Asignamos a la UI. Si el campo no existe mostramos '—'.
    // No convertimos a Number aquí porque solo mostramos texto formateado.
    valHumedad.textContent = f1 ? f1 + ' %' : '—';
    valTempAmb.textContent = f2 ? f2 + ' °C' : '—';
    valTempBio.textContent = f3 ? f3 + ' °C' : '—';
    valId.textContent = f4 ? f4 : '—';

    // Si todo fue bien indicamos que estamos online
    setStatus(true);
  }catch(e){
    setStatus(false);
    console.warn('Cannot fetch last:', e);
  }
}

async function fetchHistoricAndDraw(){
  try{
    const res = await fetch(THINGSPEAK_FEEDS);
    if(!res.ok) throw new Error(res.status);
    const payload = await res.json();
    // ThingSpeak devuelve un objeto con la propiedad 'feeds' que es un array
    const feeds = payload.feeds || [];

    // labels: convertimos el timestamp ISO a hora local para el eje X
    // created_at viene en formato ISO (ej. '2026-06-09T12:34:56Z')
    const labels = feeds.map(f => new Date(f.created_at).toLocaleTimeString());

    // Para las series numéricas convertimos los strings a Number.
    // Si el campo está vacío usamos null para que Chart.js pueda dejar gap.
    const hData = feeds.map(f => f.field1 ? Number(f.field1) : null);
    const tAmbData = feeds.map(f => f.field2 ? Number(f.field2) : null);
    const tBioData = feeds.map(f => f.field3 ? Number(f.field3) : null);

    // Actualizamos cada gráfico con las etiquetas y los datos preparados.
    updateChart(chartHumedad, labels, hData);
    updateChart(chartTempAmb, labels, tAmbData);
    updateChart(chartTempBio, labels, tBioData);
  }catch(e){
    console.warn('Cannot fetch historic:', e);
  }
}

function updateChart(chart, labels, data){
  if(!chart) return;
  // Reemplaza las etiquetas y la serie de datos del dataset 0
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  // Fuerza re-render del gráfico
  chart.update();
}

function createCharts(){
  const elH = document.getElementById('chart-humedad');
  if (elH && elH.getContext) {
    const ctxH = elH.getContext('2d');
    chartHumedad = new Chart(ctxH, {
      type:'line',
      data:{labels:[],datasets:[{label:'Humedad %',data:[],borderColor:'#38bdf8',backgroundColor:'rgba(56,189,248,0.12)',spanGaps:true}]},
      options:{responsive:true,scales:{y:{beginAtZero:true}}}
    });
  } else {
    chartHumedad = null;
  }

  const elA = document.getElementById('chart-temp-amb');
  if (elA && elA.getContext) {
    const ctxA = elA.getContext('2d');
    chartTempAmb = new Chart(ctxA, {
      type:'line',
      data:{labels:[],datasets:[{label:'Temp Ambiente °C',data:[],borderColor:'#f97316',backgroundColor:'rgba(249,115,22,0.12)',spanGaps:true}]},
      options:{responsive:true,scales:{y:{beginAtZero:false}}}
    });
  } else {
    chartTempAmb = null;
  }

  const elB = document.getElementById('chart-temp-bio');
  if (elB && elB.getContext) {
    const ctxB = elB.getContext('2d');
    chartTempBio = new Chart(ctxB, {
      type:'line',
      data:{labels:[],datasets:[{label:'Temp Biorreactor °C',data:[],borderColor:'#34d399',backgroundColor:'rgba(52,211,153,0.12)',spanGaps:true}]},
      options:{responsive:true,scales:{y:{beginAtZero:false}}}
    });
  } else {
    chartTempBio = null;
  }
}

async function fetchDevice(){
  try{
    // Llama a un endpoint local (/api/device) en tu servidor para obtener
    // información del dispositivo conectado. No forma parte de ThingSpeak.
    const res = await fetch('/api/device');
    if(!res.ok) throw new Error(res.status);
    const d = await res.json();

    // Mostramos el JSON formateado en el panel
    deviceJson.textContent = JSON.stringify(d, null, 2);
    deviceInfo.classList.remove('hidden');
  }catch(e){
    // En error mostramos mensaje simple y abrimos el panel igualmente
    deviceJson.textContent = 'No se pudo obtener información del dispositivo.';
    deviceInfo.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  createCharts();
  fetchLast();
  fetchHistoricAndDraw();

  btnRefresh.addEventListener('click', async ()=>{
    await fetchLast();
    await fetchHistoricAndDraw();
  });

  btnDevice.addEventListener('click', fetchDevice);
  btnCloseDevice && btnCloseDevice.addEventListener('click', ()=>deviceInfo.classList.add('hidden'));
});

// Expose a ThingSpeak fetch helper for other pages (e.g. index.html)
// This centralizes the ThingSpeak connection for the app. Use channel 3392682
const INDEX_THINGSPEAK_CHANNEL = '3392682';
async function fetchThingSpeak(results = 20) {
  try {
    const url = `https://api.thingspeak.com/channels/${INDEX_THINGSPEAK_CHANNEL}/feeds.json?results=${results}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const json = await res.json();
    // Normalizamos cada feed en un objeto con tipos adecuados
    return (json.feeds || []).map(feed => ({
      // timestamp en ISO tal como lo devuelve ThingSpeak
      timestamp: feed.created_at,
      // convertimos strings numéricos a floats/ints; si falla devolvemos 0
      humedadAmbiente: parseFloat(feed.field1) || 0,
      temperaturaAmbiente: parseFloat(feed.field2) || 0,
      temperaturaBiorreactor: parseFloat(feed.field3) || 0,
      sessionID: parseInt(feed.field4, 10) || 0,
    }));
  } catch (e) {
    console.warn('fetchThingSpeak failed:', e);
    return [];
  }
}

window.fetchThingSpeak = fetchThingSpeak;
