import express from 'express';
import cors from 'cors';

// Initialize Express app
const app = express();

// Middleware
app.use(cors()); // Enables Cross-Origin Resource Sharing
app.use(express.json()); // Parses incoming JSON requests

// ==========================================
// 1. Health Check / Root Endpoint
// ==========================================
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running successfully!',
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 2. Example GET Endpoint (Fetching data)
// ==========================================
app.get('/api/items', (req, res) => {
  // Example dummy data (replace with database query later)
  const items = [
    { id: 1, name: 'Eco Report A', category: 'Environment' },
    { id: 2, name: 'Sensor Data B', category: 'IoT' }
  ];

  res.status(200).json({
    success: true,
    count: items.length,
    data: items
  });
});

// ==========================================
// 3. Example POST Endpoint (Receiving data)
// ==========================================
app.post('/api/items', (req, res) => {
  const { name, category } = req.body;

  // Basic validation
  if (!name || !category) {
    return res.status(400).json({
      success: false,
      error: 'Please provide both name and category fields.'
    });
  }

  // Simulate saving to a database
  const newItem = {
    id: Date.now(), // Unique dummy ID
    name,
    category,
    createdAt: new Date().toISOString()
  };

  res.status(201).json({
    success: true,
    message: 'Item created successfully!',
    data: newItem
  });
});

// ==========================================
// 4. Global Error Handling Middleware
// ==========================================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });
});

// ==========================================
// 5. Server Export / Listener Logic
// ==========================================
// If running locally, listen on a port. 
// If deploying to Vercel as a serverless function, export the app instead.
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running locally on port ${PORT}`);
  });
}

// Export app for Vercel serverless deployment
export default app;