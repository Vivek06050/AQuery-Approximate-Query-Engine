const crypto = require("crypto");
class HyperLogLog {
  constructor(b = 10) {
    this.b = b;
    this.m = 1 << b;
    this.registers = new Uint8Array(this.m);
  }

  hash(value) {
    const hash = crypto.createHash("sha1").update(value).digest();
    return hash.readUInt32BE(0);
  }
  add(value) {
    const x = this.hash(value);
    const idx = x >>> (32 - this.b); 
    const w = (x << this.b) | 0;  
    const rank = this.rank(w, 32 - this.b);
    this.registers[idx] = Math.max(this.registers[idx], rank);
  }
  rank(w, maxBits) {
    let r = 1;
    for (let i = 0; i < maxBits; i++) {
      if ((w & (1 << (31 - i))) === 0) r++;
      else break;
    }
    return r;
  }
  count() {
    const alphaMM = this.alphaMM();
    let Z = 0;
    for (let j = 0; j < this.m; j++) {
      Z += Math.pow(2, -this.registers[j]);
    }
    const E = alphaMM / Z;

    const V = this.registers.filter(r => r === 0).length;
    if (E <= 2.5 * this.m && V > 0) {
      return Math.round(this.m * Math.log(this.m / V));
    }
    if (E > (1 / 30) * Math.pow(2, 32)) {
      return Math.round(-Math.pow(2, 32) * Math.log(1 - E / Math.pow(2, 32)));
    }

    return Math.round(E);
  }

  alphaMM() {
    switch (this.m) {
      case 16: return 0.673 * this.m * this.m;
      case 32: return 0.697 * this.m * this.m;
      case 64: return 0.709 * this.m * this.m;
      default: return (0.7213 / (1 + 1.079 / this.m)) * this.m * this.m;
    }
  }

  reset() {
    this.registers.fill(0);
  }
}

module.exports = HyperLogLog;
