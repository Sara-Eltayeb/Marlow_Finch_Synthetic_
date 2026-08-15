# Marlow & Finch AI Engagement Center

Five specialised Gemini agents collaborate sequentially to review synthetic engagement data:

```text
Researcher -> Designer -> Maker -> Marketer -> Manager
```

The Google Sheets CSV and Frankfurter API are fetched live. The workflow is dry-run only. It does not send email, push notifications, transactions, or investment advice.

## Run locally

Create `.env` from `.env.example` and add `GEMINI_API_KEY`. The key must never be committed.

```bash
npm start
```

The API runs at `http://localhost:8787`. Open `frontend/index.html` directly, or serve `frontend/` with a static server. For a deployed dashboard, provide the backend URL as `?api=https://your-backend.example.com`.

The terminal evidence runner remains available:

```bash
npm run run:manager -- MF001
```

It prints each real handoff and saves the complete structured run under `evidence-runs/`.

## Deployment

GitHub Pages deploys only `frontend/`. Gemini remains backend-only. The backend must be run separately with `GEMINI_API_KEY`, `GOOGLE_SHEETS_USER_DATA_URL`, and `FRANKFURTER_RATE_URL` configured.
