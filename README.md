# Shift Handover App (SQL + Exports)

Now this app stores submissions in a **SQLite SQL database** and supports report exports.

## Run

```bash
python3 server.py
```

Open: `http://localhost:8000`

## What you can do

- Save handovers to SQLite (`handover.db`)
- View dashboard KPIs + charts
- Export **daily / weekly / monthly / all** reports as:
  - CSV
  - Excel (`.xls`)
  - PDF

## API endpoints

- `POST /api/handovers` save one handover
- `GET /api/handovers?period=daily|weekly|monthly|all` list handovers
- `GET /api/export/csv?period=...`
- `GET /api/export/excel?period=...`
- `GET /api/export/pdf?period=...`

## Files

- `server.py` backend (HTTP API + SQLite + exports)
- `index.html` app UI
- `app.js` front-end form/dashboard logic
- `styles.css` UI style
