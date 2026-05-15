const form = document.getElementById('handoverForm');
const resetButton = document.getElementById('resetData');
const reportPeriod = document.getElementById('reportPeriod');

const kpiHigh = document.getElementById('kpiHigh');
const kpiIncidents = document.getElementById('kpiIncidents');
const kpiWeek = document.getElementById('kpiWeek');
const kpiRating = document.getElementById('kpiRating');

const tasksTableBody = document.querySelector('#tasksTable tbody');
const incidentsTableBody = document.querySelector('#incidentsTable tbody');
const prodChart = document.getElementById('prodChart');
const missedChart = document.getElementById('missedChart');

async function fetchEntries(period = 'all') {
  const res = await fetch(`/api/handovers?period=${encodeURIComponent(period)}`);
  return res.json();
}

async function saveEntry(entry) {
  const res = await fetch('/api/handovers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
  });
  if (!res.ok) throw new Error('Failed to save');
}

async function renderDashboard() {
  const period = reportPeriod?.value || 'all';
  const entries = await fetchEntries(period);
  const highPriority = entries.filter((e) => e.escalation === 'Yes' && e.tasks_pending).length;
  const openIncidents = entries.filter((e) => e.incident === 'Yes').length;
  const shiftsThisWeek = entries.length;
  const avgRating = entries.length ? entries.reduce((s, e) => s + Number(e.shift_rating || 0), 0) / entries.length : 0;

  kpiHigh.textContent = String(highPriority);
  kpiIncidents.textContent = String(openIncidents);
  kpiWeek.textContent = String(shiftsThisWeek);
  kpiRating.textContent = avgRating.toFixed(1);

  renderTasks(entries);
  renderIncidents(entries);
  renderProdChart(entries.slice().reverse().slice(-7));
  renderMissedByShiftChart(entries);
}

function renderTasks(entries) {
  tasksTableBody.innerHTML = entries.filter((e) => e.tasks_pending).slice(0, 12).map((e) => {
    const p = e.escalation === 'Yes' ? 'High' : 'Med';
    return `<tr><td>${e.date || ''}</td><td>${e.department || ''}</td><td>${e.shift || ''}</td><td>${escapeHtml(e.tasks_pending || '')}</td><td class="${p==='High'?'priority-high':''}">${p}</td></tr>`;
  }).join('');
}

function renderIncidents(entries) {
  incidentsTableBody.innerHTML = entries.filter((e) => e.incident === 'Yes').slice(0, 12).map((e) =>
    `<tr><td>${e.date || ''}</td><td>${e.department || ''}</td><td>${e.shift || ''}</td><td>${escapeHtml(e.incident_description || '')}</td><td>${e.first_aid || 'No'}</td></tr>`
  ).join('');
}

function renderProdChart(entries) {
  const labels = entries.map((e) => (e.date || '').slice(5));
  const target = entries.map((e) => Number(e.target_production || 0));
  const actual = entries.map((e) => Number(e.actual_production || 0));
  drawDualLineChart(prodChart, labels, target, actual, '#60a5fa', '#22c55e');
}
function renderMissedByShiftChart(entries) {
  const counts = { Morning: 0, Afternoon: 0, Night: 0 };
  entries.forEach((e) => { if (Number(e.actual_production) < Number(e.target_production) && counts[e.shift] !== undefined) counts[e.shift] += 1; });
  drawBarChart(missedChart, Object.keys(counts), Object.values(counts), '#f97316');
}

function drawDualLineChart(canvas, labels, a, b, colorA, colorB) { const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); const pad=28,maxY=Math.max(1,...a,...b),scaleY=(canvas.height-pad*2)/maxY,stepX=labels.length>1?(canvas.width-pad*2)/(labels.length-1):0; drawLine(ctx,a,pad,stepX,scaleY,canvas.height,colorA); drawLine(ctx,b,pad,stepX,scaleY,canvas.height,colorB); }
function drawLine(ctx, values, pad, stepX, scaleY, h, color){ if(!values.length)return; ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=2; values.forEach((v,i)=>{const x=pad+i*stepX,y=h-pad-v*scaleY; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);}); ctx.stroke(); }
function drawBarChart(canvas, labels, values, color){ const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); const pad=28,maxY=Math.max(1,...values),barW=(canvas.width-pad*2)/Math.max(1,labels.length*1.8); labels.forEach((l,i)=>{const x=pad+i*(barW*1.8),y=canvas.height-pad-(values[i]/maxY)*(canvas.height-pad*2),h=canvas.height-pad-y; ctx.fillStyle=color; ctx.fillRect(x,y,barW,h); ctx.fillStyle='#cbd5e1'; ctx.fillText(l,x,canvas.height-8);}); }
function escapeHtml(v=''){ return v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }

form.elements.date.valueAsDate = new Date();
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const entry = Object.fromEntries(new FormData(form).entries());
  if (entry.breakdown === 'Yes' && !entry.breakdownDescription.trim()) return alert('Breakdown description required');
  if (entry.qualityIssue === 'Yes' && !entry.qualityDescription.trim()) return alert('Quality description required');
  if (entry.incident === 'Yes' && !entry.incidentDescription.trim()) return alert('Incident description required');
  await saveEntry(entry);
  form.reset(); form.elements.date.valueAsDate = new Date();
  await renderDashboard();
});

resetButton.addEventListener('click', () => alert('For safety, DB reset is disabled in UI.'));

reportPeriod?.addEventListener('change', renderDashboard);
document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const period = reportPeriod?.value || 'all';
    const kind = btn.getAttribute('data-export');
    window.open(`/api/export/${kind}?period=${encodeURIComponent(period)}`, '_blank');
  });
});

renderDashboard();
