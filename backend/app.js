const express = require('express');
const cors = require('cors');
const { connectMainDb, getMainDb } = require('./config/mainDb');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
// You still keep this for local development
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Middleware to ensure DB is connected before handling routes
// This is necessary for Serverless environments (Cold Starts)
app.use(async (req, res, next) => {
  try {
    // Assuming connectMainDb checks if connection is already open
    // so it doesn't reconnect on every request if the container is warm
    await connectMainDb();
    next();
  } catch (error) {
    console.error("DB Connection failed", error);
    res.status(500).json({ error: "Database connection error" });
  }
});

app.use('/api', authRoutes);
app.use('/user', userRoutes);

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend connected successfully!' });
});

// --- THIS IS THE IMPORTANT PART ---

// Only listen if the file is run directly (Localhost)
if (require.main === module) {
  (async () => {
    try {
      await connectMainDb();
      app.listen(PORT, () => console.log(`🚀 Server running locally on http://localhost:${PORT}`));
    } catch (err) {
      console.error('❌ Failed to connect to main DB locally', err);
    }
  })();
}

// Export the app for Vercel
module.exports = app;