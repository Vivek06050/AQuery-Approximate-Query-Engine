# AQuery - Approximate Query Engine

## Overview
AQuery is a high-performance approximate query processing engine designed for large-scale data analytics. It enables fast, resource-efficient queries using advanced sampling and sketching algorithms (Reservoir Sampling, Block Sampling, Stratified Sampling, Count-Min Sketch) while maintaining high accuracy.

## Features
- Approximate queries with up to 10 times speedup
- Supports COUNT, SUM, AVG, GROUP BY queries
- Real-time data ingestion and updates
- Interactive React dashboard for query building and visualization

## Technology Stack
- Backend: Node.js, Express, DuckDB
- Frontend: React.js, Chart.js, Axios
- Sampling Algorithms: Custom JavaScript implementations

## Installation
1. Clone the repository:
   ```
git clone https://github.com/Vivek06050/Approximate-Query-Engine
```
2. Backend setup:
   ```
cd backend
npm install
node server.js
```
3. Prepare sample data:
   - Place CSV file `sample.csv` at `backend/data/`
   - If missing, backend creates empty header file.
4. Frontend setup:
   - Serve frontend from `/frontend` directory, e.g.:
     ```
```
   - Access at `http://localhost:5500`

## Usage
- Construct queries via dashboard
- Visualize and compare exact vs approximate results
- Start live data generation
- Monitor algorithm statuses and ingest samples

## API Endpoints
- `/count`, `/sum`, `/avg`, `/groupby` (exact queries)
- `/approximate/*` (approximate queries)
- `/sampler/*`, `/block-sampler/*`, `/stratified-sampler/*`, `/cms/*` (sampler controls)
- `/health` (API health check)

## Troubleshooting
- Ensure backend server is running
- Confirm correct URLs and ports
- Use appropriate headers in requests
- Configure CORS in backend
- Adjust DuckDB CSV parsing options for malformed CSV

## License
MIT License
