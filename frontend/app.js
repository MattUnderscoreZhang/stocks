async function fetchData() {
    const symbol = document.getElementById('stockSymbol').value.toUpperCase();
    const fetchButton = document.getElementById('fetchButton');
    const statusDiv = document.getElementById('status');
    
    try {
        fetchButton.disabled = true;
        statusDiv.textContent = 'Fetching data...';
        statusDiv.style.color = 'blue';
        
        const response = await fetch(`http://localhost:8000/options/${symbol}`);
        const data = await response.json();
        
        if (response.ok) {
            statusDiv.textContent = 'Data loaded successfully!';
            statusDiv.style.color = 'green';
            storeLastData(data);
            createPlots(data);
        } else {
            if (response.status === 429) {
                statusDiv.textContent = 'Rate limit exceeded. Please wait a moment before trying again.';
            } else {
                statusDiv.textContent = `Error: ${data.detail}`;
            }
            statusDiv.style.color = 'red';
        }
    } catch (error) {
        statusDiv.textContent = 'Error fetching data. Please try again.';
        statusDiv.style.color = 'red';
        console.error('Error:', error);
    } finally {
        fetchButton.disabled = false;
    }
}

function createPlots(data) {
    const { options_data, spot_price } = data;
    const plotType = document.getElementById('plotType').value;
    
    // Group data by expiry dates
    const expiryData = {};
    options_data.forEach(d => {
        if (!expiryData[d.expiry]) {
            expiryData[d.expiry] = [];
        }
        expiryData[d.expiry].push(d);
    });

    // Create traces for each expiry date
    const traces = Object.entries(expiryData).map(([expiry, data], index) => {
        const priceKey = plotType === 'call' ? 'call_price' : 
                        plotType === 'put' ? 'put_price' : 'total_price';
        
        // Filter out null values and create points array
        const points = data
            .filter(d => {
                const isValid = d[priceKey] !== null && !isNaN(d[priceKey]);
                if (!isValid) {
                    console.log('Filtered out point:', d);
                }
                return isValid;
            })
            .map(d => ({
                x: d[priceKey],
                y: d.strike
            }))
            .sort((a, b) => a.y - b.y); // Sort by strike price
        
        console.log(`Found ${points.length} valid points for ${expiry}`);
        
        return {
            x: points.map(p => p.x),
            y: points.map(p => p.y),
            mode: 'markers+lines',
            type: 'scatter',
            name: expiry,
            marker: {
                size: 8
            },
            line: {
                shape: 'spline',  // Smooth the line
                smoothing: 0.3
            }
        };
    });

    // Add vertical line at spot price
    traces.push({
        x: [0, Math.max(...options_data.map(d => {
            const price = plotType === 'call' ? d.call_price : 
                         plotType === 'put' ? d.put_price : d.total_price;
            return price * 1.2; // Extend line 20% beyond max price
        }))],
        y: [spot_price, spot_price],
        mode: 'lines',
        line: {
            dash: 'dash',
            color: 'gray'
        },
        name: 'Current Price'
    });
    
    const plotTitle = plotType === 'call' ? 'Call Option Prices' : 
                      plotType === 'put' ? 'Put Option Prices' : 'Combined Option Prices';

    const layout = {
        title: plotTitle,
        xaxis: {
            title: 'Premium ($)',
            zeroline: true,
            showline: true
        },
        yaxis: {
            title: 'Strike Price ($)',
            zeroline: true,
            showline: true
        },
        showlegend: true,
        legend: {
            x: 1,
            xanchor: 'right',
            y: 1
        },
        hovermode: 'closest',
        annotations: [{
            x: 0.5,
            y: 1.05,
            xref: 'paper',
            yref: 'paper',
            text: `Current Stock Price: $${spot_price.toFixed(2)}`,
            showarrow: false
        }]
    };

    Plotly.newPlot('plotArea', traces, layout);
}

function createPriceMatrix(data, expiries, strikes, priceType) {
    const matrix = [];
    strikes.sort((a, b) => a - b);
    
    for (const strike of strikes) {
        const row = [];
        for (const expiry of expiries) {
            const point = data.find(d => d.expiry === expiry && d.strike === strike);
            row.push(point ? point[priceType] : null);
        }
        matrix.push(row);
    }
    return matrix;
}

// Initialize on load
window.onload = function() {
    // Fetch initial data for NVDA
    fetchData();

    // Add event listener for plot type changes
    document.getElementById('plotType').addEventListener('change', () => {
        const data = window._lastData;
        if (data) {
            createPlots(data);
        }
    });
};

// Store the last fetched data for plot type changes
function storeLastData(data) {
    window._lastData = data;
}
