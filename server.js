import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.js';  // Import authentication routes
import logger from './middleware/logger.js';  // Optional logger middleware
import notFound from './middleware/notFound.js';  // Optional 404 middleware
import errorHandler from './middleware/error.js';  // Optional error handler middleware
import accounts from './routes/accounts.js';
import transactions from './routes/transactions.js';
import batch from './routes/batch.js';
import inventory from './routes/inventory.js';
import contact from './routes/contacts.js'; // Add this import



dotenv.config();  // Load environment variables from .env file
const app = express();
const port = process.env.PORT || 8000;

app.use(cors());  // Enable CORS
app.use(express.json());  // Parse incoming JSON requests
app.use(express.urlencoded({ extended: true })); 

app.use('/api/batch', batch);  // Transactions routes
app.use('/api/auth', authRoutes);  // Authentication routes
app.use('/api/accounts', accounts);  // Accounts routes
app.use('/api/transactions', transactions);  // Transactions routes
app.use('/api/inventory', inventory); 
app.use('/api/contact', contact); // Add this line (consistent with other routes)

// Middleware
app.use(logger);  // Optional logger
// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});