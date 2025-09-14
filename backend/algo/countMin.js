class CountMinSketch {
  constructor(width = 1000, depth = 5) {
    this.width = width;
    this.depth = depth;
    this.table = Array.from({ length: depth }, () => Array(width).fill(0));
    this.hashSeeds = Array.from({ length: depth }, (_, i) => i + 1);
    this.totalItems = 0; 
  }
  hash(value, seed) {
    let h = 0;
    for (let i = 0; i < value.length; i++) {
      h = (h * seed + value.charCodeAt(i)) % this.width;
    }
    return h;
  }
  add(value) {
    for (let i = 0; i < this.depth; i++) {
      const idx = this.hash(value, this.hashSeeds[i]);
      this.table[i][idx]++;
    }
    this.totalItems++;
  }
  count(value) {
    let min = Infinity;
    for (let i = 0; i < this.depth; i++) {
      const idx = this.hash(value, this.hashSeeds[i]);
      min = Math.min(min, this.table[i][idx]);
    }
    return min;
  }
  query(value) {
    return this.count(value);
  }

  getTotalItems() {
    return this.totalItems;
  }
}

module.exports = CountMinSketch;
