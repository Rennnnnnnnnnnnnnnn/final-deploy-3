import express from 'express';
import {
    addTransaction,
    getTransactions,
    getTransactionById,
    editTransaction,
    deleteTransaction
} from '../controllers/transactionsController.js';

const router = express.Router();

// Route for adding a transaction (POST)
router.post('/add-transaction', addTransaction);

// Route for getting all transactions (GET)
// router.get('/', getTransactions);
router.get('/:batchId', getTransactions);

// Route for getting a single transaction by ID (GET)
router.get('/:id', getTransactionById);

// Route for updating a transaction (PUT)
router.put('/edit-transaction-:id', editTransaction);

// Route for deleting a transaction (DELETE)
router.delete('/:id', deleteTransaction);

export default router;
