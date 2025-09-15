# AQuery - Approximate Query Engine

## Overview  
AQuery is a high-performance approximate query processing engine designed for large-scale data analytics. It enables fast, resource-efficient queries using advanced sampling and sketching algorithms (Reservoir Sampling, Block Sampling, Stratified Sampling, Count–Min Sketch) while maintaining high accuracy.

## Features  
- Approximate queries with up to 10× speedup  
- Supports COUNT, SUM, AVG, and GROUP BY queries  
- Real-time data ingestion and updates  
- Interactive React dashboard for query building and visualization  

## Technology Stack  
- **Backend:** Node.js, Express, DuckDB  
- **Frontend:** React.js, Chart.js, Axios  
- **Sampling Algorithms:** Custom JavaScript implementations  

## Installation  

1. **Clone the repository:**  
   ```bash
   git clone https://github.com/Vivek06050/Approximate-Query-Engine
   ```

2. **Backend setup:**  
   ```bash
   cd backend
   npm install
   node server.js
   ```

3. **Prepare sample data:**  
   - Place the CSV file `sample.csv` at `backend/data/`  
   - If missing, the backend creates an empty header file  

4. **Frontend setup:**  
   - Serve the frontend from the `/frontend` directory, for example:  
     ```bash
     # example: using a static server or your preferred method
     ```
   - Access the dashboard at: `http://localhost:5500`

## Usage  
- Construct queries via the dashboard  
- Visualize and compare exact vs approximate results  
- Start live data generation  
- Monitor algorithm statuses and ingest samples  

## API Endpoints  
- `/count`, `/sum`, `/avg`, `/groupby` — exact queries  
- `/approximate/*` — approximate queries  
- `/sampler/*`, `/block-sampler/*`, `/stratified-sampler/*`, `/cms/*` — sampler controls  
- `/health` — API health check  

## Troubleshooting  
- Ensure the backend server is running  
- Confirm correct URLs and ports  
- Use appropriate headers in requests  
- Configure CORS in the backend  
- Adjust DuckDB CSV parsing options for malformed CSV  
