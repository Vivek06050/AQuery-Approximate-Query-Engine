const fs = require("fs");
const readline = require("readline");

class ReservoirSampler {
  constructor(sampleFraction = 0.1) {
    if (!(sampleFraction > 0 && sampleFraction < 1)) {
      throw new Error("sampleFraction must be between 0 and 1 (exclusive).");
    }
    this.sampleFraction = sampleFraction;

    this.N = 0; 
    this.reservoir = []; 
    this.header = null; 
    this.filePath = null;
  }

  getK() {
    return Math.max(1, Math.ceil(this.N * this.sampleFraction));
  }
  parseLine(line) {
    return line.split(",").map((s) => s.trim());
  }

 
  async buildFromFile(filePath) {
    if (!fs.existsSync(filePath)) throw new Error("File not found: " + filePath);
    this.filePath = filePath;

    let header = null;
    let total = 0;
    {
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity,
      });

      for await (const raw of rl) {
        const line = raw.trim();
        if (!line) continue;
        if (!header) {
          header = this.parseLine(line);
          continue;
        }
        total++;
      }
      rl.close();
    }

    this.N = total;
    this.header = header || null;
    const K = Math.max(1, Math.ceil(this.N * this.sampleFraction));
    this.reservoir = [];

    let i = 0;
    const rl2 = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    for await (const raw of rl2) {
      const line = raw.trim();
      if (!line) continue;
      if (!this.header) {
        this.header = this.parseLine(line);
        continue;
      }
      const row = this.parseLine(line);
      i += 1;
      if (this.reservoir.length < K) {
        this.reservoir.push(row);
      } else {
        const j = Math.floor(Math.random() * i);
        if (j < K) {
          const pos = Math.floor(Math.random() * K);
          this.reservoir[pos] = row;
        }
      }
    }
    rl2.close();
    this.N = i;
    return { N: this.N, K, header: this.header };
  }

  processRow(rowOrLine) {
    const row = Array.isArray(rowOrLine) ? rowOrLine : this.parseLine(String(rowOrLine));
     this.N += 1;
    const desiredK = this.getK();
    const currentK = this.reservoir.length;

    if (currentK < desiredK) {
      this.reservoir.push(row);
      return { action: "push", N: this.N, K: desiredK, reservoirSize: this.reservoir.length };
    }
    const i = this.N;
    const j = Math.floor(Math.random() * i); 
    if (j < desiredK) {
      const replaceIdx = Math.floor(Math.random() * desiredK);
      this.reservoir[replaceIdx] = row;
      return { action: "replace", replaceIdx, N: this.N, K: desiredK };
    } else {
      return { action: "skip", N: this.N, K: desiredK };
    }
  }
 async rebuildFromFile() {
    if (!this.filePath) throw new Error("No filePath known. Call buildFromFile(filePath) first.");
    return await this.buildFromFile(this.filePath);
  }
 _colIndex(columnName) {
    if (!this.header) throw new Error("Header unknown. Set header or build from file first.");
    const idx = this.header.indexOf(columnName);
    if (idx === -1) throw new Error("Column not found: " + columnName);
    return idx;
  }
  approxSum(columnName) {
    if (!this.reservoir.length) throw new Error("Reservoir is empty.");
    const idx = this._colIndex(columnName);
    let sum = 0;
    let cnt = 0;
    for (const r of this.reservoir) {
      const v = Number(r[idx]);
      if (Number.isFinite(v)) {
        sum += v;
        cnt++;
      }
    }
    if (cnt === 0) return 0;
    return (sum / cnt) * this.N;
  }


  approxAvg(columnName) {
    if (!this.reservoir.length) throw new Error("Reservoir is empty.");
    const idx = this._colIndex(columnName);
    let sum = 0;
    let cnt = 0;
    for (const r of this.reservoir) {
      const v = Number(r[idx]);
      if (Number.isFinite(v)) {
        sum += v;
        cnt++;
      }
    }
    return cnt === 0 ? null : sum / cnt;
  }

  approxGroupBy(groupColumnName, aggColumnName) {
    if (!this.reservoir.length) throw new Error("Reservoir is empty.");
    const gIdx = this._colIndex(groupColumnName);
    const aIdx = this._colIndex(aggColumnName);

    const local = Object.create(null);
    let sampleCount = 0;
    for (const r of this.reservoir) {
      const key = r[gIdx];
      const v = Number(r[aIdx]);
      if (!Number.isFinite(v)) continue;
      sampleCount++;
      local[key] = (local[key] || 0) + v;
    }

    const scaled = {};
    if (sampleCount === 0) return scaled;
    const factor = this.N / sampleCount;
    for (const k of Object.keys(local)) {
      scaled[k] = local[k] * factor;
    }
    return scaled;
  }
  getTotalRows() {
    return this.N;
  }
  getReservoirSize() {
    return this.reservoir.length;
  }
  getHeader() {
    return this.header;
  }

  _getReservoir() {
    return this.reservoir;
  }
}

module.exports = { ReservoirSampler };
