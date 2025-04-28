
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';  // Import path for serving static files
import { fileURLToPath } from 'url';  // Required for __dirname with ES modules
import authRoutes from './routes/auth.js';  // Import authentication routes
import logger from './middleware/logger.js';  // Optional logger middleware
import notFound from './middleware/notFound.js';  // Optional 404 middleware
import errorHandler from './middleware/error.js';  // Optional error handler middleware
import accounts from './routes/accounts.js';
import transactions from './routes/transactions.js';
import batch from './routes/batch.js';
import inventory from './routes/inventory.js';

dotenv.config();  // Load environment variables from .env file
const app = express();
const port = process.env.PORT || 8000;

// Helper to get the current directory path (__dirname equivalent in ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());  // Enable CORS
app.use(express.json());  // Parse incoming JSON requests
app.use(express.urlencoded({ extended: true }));

// Middleware
app.use(logger);  // Optional logger

// Serve static files from the "dist" folder
app.use(express.static(path.join(__dirname, 'dist')));

// Routes
app.use('/api/batch', batch);  // Batch routes
app.use('/api/auth', authRoutes);  // Authentication routes
app.use('/api/accounts', accounts);  // Accounts routes
app.use('/api/transactions', transactions);  // Transactions routes
app.use('/api/inventory', inventory);  // Inventory routes

// Handle React routing (return all requests to React app)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use(notFound);  // Handle 404s
app.use(errorHandler);  // Handle other errors

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
