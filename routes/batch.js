import express from 'express';
import { createBatch, closeBatch, getLastActiveBatch,getInactiveBatches, getFeedsInvByBatchId, getSupplementsInvByBatchId } from '../controllers/batchController.js'; // Correcting the import

const router = express.Router();

// Route for creating a batch
router.post('/create-batch', createBatch);

// Route for closing a batch
router.post('/close-batch', closeBatch);

// Route for getting the last active batch
router.get('/last-active', getLastActiveBatch);

router.get('/inactive-batches', getInactiveBatches);

// Route for fetching feeds inventory by batch ID
router.get('/feeds-inv/:batchId', getFeedsInvByBatchId);

// Route for fetching supplements inventory by batch ID
router.get('/supplements-inv/:batchId', getSupplementsInvByBatchId);


export default router;
