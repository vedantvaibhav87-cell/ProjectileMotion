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
  status.textContent = 'Python physics engine is calculating both trajectories.';
  try {
    const response = await fetch('/api/simulate', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(readParams())
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Simulation failed.');
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
runSimulation();
