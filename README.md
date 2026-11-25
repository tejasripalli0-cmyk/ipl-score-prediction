# IPL Insight - AI-powered cricket analytics

Score prediction, win probability and historical IPL analytics, built around **your three trained scikit-learn
models** (not retrained, not replaced). React + TypeScript frontend, FastAPI backend.

> **Read this first - what is and isn't in the box**
> * The three model files are included and are used exactly as supplied.
> * **`ball_by_ball_dataset.csv` was not in the ZIP you uploaded**, so no historical data is bundled and nothing was invented.
>   Until you copy your CSV to `backend/data/ball_by_ball_dataset.csv`, the analytics pages (Team, Comparison, Player,
>   Venue, Season) show a "dataset needed" panel. **Predictions work without it.**
> * Official team logos are trademarked and could not be downloaded here. Every team shows a clean initials badge in its
>   franchise colours; drop real logos into `frontend/src/assets/logos/` and they are picked up automatically.
> * Section 7 lists exactly what was tested and what was not.

---

## 1. Quick start (Windows, PowerShell, VS Code)

Prerequisites: **Python 3.10-3.13** (3.12 recommended; *not* 3.14 yet) and **Node.js 18+ (LTS)**.

```powershell
# 1. Unzip, then open the ipl-insight folder in VS Code and a terminal (Ctrl+`)
cd path\to\ipl-insight

# 2. One-time setup (creates backend\.venv, installs Python + npm packages)
powershell -ExecutionPolicy Bypass -File .\setup.ps1

# 3. (Optional but recommended) add your dataset
Copy-Item "C:\path\to\ball_by_ball_dataset.csv" .\backend\data\ball_by_ball_dataset.csv
.\backend\.venv\Scripts\python.exe .\backend\scripts\inspect_dataset.py    # sanity-check the file

# 4. Run everything (opens two windows + the browser)
powershell -ExecutionPolicy Bypass -File .\start-all.ps1
```

Prefer two terminals? 

```powershell
# Terminal 1 - API on http://127.0.0.1:8000  (Swagger docs: /docs)
powershell -ExecutionPolicy Bypass -File .\start-backend.ps1
# Terminal 2 - website on http://localhost:5173
powershell -ExecutionPolicy Bypass -File .\start-frontend.ps1
```

Open **http://localhost:5173**. The first API start takes ~5-10 s while the 120 MB forest loads.

### Manual commands (what the scripts do)

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

cd ..\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

## 2. Testing the API

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health

$body = @{ batting_team="Mumbai Indians"; bowling_team="Chennai Super Kings"; venue="Wankhede Stadium, Mumbai";
           legal_balls_bowled=60; cumulative_runs=80; cumulative_wickets=2 } | ConvertTo-Json
Invoke-RestMethod -Method Post http://127.0.0.1:8000/predict/first-innings -ContentType "application/json" -Body $body

$chase = @{ batting_team="Mumbai Indians"; bowling_team="Chennai Super Kings"; venue="Wankhede Stadium, Mumbai";
            first_innings_score=170; target_overs=20; legal_balls_bowled=60; cumulative_runs=79; cumulative_wickets=2 } | ConvertTo-Json
Invoke-RestMethod -Method Post http://127.0.0.1:8000/predict/second-innings -ContentType "application/json" -Body $chase
Invoke-RestMethod -Method Post http://127.0.0.1:8000/predict/win-probability -ContentType "application/json" -Body $chase
```
Or use the interactive Swagger UI at **http://127.0.0.1:8000/docs**.

Run the automated tests: `powershell -ExecutionPolicy Bypass -File .\run-tests.ps1`

## 3. How the models are used

| File | Algorithm | Endpoint | Input features, in the order the model expects |
|---|---|---|---|
| `first_innings_model.pkl` | RandomForestRegressor | `POST /predict/first-innings` | batting_team, bowling_team, venue, over, cumulative_runs, cumulative_wickets, legal_balls_bowled, current_run_rate, balls_remaining |
| `second_innings_model.pkl` | LinearRegression | `POST /predict/second-innings` | the above + first_innings_score, target_runs, target_overs, runs_required, required_run_rate |
| `win_probability_model.pkl` | RandomForestClassifier | `POST /predict/win-probability` | same as second innings; output = P(chasing team wins) (class 1) |

Each pickle is `{model, preprocessor, features}`. The API loads them once at start-up, builds a one-row DataFrame in the
stored `features` order, applies the **saved** ColumnTransformer, then calls the saved estimator. Nothing is refit.
Leakage guard: loading fails if `final_score` / `winner` ever appear in a feature list.

**Derived inputs** (`current_run_rate`, `balls_remaining`, `runs_required`, `required_run_rate`, `over`) are computed by the
API from the primary inputs (`legal_balls_bowled`, `cumulative_runs`, ...) and, if you send them, validated against them.
The formulas (runs×6/balls, 120−balls, target−runs ...) match the statistics stored inside the saved scalers.

**Post-processing, all disclosed in the API response:** the displayed final score is never below the current score
(`adjusted_to_current_score` flags it, `raw_model_prediction` always gives the untouched output); probabilities are rounded
to 0.1 and the bowling side is `100 − batting` so they always sum to 100.

**Ranges:** first innings = middle 80 % of the 200 individual trees' predictions (spread, not a guaranteed interval);
second innings = prediction ± the 2025 test RMSE (indicative). The UI labels both honestly.

**Explanations:** a what-if sensitivity chart (replace one factor group by an average value, see how the output moves).
It is **not SHAP** and is labelled as such.

### ⚠ Things you should know about the models (found during testing)

1. **Venue spellings are separate categories.** The encoders contain 49 raw venue strings, including duplicates such as
   "Wankhede Stadium" and "Wankhede Stadium, Mumbai". In a fixed test scenario, first-innings predictions differed by up
   to ~28 runs between spellings of the *same* ground (e.g. Arun Jaitley Stadium 170 vs 198). The app groups spellings
   for analytics, picks the **most recent spelling in your dataset** for predictions (falls back to the longest spelling
   if no dataset), and gives an "Advanced: venue spelling" selector plus a warning. If you retrain, canonicalise venue names first.
2. **`over` convention.** Inferred from the saved scaler means as 0-indexed `(legal_balls−1)//6`. This was derived
   statistically, not read from your notebook - please confirm it matches your Colab feature code.
3. **Team names:** the models say "Pune Warriors"; the UI shows "Pune Warriors India". Historical names in the CSV are mapped automatically.
4. **Library versions are pinned** (scikit-learn 1.6.1, numpy 2.2.6, pandas 2.2.3, `dill`) because the pickles are version-sensitive.

## 4. Dataset & analytics rules

Put the file at `backend/data/ball_by_ball_dataset.csv` and restart the API. Required columns:
`match_id, season, venue, innings_number, batting_team, bowling_team, cumulative_runs, cumulative_wickets, legal_balls_bowled, total_runs_this_ball, winner`.
Optional (unlock more): `date, over, ball_in_over, batter, bowler, batter_runs, extras_runs, wickets_this_ball, target_runs, target_overs, is_dls, wicket_kind, player_dismissed, extras_type`.

* Team names normalised (Delhi Daredevils → Delhi Capitals, Kings XI Punjab → Punjab Kings, Royal Challengers Bangalore → Bengaluru, ...). Venue spellings grouped.
* Exact duplicate rows removed; match tables are built from **one row per innings** (no double counting); super-over innings (3+) ignored.
* **Win / loss only when `winner` names one of the two teams.** No-result and tied-without-winner matches are *not* losses; win % = wins ÷ (wins + losses).
* Batting-first vs chasing wins come from comparing `winner` with the first/second batting team.
* DLS (`is_dls`) matches count for results but are excluded from score averages/records. "Lowest score" counts completed innings only.
* Player stats use legal deliveries. **Batting average** needs `player_dismissed`; **bowler wickets** need `wicket_kind` (to exclude run-outs). If those columns are missing the page says so instead of guessing. Economy includes byes/leg-byes unless `extras_type` exists.
* `python backend/scripts/inspect_dataset.py` shows missing columns, unmapped team names and venue counts.
* **Not verified against your real CSV** - see section 7.

## 5. Optional extras

* **Logos:** add `csk.png`, `mi.svg`, ... (lower-case short code) to `frontend/src/assets/logos/`. See the README there.
* **SHAP / model comparison on the Model Insights page:** the ZIP contained only models, so these sections say "not supplied". To
  show yours, create `backend/data/model_report.json` (template: `model_report.example.json`) with real Colab values.

## 6. Public deployment (recommended: Vercel + a host with ≥1 GB RAM)

Nothing here has been deployed or verified on a live host.

* **Frontend → Vercel:** import the repo, *Root Directory* `frontend`, build `npm run build`, output `dist`, env var
  `VITE_API_URL=https://<your-api>` (baked in at build time, so redeploy after changing). `vercel.json` handles SPA routing.
* **Backend → Render / Railway / Fly.io / Hugging Face Spaces (Docker):** `backend/Dockerfile` and `deployment/render.yaml` are provided.
  Set `CORS_ORIGINS=https://<your-frontend>` (and `CORS_ORIGIN_REGEX` for preview URLs).
* **Size & memory:** `first_innings_model.pkl` is 114 MB → **over GitHub's 100 MB file limit**. Options: Git LFS, or run
  `python backend/scripts/compress_models.py` (28 MB, verified identical predictions; originals untouched) and commit those.
  Peak RAM measured while loading the models ≈ 520 MB *before* the dataset, so use ≥1 GB (free 512 MB tiers will likely be killed). Free tiers also sleep → slow first request.
* Checklist: `deployment/CHECKLIST.md`.

## 7. What was tested

**Verified in the build environment (Linux, Python 3.12, Node 22):**
* All 3 pickles load; types, feature names/order, no leakage features; each endpoint's output equals a direct call of the right saved model (backend tests, 41 passing).
* Prediction validation: all-out, innings complete, target reached, unrealistic scoring, wrong derived values, same team, unknown team/venue.
* Analytics logic against a **small synthetic fixture with hand-computed answers** (used only by tests, never loaded by the app): name changes, venue merging, duplicates, super overs, ties, no-results, DLS, batting-first vs chasing, player stats. Two deliberate bugs were injected and the tests caught both.
* Frontend `tsc` + production `vite build` pass; 17 mocked page-render tests (all 10 routes, dataset-missing and API-offline states); 6 end-to-end tests drive the real React pages against the live API and real models (score ×2, win probability summing to 100, client validation, analytics pages).
* CORS preflight (allowed vs foreign origin), Swagger/OpenAPI, and API behaviour with no dataset.
* Scripts: `compress_models.py` (identical predictions), `inspect_dataset.py` (error path).

**Not verified - please check on your machine:**
* **Analytics on your real CSV** (column names/values may differ from the schema assumed; run `inspect_dataset.py` first).
* **Visual appearance in a real browser**: no browser was available, so layout, responsiveness, chart rendering and colour/contrast have not been eyeballed (charts are only checked to mount without errors).
* **The PowerShell scripts** (no PowerShell here) - the manual commands in section 1 are the fallback.
* Python 3.10/3.11/3.13 and Windows wheels (tested on 3.12/Linux; pins have Windows wheels for 3.10-3.13).
* Any live deployment.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `running scripts is disabled` | Use `powershell -ExecutionPolicy Bypass -File .\script.ps1`, or once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `pip` fails building numpy/scikit-learn | Python too new/old. Use 3.10-3.13 (`py -3.12`). |
| `InconsistentVersionWarning` / pickle errors / `No module named 'dill'` | Wrong packages. Re-run `pip install -r requirements.txt` inside `backend\.venv`. |
| Red "Cannot reach the API" banner | Backend not running or wrong URL. Check http://127.0.0.1:8000/health; `frontend\.env` → `VITE_API_URL`; restart `npm run dev` after editing `.env`. |
| Browser CORS error | Add the frontend URL to `CORS_ORIGINS` in `backend\.env`, restart API. |
| "Historical dataset needed" | Copy the CSV to `backend\data\ball_by_ball_dataset.csv`, restart the API; check `/analytics/status` for the reason. |
| Port 8000/5173 in use | `netstat -ano \| findstr :8000` then `taskkill /PID <id> /F`, or change the port. |
| Analytics numbers look off | Run `inspect_dataset.py`; check "notes" under `/analytics/status` and on each page. |

## 9. Project structure

```
ipl-insight/
├── backend/
│   ├── app/{main.py,config.py,deps.py, models/, schemas/, routes/, services/, utils/}
│   ├── saved_models/          your 3 .pkl files (unchanged)
│   ├── data/                  put ball_by_ball_dataset.csv here
│   ├── scripts/               inspect_dataset.py, compress_models.py
│   ├── tests/                 pytest suite (+ clearly-labelled synthetic fixture)
│   ├── requirements.txt  .env.example  Dockerfile
├── frontend/  (React + Vite + TS + Tailwind)  src/{components,pages,layouts,services,hooks,types,data,assets,test}
├── deployment/  render.yaml, CHECKLIST.md
├── setup.ps1  start-all.ps1  start-backend.ps1  start-frontend.ps1  run-tests.ps1
└── README.md
```

## 10. API reference (also at `/docs`)

`GET /health` · `POST /predict/first-innings|second-innings|win-probability` · `GET /meta/options` · `GET /meta/model-insights` ·
`GET /analytics/{status,overview,teams,seasons,seasons/summary,venues,players?q=}` ·
`GET /analytics/team/{team}?season=` · `GET /analytics/team-comparison?teams=A&teams=B&season=&venue=` ·
`GET /analytics/player/{name}` · `GET /analytics/venue/{venue}` · `GET /analytics/season/{season}`

Errors are `{"detail": {"message": "...", "field": "..."}}` (422 validation, 404 not found, 503 model/dataset unavailable).

*Independent project; not affiliated with the IPL, BCCI or any franchise. Data: Cricsheet (cricsheet.org).*
