const express = require('express');
const cors = require('cors');
// 👇 CHANGE: Import from new db config
const { connectToDatabase } = require('./config/db'); 
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Middleware to ensure DB is connected before handling routes
app.use(async (req, res, next) => {
  try {
    // 👇 CHANGE: Use the new unified connection function
    await connectToDatabase();
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

// Only listen if the file is run directly (Localhost)
if (require.main === module) {
  (async () => {
    try {
      await connectToDatabase();
      app.listen(PORT, () => console.log(`🚀 Server running locally on http://localhost:${PORT}`));
    } catch (err) {
      console.error('❌ Failed to connect to DB locally', err);
    }
  })();
}

// Export the app for Vercel
module.exports = app;