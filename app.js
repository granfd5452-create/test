const STORAGE_KEY = 'shift_handover_entries_v1';

const form = document.getElementById('handoverForm');
const resetButton = document.getElementById('resetData');

const kpiHigh = document.getElementById('kpiHigh');
const kpiIncidents = document.getElementById('kpiIncidents');
const kpiWeek = document.getElementById('kpiWeek');
const kpiRating = document.getElementById('kpiRating');

const tasksTableBody = document.querySelector('#tasksTable tbody');
const incidentsTableBody = document.querySelector('#incidentsTable tbody');

const prodChart = document.getElementById('prodChart');
const missedChart = document.getElementById('missedChart');

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function isCurrentWeek(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function renderDashboard() {
  const entries = loadEntries();

  const highPriority = entries.filter((e) => e.escalation === 'Yes' && e.tasksPending?.trim()).length;
  const openIncidents = entries.filter((e) => e.incident === 'Yes').length;
  const shiftsThisWeek = entries.filter((e) => isCurrentWeek(e.date)).length;
  const avgRating = entries.length
    ? entries.reduce((s, e) => s + Number(e.shiftRating || 0), 0) / entries.length
    : 0;

  kpiHigh.textContent = String(highPriority);
  kpiIncidents.textContent = String(openIncidents);
  kpiWeek.textContent = String(shiftsThisWeek);
  kpiRating.textContent = avgRating.toFixed(1);

  renderTasks(entries);
  renderIncidents(entries);
  renderProdChart(entries);
  renderMissedByShiftChart(entries);
}

function renderTasks(entries) {
  const taskEntries = entries.filter((e) => e.tasksPending?.trim());
  tasksTableBody.innerHTML = taskEntries
    .slice()
    .reverse()
    .slice(0, 12)
    .map((e) => {
      const priority = e.escalation === 'Yes' ? 'High' : 'Med';
      return `<tr>
        <td>${e.date || ''}</td>
        <td>${e.department || ''}</td>
        <td>${e.shift || ''}</td>
        <td>${escapeHtml(e.tasksPending)}</td>
        <td class="${priority === 'High' ? 'priority-high' : ''}">${priority}</td>
      </tr>`;
    })
    .join('');
}

function renderIncidents(entries) {
  const incidentEntries = entries.filter((e) => e.incident === 'Yes' && e.incidentDescription?.trim());
  incidentsTableBody.innerHTML = incidentEntries
    .slice()
    .reverse()
    .slice(0, 12)
    .map((e) => `<tr>
      <td>${e.date || ''}</td>
      <td>${e.department || ''}</td>
      <td>${e.shift || ''}</td>
      <td>${escapeHtml(e.incidentDescription)}</td>
      <td>${e.firstAid || 'No'}</td>
    </tr>`)
    .join('');
}

function renderProdChart(entries) {
  const recent = entries.slice(-7);
  const labels = recent.map((e) => e.date?.slice(5) || '');
  const target = recent.map((e) => Number(e.targetProduction || 0));
  const actual = recent.map((e) => Number(e.actualProduction || 0));
  drawDualLineChart(prodChart, labels, target, actual, '#60a5fa', '#22c55e');
}

function renderMissedByShiftChart(entries) {
  const counts = { Morning: 0, Afternoon: 0, Night: 0 };
  entries.forEach((e) => {
    if (Number(e.actualProduction) < Number(e.targetProduction) && counts[e.shift] !== undefined) {
      counts[e.shift] += 1;
    }
  });
  drawBarChart(missedChart, Object.keys(counts), Object.values(counts), '#f97316');
}

function drawDualLineChart(canvas, labels, a, b, colorA, colorB) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pad = 28;
  const maxY = Math.max(1, ...a, ...b);
  const scaleY = (canvas.height - pad * 2) / maxY;
  const stepX = labels.length > 1 ? (canvas.width - pad * 2) / (labels.length - 1) : 0;

  drawLine(ctx, labels, a, pad, stepX, scaleY, canvas.height, colorA);
  drawLine(ctx, labels, b, pad, stepX, scaleY, canvas.height, colorB);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.fillText('Target', pad, 14);
  ctx.fillText('Actual', pad + 60, 14);
  ctx.fillStyle = colorA; ctx.fillRect(pad + 38, 6, 14, 3);
  ctx.fillStyle = colorB; ctx.fillRect(pad + 96, 6, 14, 3);
}

function drawLine(ctx, labels, values, pad, stepX, scaleY, h, color) {
  if (!values.length) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  values.forEach((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - v * scaleY;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawBarChart(canvas, labels, values, color) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pad = 28;
  const maxY = Math.max(1, ...values);
  const barW = (canvas.width - pad * 2) / Math.max(1, labels.length * 1.8);

  labels.forEach((label, i) => {
    const x = pad + i * (barW * 1.8);
    const y = canvas.height - pad - (values[i] / maxY) * (canvas.height - pad * 2);
    const h = canvas.height - pad - y;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px sans-serif';
    ctx.fillText(label, x, canvas.height - 8);
    ctx.fillText(String(values[i]), x + barW / 3, y - 4);
  });
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

form.elements.date.valueAsDate = new Date();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const fd = new FormData(form);
  const entry = Object.fromEntries(fd.entries());
  entry.createdAt = new Date().toISOString();

  if (entry.breakdown === 'Yes' && !entry.breakdownDescription.trim()) {
    alert('Breakdown description is required when breakdown = Yes');
    return;
  }
  if (entry.qualityIssue === 'Yes' && !entry.qualityDescription.trim()) {
    alert('Quality issue description is required when quality issue = Yes');
    return;
  }
  if (entry.incident === 'Yes' && !entry.incidentDescription.trim()) {
    alert('Incident description is required when incident = Yes');
    return;
  }

  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
  form.reset();
  form.elements.date.valueAsDate = new Date();
  renderDashboard();
});

resetButton.addEventListener('click', () => {
  if (!confirm('Delete all saved handover data?')) return;
  saveEntries([]);
  renderDashboard();
});

renderDashboard();
