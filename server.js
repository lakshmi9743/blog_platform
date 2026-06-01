const express = require('express');
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser middleware
app.use(express.json());

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

// Wait for database initialization and start the server
const startServer = async () => {
  // Give the database a brief moment to initialize
  let checks = 0;
  while (!db.isReady && checks < 20) {
    await new Promise(resolve => setTimeout(resolve, 100));
    checks++;
  }

  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Premium Blogging Platform Server Started!`);
    console.log(`🌎 Address: http://localhost:${PORT}`);
    console.log(`📁 Database Mode: ${db.isJson ? 'JSON File Fallback (Secure)' : 'SQLite3 (High Performance)'}`);
    console.log(`==================================================`);
  });
};

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
