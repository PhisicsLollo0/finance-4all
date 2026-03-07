# 💰 Finance 4 All

> Free, open-source financial simulators and tools for everyone — no sign-up, no ads, no BS.

🌐 **Live App:** [finance-4all.vercel.app](https://finance-4all.vercel.app)

---

## 📖 About

**Finance 4 All** is a web platform designed to make personal finance education accessible to everyone. It provides interactive simulators and visualisation tools that help users understand the long-term impact of investment decisions — from fees and compounding to historical portfolio performance.

The project is built with a **React + TypeScript** frontend and a **Python FastAPI** backend, deployed on Vercel.

---

## 🛠️ Tools Available

### 📊 Finance Simulators
| Tool | Status | Description |
|---|---|---|
| 💸 **Fee & TER Simulator** | ✅ Live | Visualise how Total Expense Ratios silently compound against your wealth over time. Compare ETFs, robo-advisors, active funds, and insurance products side by side. |
| 📈 **Rolling Returns Analyser** | ✅ Live | Explore how different portfolio allocations performed historically using rolling-window analysis on real MSCI & FTSE index data going back to the 1970s. |
| 🪙 **Compound Interest Calculator** | 🔜 Coming Soon | See how regular contributions and reinvested returns snowball across different time horizons and interest rates. |
| ⚖️ **Asset Allocation Analyser** | 🔜 Coming Soon | Explore how splitting capital between stocks, bonds, and cash affects your expected risk and return profile. |
| 🕐 **Retirement Planner** | 🔜 Coming Soon | Model how much you need to save each month to reach a target portfolio by a given retirement age. |

### 🎲 Fun & Digressions
| Tool | Status | Description |
|---|---|---|
| 🎰 **Martingale Roulette Simulator** | ✅ Live | Run Monte-Carlo simulations of the Martingale betting strategy on European roulette. Explore the statistics behind the most famous (and dangerous) gambling strategy. |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite |
| **UI Library** | Mantine v8, Tabler Icons |
| **Charts** | Plotly.js + react-plotly.js |
| **Routing** | React Router v7 |
| **Backend** | Python, FastAPI, NumPy, Pandas |
| **Deployment** | Vercel (frontend + serverless API) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.9+)

### Installation

Clone the repository and install all dependencies with a single command:

```bash
git clone https://github.com/PhisicsLollo0/finance-4all.git
cd finance-4all
make install
```

This will:
1. Create a Python virtual environment (`.venv`) and install backend dependencies
2. Install Node.js frontend dependencies

### Running Locally

**Run both frontend and backend concurrently:**
```bash
make dev
```

**Or run them separately:**
```bash
# Backend only — FastAPI on http://localhost:8000
make backend

# Frontend only — Vite dev server on http://localhost:5173
make frontend
```

---

## 📁 Project Structure

```
finance-4all/
├── src/                    # React frontend (TypeScript)
│   ├── pages/              # Page components
│   │   ├── Landing.tsx     # Home / tools registry
│   │   ├── Simulator.tsx   # Fee & TER Simulator
│   │   ├── RollingReturns.tsx  # Rolling Returns Analyser
│   │   └── MartingaleSimulator.tsx  # Martingale Roulette Simulator
│   ├── App.tsx             # App shell & routing
│   └── main.tsx            # Entry point
├── backend/                # Python FastAPI backend
│   ├── main.py             # App entrypoint & router registration
│   ├── src/
│   │   ├── routers/        # API route handlers (simulators, games, rolling_returns)
│   │   └── core/           # Middleware (CORS, etc.)
│   └── requirements.txt    # Python dependencies
├── api/                    # Vercel serverless adapter
│   ├── index.py            # Entry point for Vercel (bridges to backend)
│   └── requirements.txt    # Vercel-specific dependencies
├── public/                 # Static assets
├── Makefile                # Developer shortcuts
├── vercel.json             # Vercel deployment config
├── vite.config.ts          # Vite configuration
└── package.json            # Node dependencies & scripts
```

---

## 🔌 API Endpoints

The backend exposes the following routes (available with or without the `/api` prefix):

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/simulators/linear` | Linear growth simulation |
| `GET` | `/rolling-returns/...` | Rolling returns analysis |
| `POST` | `/games/martingale` | Martingale Monte-Carlo simulation |

---

## 🤝 Contributing

Contributions are welcome! If you'd like to add a new tool or improve an existing one:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-new-tool`)
3. Commit your changes
4. Open a Pull Request

---

## 📄 License

This project is open source. Feel free to use it, learn from it, and contribute back.

---

<p align="center">Made with ❤️ for financial literacy</p>