// config/mainDb.js
const { MongoClient } = require('mongodb');

require('dotenv').config();

const MAIN_DB_URL = process.env.MAIN_DB_URL;

if (!MAIN_DB_URL) {
  console.error("FATAL ERROR: MAIN_DB_URL is not defined in .env file");
  process.exit(1); // Stop the server if the secret is missing
}

let client;
let mainDb;

async function connectMainDb() {
  if (mainDb) return mainDb;

  const uri = MAIN_DB_URL;
  const dbName = "RepairRadar_Users"; // main database name

  client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await client.connect();
  console.log('✅ Connected to Main MongoDB');

  mainDb = client.db(dbName);
  console.log(`Connected to database: ${dbName}`);
  return mainDb;
}

async function getMainDb() {
  console.log("Getting main DB connection, " + mainDb);
  if (!mainDb) {
    await connectMainDb()
  }
  return mainDb;
}

module.exports = { connectMainDb, getMainDb };
