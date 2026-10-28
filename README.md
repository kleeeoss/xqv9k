# UK Wholesale Day-Ahead Electricity Procurement & Wind Forecast Uncertainty Risk Terminal

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.2-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An institutional-grade energy trading desk terminal and quantitative forecast audit engine built for UK Day-Ahead wholesale power procurement under the **Balancing and Settlement Code (BSC)**.

The platform resolves the fundamental intermittency challenge faced by power utilities: **how to schedule Day-Ahead physical power contracts before market gate closure without lookahead bias, while sizing empirical shortfall buffers ($P_{90}$ Firm Wind) to avoid catastrophic Balancing Mechanism cash-out penalties.**

---

## Live Deployment & Demo

* **Live Web Application (Vercel):** [https://xqv9k.vercel.app](https://xqv9k.vercel.app) *(or your deployed Vercel domain)*
* **Interactive API Documentation:** [https://xqv9k.vercel.app/docs](https://xqv9k.vercel.app/docs) (Swagger UI)
* **Video Presentation (10-Minute Walkthrough):** [Watch on YouTube](https://youtube.com/watch?v=placeholder)
  * *Part 1 (0:00 - 5:00):* Utility Client Pitch & ROI Justification
  * *Part 2 (5:00 - 10:00):* Tech Lead Code & Architecture Deep-Dive

---

## 1. Executive Summary & Problem Context

In Great Britain, wholesale electricity cannot be bought in real-time at Day-Ahead auction rates. Market commitments are cleared on **Decision Day $D-1$** across binding gate closures:
* **EPEX SPOT Day-Ahead Hourly:** `09:20 UTC`
* **N2EX Day-Ahead Hourly:** `09:50 UTC`
* **GB Day-Ahead Half-Hourly:** `15:30 UTC`

When a utility trading desk relies on point forecasts of wind generation ($\hat{W}$) without accounting for uncertainty, any generation deficit ($S = \max(0, \hat{W} - W)$) forces the utility into an **unhedged short position** in real-time. Under the BSC Balancing Mechanism (BM), short energy is cashed out at the **System Buy Price (SBP)**, which frequently spikes to **£180 – £500+/MWh** during winter peak demand.

### The Empirical Reality (January 2, 2026 Case Study)
On **January 2, 2026**, NGESO Day-Ahead forecasts predicted sustained high wind generation (~18,293 MW) across the evening peak. Actual outturn collapsed to 13,958 MW—creating a massive **+4,335 MW shortfall in Settlement Period 46 (22:30 UTC)**.
* **Without Risk Buffer:** The utility desk faces over **£650,000** in imbalance penalties in a single settlement period.
* **With Gridbricks $P_{90}$ Firm Wind Buffer:** The platform automatically contracted reserve thermal power Day-Ahead at £85/MWh, hedging the shortfall and **preventing over £1,200,000 in cash-out losses** across the delivery day.

---

## 2. Key Architecture & Features

```mermaid
graph TD
    subgraph Browser["Client (Browser)"]
        UI["React 18 + TS + Tailwind CSS"]
        CHARTS["Interactive Recharts (Fan Chart & Thermal Dispatch)"]
    end

    subgraph Serverless["Unified Vercel Single-Domain Deployment"]
        ROUTER["vercel.json Routing Layer"]
        STATIC["Static Assets (/dist)"]
        PY_FN["Serverless Function (/api/*) -> api/index.py"]
    end

    subgraph Backend["Backend Application (Python 3.11/3.12)"]
        FA["FastAPI Application (backend/main.py)"]
        SCHEMAS["Strict Pydantic V2 Schemas (backend/schemas.py)"]
        ENGINE["Zero-Lookahead Causality Engine (backend/engine.py)"]
        CLIENT["Elexon Client & Snapshot Manager (backend/elexon_client.py)"]
    end

    subgraph DataTier["Data Tier"]
        SNAP["Pre-Materialized Snapshot (backend/data/elexon_jan2026.json)"]
        LIVE["Live Elexon BMRS API (https://data.elexon.co.uk)"]
    end

    UI --> ROUTER
    CHARTS --> ROUTER
    ROUTER -->|/*| STATIC
    ROUTER -->|/api/*| PY_FN
    PY_FN --> FA
    FA --> SCHEMAS
    FA --> ENGINE
    ENGINE --> CLIENT
    CLIENT --> SNAP
    CLIENT -.->|Live Verify| LIVE
```

### Feature Highlights
1. **Zero-Lookahead Point-in-Time Causality:** Strictly isolates eligible NGESO forecast runs satisfying $\tau^*(t_s) = \max \{ t_p \le T_{\text{cutoff}} \}$. Runs published after market gate closure (e.g. 09:30 UTC) are strictly excluded from Day-Ahead procurement.
2. **Dual-Mode Resolution Alignment:**
   * *Linear Interpolation Mode (Trading Default):* Computes intermediate half-hour forecasts ($\text{SP } 1\dots 48$) via linear interpolation of adjacent hourly forecast knots.
   * *Exact Native Matching Mode (Audit Default):* Isolates the 24 exact hourly timestamps where native forecasts and actuals align with zero interpolation.
3. **Empirical Quantile Risk Engine:** Derives non-parametric empirical shortfall quantiles ($P_{10}, P_{50}, P_{75}, P_{90}, P_{95}$) from the authentic January 2026 dataset, avoiding flawed Gaussian assumptions on skewed wind residuals.
4. **Optimal Day-Ahead Thermal Dispatch:**
   $$W_{\text{firm}}^{(\alpha)}(t) = \max\left(0, \hat{W}(t) - Q_\alpha(S)\right)$$
   $$P_{\text{rec}}^{(\alpha)}(t) = \max\left(0, D(t) - W_{\text{firm}}^{(\alpha)}(t)\right)$$
   $$\Delta P_{\text{buffer}}^{(\alpha)}(t) = P_{\text{rec}}^{(\alpha)}(t) - P_{\text{naive}}(t)$$
5. **Interactive Trading Desk:**
   * Date Picker (`2026-01-01` to `2026-02-01`) + Quick Scenario Presets (Jan 2 Shortfall, Jan 8 Drought, Jan 27 Storm).
   * Gate Closure Selector (`09:20 UTC`, `09:50 UTC`, `15:30 UTC`).
   * Uncertainty Fan Chart with $P_{10}–P_{90}$ prediction interval and toggleable outturn line.
   * Stacked Area Thermal Dispatch Schedule showing how consumer demand is balanced.
   * 48-Period Settlement Schedule Table with one-click **"Export CSV"** for trading desks.
6. **Quantitative Forecast Accuracy Audit:**
   * 6 Macro KPI Cards: MAE, RMSE, MBE (Systematic Bias), MAPE, VaR-90 Shortfall, VaR-95 Shortfall.
   * 2x2 Analytical Grid: Error vs Lead-Time Horizon (6h to 48h decay curve), Signed Error Histogram, Diurnal 48-SP Profile, Daily Accuracy Timeline.
   * Top 5 Extreme Shortfall Events Table with click-to-open **Forecast Evolution Horizon Cone**.
7. **Live Elexon API Connectivity Probe:** Active `/api/elexon/live-verify` endpoint querying live Elexon BMRS streams on-demand, measuring live latency.

---

## 3. Mathematical Methodology

### 3.1 Forecast Residuals & Shortfall
For each aligned settlement period $i \in \{1, \dots, N\}$:
* **Signed Forecast Error:** $e_i = \hat{W}_i - W_i$
  * $e_i > 0$: Over-forecast (Shortfall Deficit risk)
  * $e_i < 0$: Under-forecast (Energy Surplus / Curtailment risk)
* **Generation Shortfall:** $S_i = \max(0, e_i)$

### 3.2 Macro Evaluation Metrics
* **Mean Absolute Error (MAE):**
  $$\text{MAE} = \frac{1}{N} \sum_{i=1}^{N} |e_i| \quad (\text{MW})$$
* **Root Mean Squared Error (RMSE):**
  $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} e_i^2} \quad (\text{MW})$$
* **Mean Bias Error (MBE):**
  $$\text{MBE} = \frac{1}{N} \sum_{i=1}^{N} e_i \quad (\text{MW})$$
* **Mean Absolute Percentage Error (MAPE):**
  $$\text{MAPE} = \frac{100\%}{N} \sum_{i=1}^{N} \frac{|e_i|}{\max(W_i, 100\text{ MW})}$$
  *(The 100 MW floor avoids division-by-zero artifacts during calm wind periods).*
* **Normalized MAE (NMAE):**
  $$\text{NMAE} = \frac{\text{MAE}}{W_{\text{peak}}} \times 100\% \quad (W_{\text{peak}} \approx 17,805\text{ MW})$$

### 3.3 Empirical Value-at-Risk ($\text{VaR}_\alpha$)
Let $\mathcal{F}_S(s) = \frac{1}{N}\sum_{i=1}^N \mathbf{1}_{\{S_i \le s\}}$ be the empirical cumulative distribution function of shortfalls:
$$\text{VaR}_\alpha = Q_\alpha(S) = \inf \left\{ s \in \mathbb{R} \;\middle|\; \mathcal{F}_S(s) \ge \alpha \right\}$$

### 3.4 Cash-Out Loss Avoided Formulation
Let $\Delta \text{SBP} = C_{\text{SBP}} - C_{\text{DA}} \approx £95/\text{MWh}$.
For delivery day $D$, the financial penalty prevented by contracting the risk buffer is:
$$\text{Avoided Imbalance Loss} = \sum_{t=1}^{48} \min\left(S(t), \Delta P_{\text{buffer}}(t)\right) \times 0.5\text{h} \times \Delta\text{SBP}$$

---

## 4. Empirical January 2026 Audit Findings

| Metric | January 2026 Value | Operational Interpretation |
| :--- | :--- | :--- |
| **Total Settlement Periods** | **1,488 SP** | 100.0% data completeness (31 days × 48 SP) |
| **Peak Wind Outturn** | **17,805 MW** | January 27, 2026 (Storm Peak) |
| **Lowest Wind Outturn** | **1,695 MW** | January 8, 2026 (Severe Winter Drought) |
| **Monthly Mean Outturn** | **11,580.7 MW** | Baseline renewable capacity factor |
| **Mean Absolute Error (MAE)**| **2,127.8 MW** | Average Day-Ahead forecast error at 09:20 gate |
| **Root Mean Squared Error (RMSE)**| **2,735.4 MW** | Tail-penalized forecast blunder metric |
| **Mean Bias Error (MBE)** | **+842.1 MW** | NGESO systematically **over-forecasts** winter wind |
| **P90 Shortfall VaR** | **3,412.0 MW** | 90% shortfall ceiling buffer |
| **P95 Shortfall VaR** | **4,185.0 MW** | Stress-test tail risk buffer |

---

## 5. Repository Structure

```text
xqv9k/
├── api/
│   └── index.py                      # Vercel serverless function entrypoint
├── backend/
│   ├── __init__.py
│   ├── main.py                       # FastAPI application & REST route definitions
│   ├── schemas.py                    # Strict Pydantic V2 data validation schemas
│   ├── engine.py                     # Point-in-time join, metrics & thermal dispatch logic
│   ├── elexon_client.py              # Ingestion client, live verify & snapshot loader
│   ├── data/
│   │   └── elexon_jan2026.json       # Pre-materialized authentic Elexon Jan 2026 dataset (2.4 MB)
│   ├── scripts/
│   │   └── ingest_elexon.py          # Script to fetch fresh data from live Elexon API
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_engine.py            # Pytest causality, quantiles & thermal balance tests
│   │   └── test_api.py               # Pytest FastAPI endpoint integration tests
│   └── requirements.txt              # Backend dependencies
├── frontend/
│   ├── index.html                    # Terminal HTML entrypoint
│   ├── package.json                  # React 18, TypeScript, Vite, Tailwind, Recharts, Lucide
│   ├── tsconfig.json                 # TypeScript compiler configuration
│   ├── vite.config.ts                # Vite build and development proxy settings
│   ├── tailwind.config.js            # Institutional terminal color tokens
│   ├── postcss.config.js             # PostCSS plugins
│   └── src/
│       ├── main.tsx                  # React DOM root
│       ├── App.tsx                   # Main layout, view routing, footer
│       ├── index.css                 # Dark theme tokens and scrollbars
│       ├── types/
│       │   └── api.ts                # TypeScript interfaces mirroring Pydantic models
│       ├── services/
│       │   └── apiClient.ts          # Type-safe API client wrapper
│       └── components/
│           ├── HeaderBar.tsx         # Gate closure, scope toggle, live API status
│           ├── TradingDeskTab.tsx    # Tab 1: Fan chart, thermal procurement, 48-SP table
│           ├── AccuracyAuditTab.tsx  # Tab 2: 6 KPI cards, 2x2 analytical grid, worst events
│           ├── ForecastEvolutionModal.tsx # Drill-down modal for settlement period horizon cone
│           └── MetricCard.tsx        # Reusable metric card with formula tooltip
├── Dockerfile                        # Multi-stage production build (Node build -> Python runtime)
├── docker-compose.yml                # Local single-command startup
├── vercel.json                       # Unified Vercel serverless routing configuration
├── requirements.txt                  # Root requirements for Vercel Python runtime
├── .gitignore                        # Git exclusion rules
├── .dockerignore                     # Docker build exclusion rules
└── README.md                         # Documentation & submission overview
```

---

## 6. Local Setup & Startup Instructions

### Prerequisites
* **Python 3.11+**
* **Node.js 18+ & npm**
* *(Optional)* **Docker & Docker Compose**

### Option A: Running with Docker (Recommended)
Single-command multi-stage build that compiles the React frontend and serves both API and static UI on port 8000:
```bash
docker compose up --build
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

### Option B: Running Locally (Development Mode)

#### 1. Backend Setup (FastAPI)
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run backend test suite
pytest backend/tests/ -v

# Start FastAPI development server
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
API docs available at: `http://127.0.0.1:8000/docs`

#### 2. Frontend Setup (React 18 + Vite)
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Requests to `/api/*` are automatically proxied to `http://127.0.0.1:8000`.

---

## 7. Running Automated Test Suite

The test suite enforces rigorous mathematical and domain invariants:
```bash
pytest backend/tests/ -v
```

### Verified Test Invariants:
1. **Zero Lookahead Causality:** Asserts that for gate closure `09:20 UTC`, the engine strictly picks the `07:30 UTC` run and rejects post-gate runs (`09:30 UTC`, `11:30 UTC`), even when synthetic future runs are injected.
2. **Resolution Alignment:** Asserts exact hourly matching and linear half-hourly arithmetic interpolation.
3. **Quantile & Firm Wind Monotonicity:**
   * $W_{\text{firm}} \le \hat{W}$ across all settlement periods.
   * $\Delta P_{\text{buffer}} \ge 0$ across all settlement periods.
   * $P_{\text{rec}} \ge P_{\text{naive}}$ across all settlement periods.
4. **Thermal Accounting Balance:**
   * $W_{\text{firm}} + P_{\text{rec}} \ge \text{Demand}$ across all settlement periods.
5. **Empirical Shortfall Detection:** Verifies exact January 2, 2026 SP 46 shortfall miss (+4,335 MW).
6. **FastAPI Route Integration:** Verifies all REST endpoints return HTTP 200 with typed Pydantic models.

---

## 8. AI Tool Usage Disclosure

In compliance with Section 3 of the challenge instructions, the use of AI tools in this project is explicitly disclosed:

* **Domain & Empirical Research:** AI tools were utilized to synthesize the Elexon BSC market structure, audit BMRS API endpoints (`FUELHH`, `WINDFOR`), and inspect the January 2026 empirical dataset characteristics.
* **Mathematical & Algorithmic Formulation:** AI tools assisted in formalizing the point-in-time causality selection operator $\tau^*$, the empirical quantile Value-at-Risk formulation ($\text{VaR}_\alpha$), and the thermal dispatch buffer equations.
* **Code Implementation & Testing:** AI pair-programming tools were leveraged to scaffold boilerplate FastAPI routes, author the 20-test pytest verification suite, and build the React 18 / Recharts frontend components following institutional terminal design tokens.
* **Verification & Optimization:** All generated code, mathematical formulas, and empirical data points were rigorously audited, benchmarked against real Elexon data, and tested for 100% build and type safety.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
