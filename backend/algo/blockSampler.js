
const fs = require("fs");
const readline = require("readline");

class BlockSampler {
  /**
   * @param {number} sampleFraction fraction of blocks to keep (0..1), default 0.1 (10%)
   * @param {number} blockSize number of rows per block (default 100)
   */
  constructor(sampleFraction = 0.1, blockSize = 100) {
    if (!(sampleFraction > 0 && sampleFraction < 1)) {
      throw new Error("sampleFraction must be between 0 and 1 (exclusive).");
    }
    if (!(Number.isInteger(blockSize) && blockSize > 0)) {
      throw new Error("blockSize must be a positive integer.");
    }
    this.sampleFraction = sampleFraction;
    this.blockSize = blockSize;

    this.N = 0;
    this.blocksSeen = 0; 
    this.partialBuffer = [];
    this.reservoir = []; 
    this.header = null; 
    this.filePath = null;
  }
  getKBlocks() {
    return Math.max(1, Math.ceil(this.blocksSeen * this.sampleFraction));
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
    this.blocksSeen = Math.floor(this.N / this.blockSize);
    const K = this.getKBlocks();
    this.reservoir = [];

    if (this.blocksSeen === 0) {
      return { N: this.N, blocksSeen: this.blocksSeen, K, header: this.header };
    }
    let currentBlock = [];
    let blockIndex = 0; 
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
      currentBlock.push(this.parseLine(line));
      if (currentBlock.length === this.blockSize) {
        blockIndex++;
        if (this.reservoir.length < K) {
          this.reservoir.push(currentBlock.slice());
        } else {
          const j = Math.floor(Math.random() * blockIndex);
          if (j < K) {
            const pos = Math.floor(Math.random() * K);
            this.reservoir[pos] = currentBlock.slice();
          }
        }
        currentBlock = [];
      }
    }
    rl2.close();
    this.partialBuffer = currentBlock; 
    this.blocksSeen = blockIndex;
    return { N: this.N, blocksSeen: this.blocksSeen, K, header: this.header };
  }

  processRow(rowOrLine) {
    const row = Array.isArray(rowOrLine) ? rowOrLine : this.parseLine(String(rowOrLine));
    this.N += 1;
    this.partialBuffer.push(row);
    if (this.partialBuffer.length >= this.blockSize) {
      this.blocksSeen += 1;
      const block = this.partialBuffer.slice(0, this.blockSize);
      this.partialBuffer = this.partialBuffer.slice(this.blockSize);

      const K = this.getKBlocks();
      const bIndex = this.blocksSeen;

      if (this.reservoir.length < K) {
        this.reservoir.push(block);
        return { action: "push_block", blocksSeen: this.blocksSeen, K, reservoirBlocks: this.reservoir.length };
      }
      const j = Math.floor(Math.random() * bIndex);
      if (j < K) {
        const replaceIdx = Math.floor(Math.random() * K);
        this.reservoir[replaceIdx] = block;
        return { action: "replace_block", replaceIdx, blocksSeen: this.blocksSeen, K };
      } else {
        return { action: "skip_block", blocksSeen: this.blocksSeen, K };
      }
    }
    return { action: "buffer_row", N: this.N, partialSize: this.partialBuffer.length };
  }

  async rebuildFromFile() {
    if (!this.filePath) throw new Error("No filePath known. Call buildFromFile(filePath) first.");
    return await this.buildFromFile(this.filePath);
  }

  _colIndex(columnName) {
    if (!this.header) throw new Error("Header unknown.");
    const idx = this.header.indexOf(columnName);
    if (idx === -1) throw new Error("Column not found: " + columnName);
    return idx;
  }
  _sampledRowCount() {
    let cnt = 0;
    for (const b of this.reservoir) cnt += b.length;
    return cnt;
  }
  _sumInSampleByIndex(idx) {
    let sum = 0;
    let cnt = 0;
    for (const block of this.reservoir) {
      for (const row of block) {
        const v = Number(row[idx]);
        if (Number.isFinite(v)) {
          sum += v;
          cnt++;
        }
      }
    }
    return { sum, cnt };
  }

  approxSum(columnName) {
    if (!this.reservoir.length) throw new Error("Reservoir blocks empty.");
    const idx = this._colIndex(columnName);
    const { sum, cnt } = this._sumInSampleByIndex(idx);
    if (cnt === 0) return 0;
    const sampledRows = this._sampledRowCount();
    return (sum / sampledRows) * this.N;
  }

  approxAvg(columnName) {
    if (!this.reservoir.length) throw new Error("Reservoir blocks empty.");
    const idx = this._colIndex(columnName);
    const { sum, cnt } = this._sumInSampleByIndex(idx);
    return cnt === 0 ? null : sum / cnt;
  }

  approxGroupBy(groupColumnName, aggColumnName) {
    if (!this.reservoir.length) throw new Error("Reservoir blocks empty.");
    const gIdx = this._colIndex(groupColumnName);
    const aIdx = this._colIndex(aggColumnName);

    const local = Object.create(null);
    let sampleCount = 0;
    for (const block of this.reservoir) {
      for (const r of block) {
        const key = r[gIdx];
        const v = Number(r[aIdx]);
        if (!Number.isFinite(v)) continue;
        sampleCount++;
        local[key] = (local[key] || 0) + v;
      }
    }
    if (sampleCount === 0) return {};
    const factor = this.N / sampleCount;
    const scaled = {};
    for (const k of Object.keys(local)) {
      scaled[k] = local[k] * factor;
    }
    return scaled;
  }
  getTotalRows() {
    return this.N;
  }
  getBlockCount() {
    return this.blocksSeen;
  }
  getReservoirBlockCount() {
    return this.reservoir.length;
  }
  getHeader() {
    return this.header;
  }
  _getReservoirBlocks() {
    return this.reservoir;
  }
}

module.exports = { BlockSampler };
