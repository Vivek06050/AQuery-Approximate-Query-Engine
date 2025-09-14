const fs = require("fs");
const path = require("path");
const axios = require("axios");

const csvFilePath = path.join(__dirname, "data", "sample.csv");

if (!fs.existsSync(csvFilePath)) {
  fs.writeFileSync(csvFilePath, "id,name,age,city,salary\n", "utf8");
  console.log("Created new sample.csv with header");
}

const names = ["Aarav","Isha","Kabir","Meera","Arjun","Neha","Rohan","Saanvi","Aditya","Kiara"];
const cities = ["Delhi","Mumbai","Bangalore","Hyderabad","Pune","Chennai","Kolkata","Ahmedabad","Jaipur","Chandigarh"];

function getRandomName() { return names[Math.floor(Math.random() * names.length)]; }
function getRandomCity() { return cities[Math.floor(Math.random() * cities.length)]; }
function getRandomAge() { return Math.floor(Math.random() * 16) + 20; }
function getRandomSalary() { return Math.floor(Math.random() * 50001) + 30000; }

async function appendRows() {
  let linesToAppend = "";

  const lines = fs.readFileSync(csvFilePath, "utf8").trim().split("\n");
  let lastId = 0;
  if (lines.length > 1) {
    const lastLine = lines[lines.length - 1];
    lastId = parseInt(lastLine.split(",")[0], 10);
  }

  for (let i = 0; i < 10; i++) {
    lastId++;
    const name = getRandomName();
    const age = getRandomAge();
    const city = getRandomCity();
    const salary = getRandomSalary();
    const row = `${lastId},${name},${age},${city},${salary}\n`;
    linesToAppend += row;

    const headers = { "Content-Type": "text/plain" };
    axios.post("http://localhost:3000/sampler/ingest", row, { headers }).catch(err => console.error("ReservoirSampler ingest error:", err.message));
    axios.post("http://localhost:3000/block-sampler/ingest", row, { headers }).catch(err => console.error("BlockSampler ingest error:", err.message));
    axios.post("http://localhost:3000/cms/ingest", city, { headers }).catch(err => console.error("CMS ingest error:", err.message));
    axios.post("http://localhost:3000/cms/ingest", name, { headers }).catch(err => console.error("CMS ingest error:", err.message));
    axios.post("http://localhost:3000/strat-sampler/ingest", row, { headers }).catch(err => console.error("StratifiedSampler ingest error:", err.message));
  }

  fs.appendFileSync(csvFilePath, linesToAppend, "utf8");
  console.log("Appended 10 rows, last ID now:", lastId);
}

setInterval(appendRows, 1000);
