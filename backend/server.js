const express = require("express");
const duckdb = require("duckdb");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const createQueryRoutes = require("./routes/queries");

const app = express();
const PORT = 3000;

// Enable CORS for your frontend
app.use(
  cors({
    origin: "http://127.0.0.1:5500",
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Ensure db folder exists
const dbDir = path.join(__dirname, "db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

// Path to DuckDB database file
const dbFile = path.join(dbDir, "aquery.duckdb");
const db = new duckdb.Database(dbFile);
const connection = db.connect();

// CSV file path
const csvFilePath = path.join(__dirname, "data", "sample.csv");
// Normalize path for DuckDB (important on Windows)
const normalizedCsvPath = csvFilePath.replace(/\\/g, "/");

// Convert BigInt to string for JSON responses
function convertBigInt(obj) {
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(convertBigInt);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = convertBigInt(obj[k]);
    }
    return out;
  }
  return obj;
}

// Load CSV into DuckDB view
function loadCSV() {
  return new Promise((resolve, reject) => {
    const query = `
      CREATE OR REPLACE VIEW sample_data AS
      SELECT * FROM read_csv_auto('${normalizedCsvPath}', delim=',', header=true)
    `;
    connection.run(query, (err) => {
      if (err) return reject(err);
      console.log("sample_data view created from CSV:", normalizedCsvPath);
      resolve();
    });
  });
}

// Start the server after loading CSV
(async () => {
  try {
    if (!fs.existsSync(csvFilePath)) {
      console.warn("CSV file missing:", csvFilePath);
    } else {
      await loadCSV(); // Create the view before mounting routes
    }
  } catch (err) {
    console.error("Failed to create sample_data from CSV:", err);
  }

  // Mount query routes (pass connection + convertBigInt)
  const queryRoutes = createQueryRoutes(connection, convertBigInt);
  app.use("/", queryRoutes);

  // Start listening
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

})();
