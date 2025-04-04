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
    
    // Extract unique expiry dates and strike prices
    const expiries = [...new Set(options_data.map(d => d.expiry))];
    const strikes = [...new Set(options_data.map(d => d.strike))];
    
    // Create 2D arrays for the heatmaps
    const callPrices = createPriceMatrix(options_data, expiries, strikes, 'call_price');
    const putPrices = createPriceMatrix(options_data, expiries, strikes, 'put_price');
    const totalPrices = createPriceMatrix(options_data, expiries, strikes, 'total_price');
    
    const plots = [
        { z: callPrices, title: 'Call Option Prices' },
        { z: putPrices, title: 'Put Option Prices' },
        { z: totalPrices, title: 'Combined Option Prices' }
    ];
    
    const layout = {
        grid: {rows: 2, columns: 2, pattern: 'independent'},
        height: 800,
    };
    
    plots.forEach((plot, index) => {
        const heatmap = {
            type: 'heatmap',
            x: expiries,
            y: strikes,
            z: plot.z,
            colorscale: 'Viridis',
            hoverongaps: false,
            hovertemplate: 
                'Expiry: %{x}<br>' +
                'Strike: $%{y}<br>' +
                'Price: $%{z:.2f}<br>' +
                '<extra></extra>'
        };
        
        const subplotLayout = {
            title: plot.title,
            xaxis: { title: 'Expiration Date' },
            yaxis: { title: 'Strike Price ($)' },
            annotations: [{
                x: 0.5,
                y: 1.1,
                xref: 'paper',
                yref: 'paper',
                text: `Current Stock Price: $${spot_price.toFixed(2)}`,
                showarrow: false
            }]
        };
        
        Plotly.newPlot(`plotArea${index}`, [heatmap], subplotLayout);
    });
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

// Create plot areas on load
window.onload = function() {
    const plotArea = document.getElementById('plotArea');
    for (let i = 0; i < 3; i++) {
        const div = document.createElement('div');
        div.id = `plotArea${i}`;
        div.style.width = '100%';
        div.style.height = '400px';
        plotArea.appendChild(div);
    }
    // Fetch initial data for NVDA
    fetchData();
};
