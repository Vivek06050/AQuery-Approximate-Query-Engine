const fs = require("fs");
const readline = require("readline");

class StratifiedSampler {
  constructor(stratColumn, fraction = 0.1) {
    this.stratColumn = stratColumn;      
    this.fraction = fraction;            
    this.strata = {};                    
    this.header = null;
    this.totalRows = 0;
  }

  parseLine(line) {
    return line.split(",");
  }

  getHeader() {
    return this.header;
  }

  async buildFromFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    let isHeader = true;
    for await (const line of rl) {
      if (isHeader) {
        this.header = this.parseLine(line);
        isHeader = false;
        continue;
      }
      this.processRow(line);
    }
  }

  processRow(line) {
    const row = this.parseLine(line);
    if (!this.header) this.header = Object.keys(row);

    const colIdx = this.header.indexOf(this.stratColumn);
    if (colIdx === -1) throw new Error(`Strat column "${this.stratColumn}" not found`);

    const stratum = row[colIdx];
    if (!this.strata[stratum]) this.strata[stratum] = [];
    if (Math.random() < this.fraction) {
      this.strata[stratum].push(row);
    }
    this.totalRows++;
    return { stratum, sampled: this.strata[stratum].length };
  }

  async rebuildFromFile(filePath) {
    this.strata = {};
    this.totalRows = 0;
    await this.buildFromFile(filePath);
    return { strataCount: Object.keys(this.strata).length };
  }

  approxSum(col) {
    const colIdx = this.header.indexOf(col);
    if (colIdx === -1) throw new Error(`Column "${col}" not found`);
    let sum = 0;
    for (const rows of Object.values(this.strata)) {
      sum += rows.reduce((acc, row) => acc + Number(row[colIdx] || 0), 0);
    }
    return sum / this.fraction;
  }

  approxAvg(col) {
    const colIdx = this.header.indexOf(col);
    if (colIdx === -1) throw new Error(`Column "${col}" not found`);
    let sum = 0, count = 0;
    for (const rows of Object.values(this.strata)) {
      sum += rows.reduce((acc, row) => acc + Number(row[colIdx] || 0), 0);
      count += rows.length;
    }
    return (sum / this.fraction) / (count / this.fraction);
  }

  approxGroupBy(groupCol, aggCol) {
    const groupIdx = this.header.indexOf(groupCol);
    const aggIdx = this.header.indexOf(aggCol);
    if (groupIdx === -1 || aggIdx === -1)
      throw new Error(`Columns "${groupCol}" or "${aggCol}" not found`);

    const result = {};
    for (const rows of Object.values(this.strata)) {
      for (const row of rows) {
        const key = row[groupIdx];
        result[key] = (result[key] || 0) + Number(row[aggIdx] || 0);
      }
    }
    for (const key in result) result[key] = result[key] / this.fraction;
    return result;
  }

  getStrataInfo() {
    const info = {};
    for (const stratum in this.strata) {
      info[stratum] = { count: this.strata[stratum].length };
    }
    return info;
  }

  getTotalRows() {
    return this.totalRows;
  }
}

module.exports = { StratifiedSampler };
