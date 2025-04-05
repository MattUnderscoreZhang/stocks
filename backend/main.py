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
    min_strike = spot_price * 0.8
    max_strike = spot_price * 1.2
    options_data = []
    for expiry in expiration_dates[:n_expirations]:
        calls = ticker.option_chain(expiry).calls
        calls = calls[calls['strike'].between(min_strike, max_strike)]
        puts = ticker.option_chain(expiry).puts
        puts = puts[puts['strike'].between(min_strike, max_strike)]

        # Merge calls and puts efficiently
        merged = pd.merge(
            calls[['strike', 'lastPrice']].rename(columns={'lastPrice': 'call_price'}),
            puts[['strike', 'lastPrice']].rename(columns={'lastPrice': 'put_price'}),
            on='strike',
            how='outer'
        )
        merged['total_price'] = merged['call_price'] + merged['put_price']
        merged['expiry'] = expiry
        options_data.extend(merged.to_dict('records'))  # converts dataframe to list of rows, with each row as a dict
    
    return {
        'spot_price': spot_price,
        'options_data': options_data,
    }

@app.get("/")
async def root():
    return {"message": "Options Visualization API"}

async def test_options_format():
    """Test get_options_data() return format for multiple symbols.

    example return:
    [
        {'strike': 80.0, 'call_price': 15.15, 'put_price': 0.02, 'total_price': 15.17, 'expiry': '2025-04-04'},
        {'strike': 85.0, 'call_price': 10.85, 'put_price': 0.04, 'total_price': 10.889999999999999, 'expiry': '2025-04-04'},
        ...
    ]
    """
    symbols = ['NVDA', 'MSFT']
    required_keys = {'spot_price', 'options_data'}
    option_keys = {'call_price', 'put_price', 'total_price', 'expiry', 'strike'}
    
    for symbol in symbols:
        print(f"\nTesting {symbol}...")
        try:
            # Get data for the symbol
            data = await get_options_data(symbol)
            
            # Test 1: Check top-level keys
            assert isinstance(data, dict), f"Data should be a dict, got {type(data)}"
            assert set(data.keys()) == required_keys, f"Missing required keys. Expected {required_keys}, got {set(data.keys())}"
            
            # Test 2: Check spot_price
            assert isinstance(data['spot_price'], (int, float)), f"spot_price should be numeric, got {type(data['spot_price'])}"
            
            # Test 3: Check options_data structure
            options = data['options_data']
            assert isinstance(options, list), f"options_data should be a list, got {type(options)}"
            assert len(options) > 0, "options_data should not be empty"
            
            # Test 4: Check each option entry
            for i, option in enumerate(options):
                assert isinstance(option, dict), f"Option {i} should be a dict"
                assert set(option.keys()) >= option_keys, f"Option {i} missing keys. Expected {option_keys}, got {set(option.keys())}"
                
                # Test 5: Check numeric values
                for key in ['call_price', 'put_price', 'total_price', 'strike']:
                    assert isinstance(option[key], (int, float, type(None))), f"Option {i}: {key} should be numeric or None"
                
                # Test 6: Check expiry format
                assert isinstance(option['expiry'], str), f"Option {i}: expiry should be string"
            
            print(f"✓ {symbol} passed all format tests")
            print(f"  Found {len(options)} options across {len(set(opt['expiry'] for opt in options))} expiration dates")
            
        except Exception as e:
            print(f"✗ {symbol} failed: {str(e)}")
            raise

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_options_format())