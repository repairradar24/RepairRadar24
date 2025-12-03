// // config/userDb.js
// const { MongoClient } = require('mongodb');

// const userDbConnections = new Map();

// const CLEANUP_INTERVAL = process.env.DB_CLEANUP_INTERVAL || 5 * 60 * 1000; 
// const CONNECTION_IDLE_LIMIT = process.env.DB_IDLE_LIMIT || 60 * 60 * 1000;

// startCleanupJob();

// async function connectUserDb(dbUrl, jwtToken) {
//   const dbName = "repairData";

//   // 1. CHECK: If exists, update timestamp and return
//   if (userDbConnections.has(jwtToken)) {
//     const cachedData = userDbConnections.get(jwtToken);
    
//     // Refresh the timestamp so it doesn't get deleted soon
//     cachedData.lastAccessed = Date.now(); 
//     userDbConnections.set(jwtToken, cachedData); 
    
//     return cachedData.db;
//   }

//   // 2. CREATE: New connection
//   const client = new MongoClient(dbUrl, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
//   });

//   await client.connect();
//   console.log(`✅ Connected to User DB: ${dbName}`);

//   const db = client.db(dbName);

//   // 3. STORE: Save client, db, and timestamp
//   userDbConnections.set(jwtToken, {
//     client: client, // We save this so we can .close() it later
//     db: db,
//     lastAccessed: Date.now()
//   });

//   console.log("Number of userDbConnections : " + userDbConnections.size);
//   return db;
// }

// function startCleanupJob() {
//   console.log("🔄 Database Cleanup Job Started...");
  
//   setInterval(() => {
//     const now = Date.now();
//     let cleanedCount = 0;

//     console.log(`[Maintenance] Checking ${userDbConnections.size} active connections...`);

//     for (const [token, connectionData] of userDbConnections.entries()) {
//       // Calculate how long since last use
//       const idleTime = now - connectionData.lastAccessed;

//       if (idleTime > CONNECTION_IDLE_LIMIT) {
//         try {
//           // 1. Close the MongoDB Client connection to free DB resources
//           connectionData.client.close();
          
//           // 2. Remove from Map to free Server RAM
//           userDbConnections.delete(token);
          
//           cleanedCount++;
//         } catch (err) {
//           console.error(`Error closing connection for token ending in ...${token.slice(-5)}`, err);
//         }
//       }
//     }

//     if (cleanedCount > 0) {
//       console.log(`♻️  Cleaned up ${cleanedCount} idle database connections.`);
//       console.log(`Current active connections: ${userDbConnections.size}`);
//     }
    
//   }, CLEANUP_INTERVAL);
// }

// function getUserDb(jwtToken) {
//   // console.log("Getting user DB for token:", jwtToken);
//   // console.log("Current connections:", userDbConnections);
//   let connectionData = userDbConnections.get(jwtToken);
//   return connectionData ? connectionData.db : null;
// }

// function disconnectUserDb(jwtToken) {
//   if (userDbConnections.has(jwtToken)) {
//     const db = userDbConnections.get(jwtToken);
//     db.client?.close?.();
//     userDbConnections.delete(jwtToken);
//   }
// }

// module.exports = { connectUserDb, getUserDb, disconnectUserDb, userDbConnections };
