# Shift Handover App

A lightweight web app for daily shift handover capture + live dashboard.

## Run locally

Because this is a static app, you can open `index.html` directly, or run a local server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Features

- Mobile-friendly shift handover form
- Built-in conditional required checks for incidents/quality/breakdowns
- KPI dashboard cards
- Action + incident tables
- Simple trend charts (actual vs target, missed target by shift)
- Data persisted in browser `localStorage`

## Files

- `index.html` – App UI markup
- `styles.css` – Styling and responsive layout
- `app.js` – Form logic, persistence, KPI calculations, chart rendering
- `google-sheets-dashboard-template.md` – Alternative Sheets-based implementation notes
