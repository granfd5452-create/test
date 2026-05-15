#!/usr/bin/env python3
import json
import sqlite3
import csv
import io
from datetime import datetime, timedelta
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

BASE = Path(__file__).parent
DB = BASE / 'handover.db'

SCHEMA = '''
CREATE TABLE IF NOT EXISTS handovers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  date TEXT NOT NULL,
  shift TEXT,
  department TEXT,
  outgoing_supervisor TEXT,
  incoming_supervisor TEXT,
  target_production REAL,
  actual_production REAL,
  shortfall_reason TEXT,
  scrap REAL,
  machine_status TEXT,
  breakdown TEXT,
  breakdown_description TEXT,
  downtime REAL,
  quality_issue TEXT,
  quality_description TEXT,
  lot_numbers TEXT,
  incident TEXT,
  incident_description TEXT,
  first_aid TEXT,
  material_level TEXT,
  tasks_pending TEXT,
  critical_info TEXT,
  workers_count INTEGER,
  absentees TEXT,
  shift_rating REAL,
  escalation TEXT,
  escalation_reason TEXT
);
'''

FIELDS = [
 'created_at','date','shift','department','outgoingSupervisor','incomingSupervisor','targetProduction','actualProduction','shortfallReason','scrap','machineStatus','breakdown','breakdownDescription','downtime','qualityIssue','qualityDescription','lotNumbers','incident','incidentDescription','firstAid','materialLevel','tasksPending','criticalInfo','workersCount','absentees','shiftRating','escalation','escalationReason'
]


def db_conn():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db_conn() as c:
        c.executescript(SCHEMA)


def where_clause(period):
    today = datetime.utcnow().date()
    if period == 'daily':
        start = today
    elif period == 'weekly':
        start = today - timedelta(days=today.weekday())
    elif period == 'monthly':
        start = today.replace(day=1)
    else:
        return '', []
    return ' WHERE date >= ? ', [start.isoformat()]


class Handler(BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve_file(self, rel):
        p = BASE / rel
        if not p.exists():
            self.send_error(404)
            return
        ctype = 'text/plain'
        if p.suffix == '.html': ctype='text/html; charset=utf-8'
        elif p.suffix == '.css': ctype='text/css'
        elif p.suffix == '.js': ctype='application/javascript'
        b = p.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/' or u.path == '/index.html':
            return self._serve_file('index.html')
        if u.path in ['/styles.css','/app.js']:
            return self._serve_file(u.path[1:])
        if u.path == '/api/handovers':
            q = parse_qs(u.query)
            period = q.get('period',['all'])[0]
            where, params = where_clause(period)
            with db_conn() as c:
                rows = c.execute('SELECT * FROM handovers' + where + ' ORDER BY date DESC, id DESC', params).fetchall()
            return self._json([dict(r) for r in rows])
        if u.path == '/api/export/csv':
            return self.export_csv(parse_qs(u.query).get('period',['all'])[0])
        if u.path == '/api/export/excel':
            return self.export_excel(parse_qs(u.query).get('period',['all'])[0])
        if u.path == '/api/export/pdf':
            return self.export_pdf(parse_qs(u.query).get('period',['all'])[0])
        self.send_error(404)

    def do_POST(self):
        if self.path == '/api/handovers':
            ln = int(self.headers.get('Content-Length', '0'))
            data = json.loads(self.rfile.read(ln) or b'{}')
            vals = [
                datetime.utcnow().isoformat(), data.get('date',''), data.get('shift',''), data.get('department',''),
                data.get('outgoingSupervisor',''), data.get('incomingSupervisor',''), data.get('targetProduction') or 0,
                data.get('actualProduction') or 0, data.get('shortfallReason',''), data.get('scrap') or 0,
                data.get('machineStatus',''), data.get('breakdown','No'), data.get('breakdownDescription',''), data.get('downtime') or 0,
                data.get('qualityIssue','No'), data.get('qualityDescription',''), data.get('lotNumbers',''), data.get('incident','No'),
                data.get('incidentDescription',''), data.get('firstAid','No'), data.get('materialLevel',''), data.get('tasksPending',''),
                data.get('criticalInfo',''), data.get('workersCount') or 0, data.get('absentees',''), data.get('shiftRating') or 0,
                data.get('escalation','No'), data.get('escalationReason','')
            ]
            with db_conn() as c:
                c.execute('''INSERT INTO handovers (
                    created_at,date,shift,department,outgoing_supervisor,incoming_supervisor,target_production,actual_production,
                    shortfall_reason,scrap,machine_status,breakdown,breakdown_description,downtime,quality_issue,quality_description,
                    lot_numbers,incident,incident_description,first_aid,material_level,tasks_pending,critical_info,workers_count,
                    absentees,shift_rating,escalation,escalation_reason
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', vals)
            return self._json({'ok': True}, 201)
        self.send_error(404)

    def _fetch_rows(self, period):
        where, params = where_clause(period)
        with db_conn() as c:
            return c.execute('SELECT * FROM handovers' + where + ' ORDER BY date DESC, id DESC', params).fetchall()

    def export_csv(self, period):
        rows = self._fetch_rows(period)
        out = io.StringIO()
        w = csv.writer(out)
        headers = rows[0].keys() if rows else []
        if headers: w.writerow(headers)
        for r in rows: w.writerow([r[h] for h in headers])
        b = out.getvalue().encode()
        self.send_response(200)
        self.send_header('Content-Type','text/csv')
        self.send_header('Content-Disposition', f'attachment; filename="handover_{period}.csv"')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def export_excel(self, period):
        rows = self._fetch_rows(period)
        # Excel-readable HTML table
        headers = rows[0].keys() if rows else []
        html = ['<html><body><table border="1"><tr>']
        for h in headers: html.append(f'<th>{h}</th>')
        html.append('</tr>')
        for r in rows:
            html.append('<tr>')
            for h in headers: html.append(f'<td>{r[h]}</td>')
            html.append('</tr>')
        html.append('</table></body></html>')
        b = ''.join(html).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type','application/vnd.ms-excel')
        self.send_header('Content-Disposition', f'attachment; filename="handover_{period}.xls"')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def export_pdf(self, period):
        rows = self._fetch_rows(period)
        lines = [f'Shift Handover Report ({period})', f'Generated: {datetime.utcnow().isoformat()}', '']
        for r in rows[:200]:
            lines.append(f"{r['date']} | {r['shift']} | {r['department']} | target={r['target_production']} actual={r['actual_production']} incidents={r['incident']}")
            if r['tasks_pending']: lines.append(f"  Task: {r['tasks_pending']}")
        text = '\n'.join(lines)
        # minimal PDF wrapper (simple text stream)
        stream = f"BT /F1 10 Tf 50 780 Td ({text.replace('\\','\\\\').replace('(','\\(').replace(')','\\)').replace(chr(10),') Tj T* (')}) Tj ET"
        pdf = f"%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n4 0 obj<< /Length {len(stream)} >>stream\n{stream}\nendstream endobj\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000241 00000 n \n0000000000 00000 n \ntrailer<< /Root 1 0 R /Size 6 >>\nstartxref\n0\n%%EOF".encode('latin-1','ignore')
        self.send_response(200)
        self.send_header('Content-Type','application/pdf')
        self.send_header('Content-Disposition', f'attachment; filename="handover_{period}.pdf"')
        self.send_header('Content-Length', str(len(pdf)))
        self.end_headers(); self.wfile.write(pdf)

if __name__ == '__main__':
    init_db()
    server = ThreadingHTTPServer(('0.0.0.0', 8000), Handler)
    print('Server running on http://localhost:8000')
    server.serve_forever()
