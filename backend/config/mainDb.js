// config/mainDb.js
const { MongoClient } = require('mongodb');

let client;
let mainDb;

async function connectMainDb() {
  if (mainDb) return mainDb;

  const uri = "mongodb+srv://repairradar24:JUJperoOaqwakJc5@cluster0.mvjkmdb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // hardcoded
  const dbName = "RepairRadar_Users"; // main database name

  client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await client.connect();
  console.log('✅ Connected to Main MongoDB');

  mainDb = client.db(dbName);
  return mainDb;
}

function getMainDb() {
  if (!mainDb) throw new Error('Main DB not connected. Call connectMainDb first.');
  return mainDb;
}

module.exports = { connectMainDb, getMainDb };
