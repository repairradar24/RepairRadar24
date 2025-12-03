const { MongoClient } = require('mongodb');
require('dotenv').config();

// Ensure the connection string is available
const MONGO_URI = process.env.MAIN_DB_URL;

if (!MONGO_URI) {
  console.error("FATAL ERROR: MAIN_DB_URL is not defined in .env file");
  process.exit(1);
}

const DB_NAME = "RepairRadar_Users"; // Single DB for ALL data

let client;
let dbInstance;

async function connectToDatabase() {
  // If already connected, return the existing instance
  if (dbInstance) return dbInstance;

  try {
    client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Optional: Connection pooling settings
      maxPoolSize: 50,
      minPoolSize: 5
    });

    await client.connect();

    dbInstance = client.db(DB_NAME);
    console.log(`✅ Connected to Unified Database: ${DB_NAME}`);

    return dbInstance;
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

// Synchronous helper to get the DB instance after initialization
function getDb() {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call connectToDatabase() first in your app entry point.");
  }
  return dbInstance;
}

// Helper to close connection (useful for graceful shutdown)
async function closeDatabase() {
  if (client) {
    await client.close();
    console.log("MongoDB connection closed.");
  }
}

module.exports = { connectToDatabase, getDb, closeDatabase };