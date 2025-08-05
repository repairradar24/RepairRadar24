const express = require('express');
const cors = require('cors');
const { connectMainDb, getMainDb } = require('./config/mainDb');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: '*', // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON
app.use(express.json());

// Sample API route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend connected successfully!' });
});

(async () => {
  try {
    await connectMainDb();
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Failed to connect to main DB', err);
    process.exit(1);
  }
})();

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});