const defaults = {
  speed: 30, angle: 45, height: 1.5, mass: 0.145, diameter: 0.073,
  cd: 0.47, rho: 1.217, gravity: 9.80665, wind: 0
};
let latestData = null;
let trajectoryChart = null;

const fields = Object.keys(defaults);
function readParams() {
  const result = {};
  fields.forEach(key => result[key] = Number(document.getElementById(key).value));
  result.dt = 0.01;
  return result;
}
function updateLabels() {
  fields.forEach(key => {
    const input = document.getElementById(key);
    const output = document.getElementById(key + 'Value');
    const value = Number(input.value);
    output.textContent = key === 'gravity' ? value.toFixed(5)
      : key === 'mass' || key === 'diameter' || key === 'rho' ? value.toFixed(3)
      : key === 'height' || key === 'cd' ? value.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')
      : Number.isInteger(value) ? value.toString() : value.toFixed(1);
  });
}
function format(value, digits=2) { return Number(value).toFixed(digits); }


/* ---------- Research reference data (moved from app.py) ---------- */
const REFERENCE_DATA = [
  {parameter:"Standard acceleration due to gravity", value:"9.80665", unit:"m/s²", use:"Default g input", source:"NIST Guide to the SI, Appendix B.9", url:"https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9"},
  {parameter:"Earth mean surface gravity", value:"9.820", unit:"m/s²", use:"Earth reference comparison", source:"NASA NSSDCA Earth Fact Sheet", url:"https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html"},
  {parameter:"Earth surface air density", value:"1.217", unit:"kg/m³", use:"Default air-density input", source:"NASA NSSDCA Earth Fact Sheet", url:"https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html"},
  {parameter:"Sphere drag coefficient range", value:"0.07–0.50", unit:"dimensionless", use:"Context for selecting a sphere Cd; it varies with flow conditions", source:"NASA Glenn — Drag of a Sphere", url:"https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-of-a-sphere/"},
  {parameter:"Bullet drag coefficient example", value:"0.295", unit:"dimensionless", use:"Shape comparison only; not used as the default sphere value", source:"NASA Glenn — Shape Effects on Drag", url:"https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/"},
  {parameter:"Standard atmospheric pressure", value:"101325", unit:"Pa", use:"Atmospheric reference", source:"NIST Guide to the SI, Appendix B.8", url:"https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b8"},
  {parameter:"Standard atmosphere", value:"Reference vertical profile", unit:"", use:"Context for variation of atmospheric properties with altitude", source:"NOAA National Weather Service Glossary", url:"https://forecast.weather.gov/glossary.php?word=standard+atmosphere"}
];

function renderReferences() {
  const body = document.getElementById('reference-rows');
  if (!body) return;
  body.innerHTML = REFERENCE_DATA.map(item => `
    <tr>
      <td>${item.parameter}</td>
      <td class="table-value">${item.value} ${item.unit}</td>
      <td>${item.use}</td>
      <td><a href="${item.url}" target="_blank" rel="noreferrer">${item.source} ↗</a></td>
    </tr>`).join('');
}

/* ---------- Physics engine (ported from Python to JavaScript) ---------- */
function acceleration(state, p, includeDrag) {
  const [, , vx, vy] = state;
  if (!includeDrag) return [0, -p.gravity];
  // Relative air velocity: projectile velocity minus horizontal wind velocity.
  const relVx = vx - p.wind;
  const relVy = vy;
  const relSpeed = Math.hypot(relVx, relVy);
  if (relSpeed === 0) return [0, -p.gravity];
  const factor = 0.5 * p.rho * p.cd * p.area * relSpeed / p.mass;
  return [-factor * relVx, -p.gravity - factor * relVy];
}
function derivative(state, p, includeDrag) {
  const [ax, ay] = acceleration(state, p, includeDrag);
  return [state[2], state[3], ax, ay];
}
function addScaled(a, b, scale) { return a.map((v, i) => v + scale * b[i]); }
function rk4Step(state, dt, p, includeDrag) {
  const f = s => derivative(s, p, includeDrag);
  const k1 = f(state);
  const k2 = f(addScaled(state, k1, dt / 2));
  const k3 = f(addScaled(state, k2, dt / 2));
  const k4 = f(addScaled(state, k3, dt));
  return state.map((v, i) => v + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
}
function simulate(params, includeDrag) {
  const angle = params.angle * Math.PI / 180;
  const p = { ...params, area: Math.PI * (params.diameter / 2) ** 2 };
  let state = [0, params.height, params.speed * Math.cos(angle), params.speed * Math.sin(angle)];
  const dt = params.dt;
  const points = [];
  let t = 0;
  const maxSteps = 200000;
  for (let step = 0; step < maxSteps; step++) {
    points.push({t, x: state[0], y: state[1], vx: state[2], vy: state[3]});
    if (step > 0 && state[1] <= 0) break;
    const next = rk4Step(state, dt, p, includeDrag);
    if (next[1] < 0) {
      // Interpolate the final segment to y = 0 to estimate impact accurately.
      const fraction = state[1] / (state[1] - next[1]);
      const impact = state.map((v, i) => v + fraction * (next[i] - v));
      points.push({t: t + fraction * dt, x: impact[0], y: 0, vx: impact[2], vy: impact[3]});
      break;
    }
    state = next;
    t += dt;
    if (step === maxSteps - 1) throw new Error('Simulation exceeded the maximum number of steps.');
  }
  return points;
}
function summarize(points) {
  const peak = points.reduce((a, b) => (b.y > a.y ? b : a));
  const last = points[points.length - 1];
  return {range: last.x, flight_time: last.t, max_height: peak.y, impact_speed: Math.hypot(last.vx, last.vy)};
}
function validateParams(p) {
  const limits = {
    speed:[1,150], angle:[1,89], height:[0,100], mass:[0.01,100], diameter:[0.005,1],
    cd:[0.01,3], rho:[0.1,2], gravity:[1,30], wind:[-50,50], dt:[0.001,0.05]
  };
  for (const [key, [low, high]] of Object.entries(limits)) {
    if (!Number.isFinite(p[key]) || p[key] < low || p[key] > high) {
      throw new Error(`${key} must be between ${low} and ${high}.`);
    }
  }
}
function runPhysics(params) {
  validateParams(params);
  const ideal = simulate(params, false);
  const drag = simulate(params, true);
  const idealSummary = summarize(ideal);
  const dragSummary = summarize(drag);
  const reduction = idealSummary.range > 0 ? (idealSummary.range - dragSummary.range) / idealSummary.range * 100 : 0;
  return {ideal, drag, ideal_summary: idealSummary, drag_summary: dragSummary, range_reduction_percent: reduction};
}

function makeChart(data) {
  const ctx = document.getElementById('trajectoryChart');
  const ideal = data.ideal.map(p => ({x:p.x, y:p.y}));
  const drag = data.drag.map(p => ({x:p.x, y:p.y}));
  if (trajectoryChart) trajectoryChart.destroy();
  trajectoryChart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [
      {label:'Ideal · no drag', data:ideal, parsing:false, borderColor:'#6bd9e8', borderWidth:2, borderDash:[7,6], pointRadius:0, tension:0},
      {label:'Quadratic drag', data:drag, parsing:false, borderColor:'#b7f36b', borderWidth:2.5, pointRadius:0, tension:0}
    ]},
    options: {
      responsive:true, maintainAspectRatio:false, animation:{duration:350},
      interaction:{mode:'nearest', intersect:false},
      plugins:{legend:{display:false}, tooltip:{backgroundColor:'#101720', titleColor:'#edf3f7', bodyColor:'#aebbc5', borderColor:'#344453', borderWidth:1, callbacks:{label:c=>` ${c.dataset.label}: ${c.parsed.x.toFixed(2)} m, ${c.parsed.y.toFixed(2)} m`}}},
      scales:{
        x:{type:'linear', title:{display:true,text:'Horizontal distance (m)',color:'#8998a5',font:{family:'DM Mono',size:10}}, grid:{color:'rgba(135,155,170,.10)'}, ticks:{color:'#7f8d99'}},
        y:{title:{display:true,text:'Height (m)',color:'#8998a5',font:{family:'DM Mono',size:10}}, beginAtZero:true, grid:{color:'rgba(135,155,170,.10)'}, ticks:{color:'#7f8d99'}}
      }
    }
  });
}
function updateMetrics(data) {
  const s = data.drag_summary;
  document.getElementById('rangeMetric').textContent = format(s.range) + ' m';
  document.getElementById('timeMetric').textContent = format(s.flight_time) + ' s';
  document.getElementById('heightMetric').textContent = format(s.max_height) + ' m';
  document.getElementById('impactMetric').textContent = format(s.impact_speed) + ' m/s';
  document.getElementById('reductionMetric').textContent = format(data.range_reduction_percent) + '%';
}
async function runSimulation() {
  const button = document.getElementById('runBtn');
  const status = document.getElementById('statusText');
  button.disabled = true;
  button.innerHTML = '<span>◌</span> CALCULATING…';
  status.textContent = 'Physics engine is calculating both trajectories.';
  try {
    const data = runPhysics(readParams());
    latestData = data;
    makeChart(data);
    updateMetrics(data);
    status.textContent = 'Simulation complete. Adjust any input and run again.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = '<span>▶</span> RUN SIMULATION';
  }
}
function exportCsv() {
  if (!latestData) return;
  const rows = [['time_s','x_m','y_m','vx_mps','vy_mps']];
  latestData.drag.forEach(p => rows.push([p.t,p.x,p.y,p.vx,p.vy]));
  const csv = rows.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'projectile-trajectory-with-drag.csv'; link.click();
  URL.revokeObjectURL(url);
}
fields.forEach(key => document.getElementById(key).addEventListener('input', updateLabels));
document.getElementById('runBtn').addEventListener('click', runSimulation);
document.getElementById('csvBtn').addEventListener('click', exportCsv);
document.getElementById('resetBtn').addEventListener('click', () => {
  fields.forEach(key => document.getElementById(key).value = defaults[key]);
  updateLabels(); runSimulation();
});
updateLabels();
renderReferences();
runSimulation();
