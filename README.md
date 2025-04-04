# Stock Options Visualizer

This web application visualizes stock options prices across different strike prices and expiration dates. It shows heatmaps for call options, put options, and combined options prices.

## Features
- Real-time options data fetching using Yahoo Finance API
- Interactive heatmap visualizations using Plotly
- Support for any stock symbol with options trading
- Displays call prices, put prices, and combined prices
- Hover-over functionality to see exact prices

## Setup

1. Create and activate a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows, use: .venv\Scripts\activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Start the backend server:
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

3. Open the frontend:
Navigate to the `frontend` directory and open `index.html` in your web browser.

## Usage
1. Enter a stock symbol (e.g., NVDA) in the input field
2. Click "Fetch Data" to load the options data
3. Explore the three heatmaps showing different options prices
4. Hover over any point to see detailed price information
