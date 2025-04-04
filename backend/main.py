from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from functools import wraps
import numpy as np
import pandas as pd
import time
import yfinance as yf

def retry_with_backoff(retries=3, backoff_in_seconds=1):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            x = 0
            while True:
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if x == retries:
                        raise e
                    sleep_time = (backoff_in_seconds * 2 ** x + 
                                np.random.uniform(0, 1))
                    time.sleep(sleep_time)
                    x += 1
        return wrapper
    return decorator

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@retry_with_backoff(retries=3, backoff_in_seconds=2)
async def get_stock_ticker(symbol: str) -> yf.Ticker:
    try:
        # Get stock data with delay between requests
        ticker = yf.Ticker(symbol)
        info = ticker.info
        if 'regularMarketPrice' not in info:
            raise HTTPException(
                status_code=404,
                detail=f"Could not fetch price data for {symbol}. Please verify the symbol is correct."
            )
        return ticker
    except Exception as e:
        if 'Too many requests' in str(e):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please wait a moment before trying again."
            )
        raise e

@app.get("/options/{symbol}")
async def get_options_data(symbol: str, n_expirations: int = 6) -> dict:
    ticker = await get_stock_ticker(symbol)
    expiration_dates = ticker.options
    if not expiration_dates:
        raise HTTPException(status_code=404, detail="No options data available")

    # Get options data around current price (±20%)
    spot_price = ticker.info['regularMarketPrice']
    options_data = []
    for expiry in expiration_dates[:n_expirations]:
        min_strike = spot_price * 0.8
        max_strike = spot_price * 1.2
        calls = ticker.option_chain(expiry).calls
        calls = calls[calls['strike'].between(min_strike, max_strike)]
        puts = ticker.option_chain(expiry).puts
        puts = puts[puts['strike'].between(min_strike, max_strike)]
        
        # Merge calls and puts data
        for _, call in calls.iterrows():
            strike = call['strike']
            matching_put = puts[puts['strike'] == strike]
            options_data.append({
                'expiry': expiry,
                'strike': float(strike),
                'call_price': float(call['lastPrice']),
                'put_price': float(matching_put['lastPrice']),
                'total_price': float(call['lastPrice'] + matching_put['lastPrice'])
            })
    
    return {
        'spot_price': spot_price,
        'options_data': options_data,
    }

@app.get("/")
async def root():
    return {"message": "Options Visualization API"}