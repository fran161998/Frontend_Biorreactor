const THINGSPEAK_LAST = 'https://api.thingspeak.com/channels/3403595/feeds/last.json';
const THINGSPEAK_FEEDS = 'https://api.thingspeak.com/channels/3403595/feeds.json?results=50';

const statusEl = document.getElementById('status');
const btnRefresh = document.getElementById('btn-refresh');
const btnDevice = document.getElementById('btn-device');
const btnCloseDevice = document.getElementById('btn-close-device');

const valHumedad = document.getElementById('val-humedad');
const valTempAmb = document.getElementById('val-temp-amb');
const valTempBio = document.getElementById('val-temp-bio');
const valId = document.getElementById('val-id');

const deviceInfo = document.getElementById('device-info');
const deviceJson = document.getElementById('device-json');

let chartHumedad, chartTempAmb, chartTempBio;

function setStatus(online){
  statusEl.textContent = online ? 'Online' : 'Offline';
  statusEl.className = 'status ' + (online ? 'online' : 'offline');
}

async function fetchLast(){
  try{
    const res = await fetch(THINGSPEAK_LAST);
    if(!res.ok) throw new Error(res.status);
    const data = await res.json();

    // ThingSpeak last returns field1..field4
    const f1 = data.field1; // humedad
    const f2 = data.field2; // temp amb
    const f3 = data.field3; // temp bio
    const f4 = data.field4; // id proceso

    valHumedad.textContent = f1 ? f1 + ' %' : '—';
    valTempAmb.textContent = f2 ? f2 + ' °C' : '—';
    valTempBio.textContent = f3 ? f3 + ' °C' : '—';
    valId.textContent = f4 ? f4 : '—';

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
    const feeds = payload.feeds || [];

    const labels = feeds.map(f=>new Date(f.created_at).toLocaleTimeString());
    const hData = feeds.map(f=>f.field1 ? Number(f.field1) : null);
    const tAmbData = feeds.map(f=>f.field2 ? Number(f.field2) : null);
    const tBioData = feeds.map(f=>f.field3 ? Number(f.field3) : null);

    updateChart(chartHumedad, labels, hData);
    updateChart(chartTempAmb, labels, tAmbData);
    updateChart(chartTempBio, labels, tBioData);
  }catch(e){
    console.warn('Cannot fetch historic:', e);
  }
}

function updateChart(chart, labels, data){
  if(!chart) return;
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
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
    const res = await fetch('/api/device');
    if(!res.ok) throw new Error(res.status);
    const d = await res.json();
    deviceJson.textContent = JSON.stringify(d, null, 2);
    deviceInfo.classList.remove('hidden');
  }catch(e){
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
    return (json.feeds || []).map(feed => ({
      timestamp: feed.created_at,
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
