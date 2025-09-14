const express = require("express");
const path = require("path");
const fs = require("fs");
const { ReservoirSampler } = require("../algo/reservoir");
const { BlockSampler } = require("../algo/blockSampler");
const CountMinSketch = require("../algo/countMin");
const { StratifiedSampler } = require("../algo/stratifiedSampler");

function createQueryRoutes(connection, convertBigInt) {
  const router = express.Router();
  const csvFilePath = path.join(__dirname, "..", "data", "sample.csv");

  const sampler = new ReservoirSampler(0.1);
  let reservoirReady = false;
  sampler.buildFromFile(csvFilePath)
    .then(() => { reservoirReady = true; console.log("ReservoirSampler ready"); })
    .catch(err => console.error("ReservoirSampler build error:", err.message));
  function ensureSamplerReady(res) {
    if (!reservoirReady) { res.status(503).json({ error: "ReservoirSampler not ready yet" }); return false; }
    return true;
  }
  const blockSampler = new BlockSampler(0.1);
  let blockReady = false;
  blockSampler.buildFromFile(csvFilePath)
    .then(() => { blockReady = true; console.log("BlockSampler ready"); })
    .catch(err => console.error("BlockSampler build error:", err.message));
  function ensureBlockSamplerReady(res) {
    if (!blockReady) { res.status(503).json({ error: "BlockSampler not ready yet" }); return false; }
    return true;
  }
  const cms = new CountMinSketch(1000, 5);
  if (fs.existsSync(csvFilePath)) {
    const lines = fs.readFileSync(csvFilePath, "utf8").trim().split("\n");
    if (lines.length > 1) {
      const header = lines.shift().split(",");
      lines.forEach(line => {
        const parts = line.split(",");
        const name = parts[1];
        const city = parts[3];
        cms.add(name);
        cms.add(city);
      });
      console.log(`CMS built from CSV, total items: ${cms.getTotalItems()}`);
    }
  }
  function ensureCmsReady(res) {
    if (cms.getTotalItems() === 0) {
      res.status(503).json({ error: "CMS not ready yet. No items added." });
      return false;
    }
    return true;
  }
  const stratSampler = new StratifiedSampler("city");
  let stratReady = false;
  stratSampler.buildFromFile(csvFilePath)
    .then(() => { stratReady = true; console.log("StratifiedSampler ready"); })
    .catch(err => console.error("StratifiedSampler build error:", err.message));
  function ensureStratReady(res) {
    if (!stratReady) { res.status(503).json({ error: "StratifiedSampler not ready yet" }); return false; }
    return true;
  }

  router.get("/count", (req, res) => {
    const start = process.hrtime.bigint();
    connection.all("SELECT COUNT(*) AS total_rows FROM sample_data", (err, rows) => {
      const end = process.hrtime.bigint();
      if (err) return res.status(500).json({ error: err.message, time_ms: Number(end-start)/1e6 });
      res.json({ result: convertBigInt(rows[0]), time_ms: Number(end-start)/1e6 });
    });
  });

  router.get("/sum", (req,res)=> {
    const col = req.query.column;
    if(!col) return res.status(400).json({error:"column param required"});
    const start = process.hrtime.bigint();
    connection.all(`SELECT SUM(${col}) AS total_sum FROM sample_data`, (err, rows)=>{
      const end = process.hrtime.bigint();
      if(err) return res.status(500).json({error:err.message, time_ms:Number(end-start)/1e6});
      res.json({result: convertBigInt(rows[0]), time_ms: Number(end-start)/1e6});
    });
  });

  router.get("/avg", (req,res)=>{
    const col = req.query.column;
    if(!col) return res.status(400).json({error:"column param required"});
    const start = process.hrtime.bigint();
    connection.all(`SELECT AVG(${col}) AS avg_value FROM sample_data`, (err, rows)=>{
      const end = process.hrtime.bigint();
      if(err) return res.status(500).json({error:err.message, time_ms:Number(end-start)/1e6});
      res.json({result: rows[0], time_ms:Number(end-start)/1e6});
    });
  });

  router.get("/groupby", (req,res)=>{
    const group = req.query.group;
    const agg = req.query.agg;
    if(!group || !agg) return res.status(400).json({error:"group and agg params required"});
    const start = process.hrtime.bigint();
    connection.all(`SELECT ${group}, SUM(${agg}) AS total FROM sample_data GROUP BY ${group}`, (err, rows)=>{
      const end = process.hrtime.bigint();
      if(err) return res.status(500).json({error:err.message, time_ms:Number(end-start)/1e6});
      res.json({result: convertBigInt(rows), time_ms:Number(end-start)/1e6});
    });
  });
  router.get("/approx-sum", (req,res)=>{
    if(!ensureSamplerReady(res)) return;
    const col = req.query.column;
    if(!col) return res.status(400).json({error:"column param required"});
    const start = process.hrtime.bigint();
    try { 
      const approx = sampler.approxSum(col);
      const end = process.hrtime.bigint();
      res.json({approx_sum: approx, time_ms: Number(end-start)/1e6});
    } catch(err){ res.status(500).json({error:err.message}); }
  });

  router.get("/approx-avg", (req,res)=>{
    if(!ensureSamplerReady(res)) return;
    const col = req.query.column;
    if(!col) return res.status(400).json({error:"column param required"});
    const start = process.hrtime.bigint();
    try { 
      const approx = sampler.approxAvg(col);
      const end = process.hrtime.bigint();
      res.json({approx_avg: approx, time_ms: Number(end-start)/1e6});
    } catch(err){ res.status(500).json({error:err.message}); }
  });

  router.get("/approx-groupby", (req,res)=>{
    if(!ensureSamplerReady(res)) return;
    const group = req.query.group;
    const agg = req.query.agg;
    if(!group || !agg) return res.status(400).json({error:"group and agg params required"});
    const start = process.hrtime.bigint();
    try { 
      const approx = sampler.approxGroupBy(group, agg);
      const end = process.hrtime.bigint();
      res.json({approx_groupby: approx, time_ms: Number(end-start)/1e6});
    } catch(err){ res.status(500).json({error:err.message}); }
  });

  router.get("/sampler/status", (req,res)=>{
    const start = process.hrtime.bigint();
    const data = {N: sampler.getTotalRows(), K: sampler.getReservoirSize(), header: sampler.getHeader()};
    const end = process.hrtime.bigint();
    res.json({...data, time_ms: Number(end-start)/1e6});
  });

  router.post("/sampler/ingest", express.text({type:"*/*"}), (req,res)=>{
    const start = process.hrtime.bigint();
    const line = (req.body||"").trim();
    if(!line) return res.status(400).json({error:"CSV line required"});
    if(!sampler.getHeader()){ sampler.header = sampler.parseLine(line); const end = process.hrtime.bigint(); return res.json({action:"set-header", header: sampler.getHeader(), time_ms:Number(end-start)/1e6}); }
    const meta = sampler.processRow(line);
    const end = process.hrtime.bigint();
    res.json({action: meta.action, N: meta.N, K: meta.K, reservoirSize: sampler.getReservoirSize(), time_ms:Number(end-start)/1e6});
  });

  router.post("/sampler/rebuild", async (req,res)=>{
    const start = process.hrtime.bigint();
    try{ 
      const info = await sampler.rebuildFromFile(); 
      const end = process.hrtime.bigint();
      res.json({rebuilt:true, info, time_ms: Number(end-start)/1e6}); 
    } catch(err){ 
      const end = process.hrtime.bigint();
      res.status(500).json({error:err.message, time_ms:Number(end-start)/1e6}); 
    }
  });
  router.get("/block-approx-sum", (req,res)=>{
    if(!ensureBlockSamplerReady(res)) return;
    const col = req.query.column;
    if(!col) return res.status(400).json({error:"column param required"});
    const start = process.hrtime.bigint();
    try { 
      const approx = blockSampler.approxSum(col);
      const end = process.hrtime.bigint();
      res.json({approx_sum: approx, time_ms: Number(end-start)/1e6});
    } catch(err){ res.status(500).json({error:err.message}); }
  });

  router.get("/block-approx-avg", (req,res)=>{
    if(!ensureBlockSamplerReady(res)) return;
    const col = req.query.column;
    if(!col) return res.status(400).json({error:"column param required"});
    const start = process.hrtime.bigint();
    try { 
      const approx = blockSampler.approxAvg(col);
      const end = process.hrtime.bigint();
      res.json({approx_avg: approx, time_ms: Number(end-start)/1e6});
    } catch(err){ res.status(500).json({error:err.message}); }
  });

  router.get("/block-approx-groupby", (req,res)=>{
    if(!ensureBlockSamplerReady(res)) return;
    const group = req.query.group;
    const agg = req.query.agg;
    if(!group || !agg) return res.status(400).json({error:"group and agg params required"});
    const start = process.hrtime.bigint();
    try { 
      const approx = blockSampler.approxGroupBy(group, agg);
      const end = process.hrtime.bigint();
      res.json({approx_groupby: approx, time_ms: Number(end-start)/1e6});
    } catch(err){ res.status(500).json({error:err.message}); }
  });

  router.get("/block-sampler/status", (req,res)=>{
    const start = process.hrtime.bigint();
    const data = {
      N:blockSampler.getTotalRows(),
      blocksSeen:blockSampler.getBlockCount(),
      reservoirBlocks:blockSampler.getReservoirBlockCount(),
      header:blockSampler.getHeader()
    };
    const end = process.hrtime.bigint();
    res.json({...data, time_ms: Number(end-start)/1e6});
  });

  router.post("/block-sampler/ingest", express.text({type:"*/*"}), (req,res)=>{
    const start = process.hrtime.bigint();
    const line = (req.body||"").trim();
    if(!line) return res.status(400).json({error:"CSV line required"});
    if(!blockSampler.getHeader()){ blockSampler.header = blockSampler.parseLine(line); const end = process.hrtime.bigint(); return res.json({action:"set-header", header:blockSampler.getHeader(), time_ms:Number(end-start)/1e6}); }
    const meta = blockSampler.processRow(line);
    const end = process.hrtime.bigint();
    res.json({action: meta.action, N: blockSampler.getTotalRows(), blocksSeen: blockSampler.getBlockCount(), reservoirBlocks: blockSampler.getReservoirBlockCount(), time_ms:Number(end-start)/1e6});
  });

  router.post("/block-sampler/rebuild", async (req,res)=>{
    const start = process.hrtime.bigint();
    try{ 
      const info = await blockSampler.rebuildFromFile(); 
      const end = process.hrtime.bigint();
      res.json({rebuilt:true, info, time_ms:Number(end-start)/1e6}); 
    } catch(err){ 
      const end = process.hrtime.bigint();
      res.status(500).json({error:err.message, time_ms:Number(end-start)/1e6}); 
    }
  });
  router.get("/cms/count", (req,res)=>{
    if(!ensureCmsReady(res)) return;
    const item = req.query.item;
    if(!item) return res.status(400).json({error:"item param required"});
    const start = process.hrtime.bigint();
    const freq = cms.query(item);
    const end = process.hrtime.bigint();
    res.json({item, approx_count: freq, time_ms: Number(end-start)/1e6});
  });

  router.post("/cms/ingest", express.text({type:"*/*"}), (req,res)=>{
    const start = process.hrtime.bigint();
    const item = (req.body||"").trim();
    if(!item) return res.status(400).json({error:"item required in body"});
    cms.add(item);
    const end = process.hrtime.bigint();
    res.json({action:"added", item, totalItems: cms.getTotalItems(), time_ms: Number(end-start)/1e6});
  });

  router.get("/cms/status", (req,res)=>{
    const start = process.hrtime.bigint();
    const data = {totalItems: cms.getTotalItems(), width: cms.width, depth: cms.depth};
    const end = process.hrtime.bigint();
    res.json({...data, time_ms: Number(end-start)/1e6});
  });
  router.get("/strat-approx-sum", (req,res)=>{
    if(!ensureStratReady(res)) return;
    const col = req.query.column;
    if(!col) return res.status(400).json({error:"column param required"});
    const start = process.hrtime.bigint();
    try { 
      const approx = stratSampler.approxSum(col);
      const end = process.hrtime.bigint();
      res.json({approx_sum: approx, time_ms:Number(end-start)/1e6});
    } catch(err){ res.status(500).json({error:err.message}); }
  });

  router.get("/strat-approx-avg", (req,res)=>{
    if(!ensureStratReady(res)) return;
    const col = req.query.column;
    if(!col) return res.status(400).json({error:"column param required"});
    const start = process.hrtime.bigint();
    try { 
      const approx = stratSampler.approxAvg(col);
      const end = process.hrtime.bigint();
      res.json({approx_avg: approx, time_ms:Number(end-start)/1e6});
    } catch(err){ res.status(500).json({error:err.message}); }
  });

  router.get("/strat-approx-groupby", (req,res)=>{
    if(!ensureStratReady(res)) return;
    const group = req.query.group;
    const agg = req.query.agg;
    if(!group || !agg) return res.status(400).json({error:"group and agg params required"});
    const start = process.hrtime.bigint();
    try { 
      const approx = stratSampler.approxGroupBy(group, agg);
      const end = process.hrtime.bigint();
      res.json({approx_groupby: approx, time_ms:Number(end-start)/1e6});
    } catch(err){ res.status(500).json({error:err.message}); }
  });

  router.get("/strat-sampler/status", (req,res)=>{
    const start = process.hrtime.bigint();
    const data = {totalRows: stratSampler.getTotalRows(), strata: stratSampler.getStrataInfo()};
    const end = process.hrtime.bigint();
    res.json({...data, time_ms:Number(end-start)/1e6});
  });

  router.post("/strat-sampler/ingest", express.text({type:"*/*"}), (req,res)=>{
    const start = process.hrtime.bigint();
    const line = (req.body||"").trim();
    if(!line) return res.status(400).json({error:"CSV line required"});
    const meta = stratSampler.processRow(line);
    const end = process.hrtime.bigint();
    res.json({action: meta.action, strata: stratSampler.getStrataInfo(), time_ms:Number(end-start)/1e6});
  });

  router.post("/strat-sampler/rebuild", async (req,res)=>{
    const start = process.hrtime.bigint();
    try { 
      const info = await stratSampler.rebuildFromFile(); 
      const end = process.hrtime.bigint();
      res.json({rebuilt:true, info, time_ms:Number(end-start)/1e6});
    } catch(err){ 
      const end = process.hrtime.bigint();
      res.status(500).json({error:err.message, time_ms:Number(end-start)/1e6}); 
    }
  });
  

  return router;
}

module.exports = createQueryRoutes;
