
import db from '../config/database.js'; // Assuming your DB connection is set up correctly
import express from 'express';
const router = express.Router();  // Correcting the router initialization



// Create batch
export const createBatch = async (req, res, next) => {
    const { batchName } = req.body;

    // Validate the request payload
    if (!batchName) {
        console.error('Batch name is required');
        return res.status(400).json({ message: 'Batch name is required' });
    }

    const startDate = new Date();

    console.log('Received request to create batch:', { batchName, startDate });

    try {
        // Execute the database query
        const [result] = await db.execute(
            'INSERT INTO batch (batch_name, start_date, is_active) VALUES (?, ?, ?)',
            [batchName, startDate, true]
        );

        console.log('Batch created successfully:', result);
        res.status(200).json({ batchId: result.insertId });
    } catch (err) {
        console.error('Error creating batch:', err);

        // Check for specific database errors
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return res.status(500).json({ message: 'Batch table does not exist' });
        }

        if (err.code === 'ER_BAD_FIELD_ERROR') {
            return res.status(500).json({ message: 'Invalid column name' });
        }

        // Generic error response
        res.status(500).json({ message: 'Unable to create batch' });
    }
};

// Close batch
export const closeBatch = async (req, res, next) => {
    const { batchId } = req.body;
    const endDate = new Date(); // Batch closes today

    try {
        await db.execute('UPDATE batch SET is_active = false, end_date = ? WHERE batch_id = ?', 
        [endDate, batchId]);  // Update the column name to 'batch_id'
        res.status(200).send('Batch closed');
    } catch (err) {
        console.error('Error closing batch:', err);
        const error = new Error(`Unable to close batch`);
        error.status = 500;
        next(error);  // Pass the error to the next middleware but do not send a response
    }
}



// Fetch the last active batch
export const getLastActiveBatch = async (req, res, next) => {
    try {
        const [batch] = await db.execute('SELECT batch_id, batch_name FROM batch WHERE is_active = true ORDER BY start_date DESC LIMIT 1');
  
        if (batch.length > 0) {
            const { batch_id, batch_name } = batch[0];
            res.status(200).json({ batchId: batch_id, batchName: batch_name });
        } else {
            res.status(404).json({ message: 'No active batch found' });
        }
        
    } catch (err) {
        const error = new Error('Unable to fetch the last active batch');
        error.status = 500;
        next(error); 
    }
};


export const getInactiveBatches = async (req, res, next) => {
    try {
        const [results] = await db.execute(`
            SELECT 
                b.batch_id, 
                b.batch_name, 
                b.start_date, 
                b.end_date, 
                t.transaction_id, 
                t.transaction_date, 
                t.transaction_type, 
                t.contact_name, 
                t.item_type, 
                t.item_name, 
                t.quantity, 
                t.price_per_unit, 
                t.total_cost, 
                ci.id AS chicks_inv_id, 
                ci.item_type AS chicks_item_type, 
                ci.item_name AS chicks_item_name, 
                ci.date AS chicks_date, 
                ci.amount_left, 
                ci.ready_to_harvest, 
                ci.undersize, 
                ci.sold, 
                ci.mortality
            FROM batch b
            LEFT JOIN transactions t ON b.batch_id = t.batch_id
            LEFT JOIN chicks_inv ci ON b.batch_id = ci.batch_id
            WHERE b.is_active = 0
        `);

        // Group results by batch_id
        const groupedResults = results.reduce((acc, item) => {
            const { 
                batch_id, 
                batch_name, 
                start_date, 
                end_date, 
                transaction_id, 
                transaction_date, 
                transaction_type, 
                contact_name, 
                item_type, 
                item_name, 
                quantity, 
                price_per_unit, 
                total_cost, 
                chicks_inv_id, 
                chicks_item_type, 
                chicks_item_name, 
                chicks_date, 
                amount_left, 
                ready_to_harvest, 
                undersize, 
                sold, 
                mortality 
            } = item;

            if (!acc[batch_id]) {
                acc[batch_id] = {
                    batch_id,
                    batch_name,
                    start_date,
                    end_date,
                    transactions: [],
                    chicks_inv: []
                };
            }

            // Add transaction if it exists and is not a duplicate
            if (transaction_id && !acc[batch_id].transactions.some(t => t.transaction_id === transaction_id)) {
                acc[batch_id].transactions.push({
                    transaction_id,
                    transaction_date,
                    transaction_type,
                    contact_name,
                    item_type,
                    item_name,
                    quantity,
                    price_per_unit,
                    total_cost
                });
            }

            // Add chicks inventory data if it exists and is not a duplicate
            if (chicks_inv_id && !acc[batch_id].chicks_inv.some(c => c.id === chicks_inv_id)) {
                acc[batch_id].chicks_inv.push({
                    id: chicks_inv_id,
                    // item_type: chicks_item_type,
                    // item_name: chicks_item_name,
                    // date: chicks_date,
                    // amount_left,
                    // ready_to_harvest,
                    // undersize,
                    // sold,
                    mortality
                });
            }

            return acc;
        }, {});

        // Convert grouped results into an array
        const groupedArray = Object.values(groupedResults);

        res.status(200).json(groupedArray);
    } catch (err) {
        console.error('Error fetching inactive batches:', err);
        const error = new Error('Unable to fetch inactive batches');
        error.status = 500;
        next(error);
    }
};


export const getFeedsInvByBatchId = async (req, res, next) => {
    const { batchId } = req.params;

    try {
        // Query to fetch feeds inventory data for the specified batch
        const [feedsInv] = await db.execute(
            `SELECT id, date, item_name, amount_left, amount_consumed 
             FROM feeds_inv 
             WHERE batch_id = ?`,
            [batchId]
        );

        if (feedsInv.length > 0) {
            res.status(200).json(feedsInv); // Return the fetched data
        } else {
            res.status(404).json({ message: 'No feeds inventory data found for this batch' });
        }
    } catch (err) {
        const error = new Error('Unable to fetch feeds inventory data');
        error.status = 500;
        next(error);
    }
};

export const getSupplementsInvByBatchId = async (req, res, next) => {
    const { batchId } = req.params;

    try {
        // Query to fetch supplements inventory data for the specified batch
        const [supplementsInv] = await db.execute(
            `SELECT date, item_name, amount_left, amount_consumed 
             FROM supplements_inv 
             WHERE batch_id = ?`,
            [batchId]
        );

        if (supplementsInv.length > 0) {
            res.status(200).json(supplementsInv); // Return the fetched data
        } else {
            res.status(404).json({ message: 'No supplements inventory data found for this batch' });
        }
    } catch (err) {
        const error = new Error('Unable to fetch supplements inventory data');
        error.status = 500;
        next(error);
    }
};



























export default router;