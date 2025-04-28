import db from '../config/database.js';
import express from 'express';
const router = express.Router();

// DELETE A TRANSACTION
export const deleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;  
        const query = 'DELETE FROM transactions WHERE transaction_id = ?';
        const [result] = await db.execute(query, [id]);

        if (result.affectedRows === 0) {
            const error = new Error('Transaction not found');
            error.status = 404;
            console.log(error);
            return next(error);
        }
        res.json({ message: 'Transaction deleted successfully' });
    } catch (err) {
        const error = new Error('Unable to delete transaction');
        error.status = 500;
        console.log(error);
        return next(error);
    }
};

// ADD TRANSACTION
export const addTransaction = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        const {
            batchId,
            transactionDate,
            transactionType,
            itemType,
            itemName, // This will be overridden for Sale transactions
            contactName,
            quantity,
            pricePerUnit,
            totalCost
        } = req.body;

        // Check if the batchId exists in the batch table
        const [batch] = await db.execute('SELECT * FROM batch WHERE batch_id = ?', [batchId]);

        if (!batch || batch.length === 0) {
            const error = new Error('Batch ID does not exist.');
            error.status = 400;
            return next(error);
        }

        // If totalCost is not provided by the frontend, calculate it
        const computedTotalCost = totalCost || (quantity * pricePerUnit);

        // Handle Sale Transactions
        if (transactionType === "Sale") {
            // Check if the item type is valid for sales (e.g., Liveweight or Dressed)
            if (itemType !== "Liveweight" && itemType !== "Dressed") {
                const error = new Error('Invalid item type for sale.');
                error.status = 400;
                return next(error);
            }

            // Fetch the item_name of the most recent Chicks transaction for the current batch
            const [chicksTransaction] = await db.execute(
                'SELECT item_name FROM transactions WHERE batch_id = ? AND item_type = "Chicks" ORDER BY transaction_date DESC LIMIT 1',
                [batchId]
            );

            if (!chicksTransaction || chicksTransaction.length === 0) {
                const error = new Error('No Chicks transaction found for the current batch.');
                error.status = 400;
                return next(error);
            }

            // Set the itemName for the Sale transaction
            const saleItemName = chicksTransaction[0].item_name;

            // Insert the transaction into the transactions table
            const transactionQuery = `
                INSERT INTO transactions
                (transaction_date, transaction_type, item_type, item_name, quantity, price_per_unit, total_cost, contact_name, batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const [results] = await db.execute(transactionQuery, [
                transactionDate,
                transactionType,
                itemType,
                saleItemName, // Use the fetched item_name
                quantity,
                pricePerUnit,
                computedTotalCost,
                contactName,
                batchId
            ]);

            // Get the transaction_id from the inserted transaction
            const transactionId = results.insertId;

            // Update the sold column in the most recent row of the chicks_inv table
            const updateSoldQuery = `
                UPDATE chicks_inv
                SET sold = COALESCE(sold, 0) + ?
                WHERE batch_id = ? AND item_name = ?
                ORDER BY date DESC
                LIMIT 1`;

            await db.execute(updateSoldQuery, [quantity, batchId, saleItemName]);

            // Commit the changes
            await connection.commit();

            res.status(201).json({
                message: 'Sale transaction added successfully and inventory updated',
                data: {
                    id: transactionId,
                    transactionDate,
                    transactionType,
                    itemType,
                    quantity,
                    pricePerUnit,
                    totalCost: computedTotalCost,
                    contactName,
                    batchId
                }
            });
        }
        // Handle Expense Transactions
        else if (transactionType === "Expense" && (itemType === "Chicks" || itemType === "Feeds" || itemType === "Supplements")) {
            // Insert the transaction into the transactions table
            const transactionQuery = `
                INSERT INTO transactions
                (transaction_date, transaction_type, item_type, item_name, quantity, price_per_unit, total_cost, contact_name, batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const [results] = await db.execute(transactionQuery, [
                transactionDate,
                transactionType,
                itemType,
                itemName,
                quantity,
                pricePerUnit,
                computedTotalCost,
                contactName,
                batchId
            ]);

            // Get the transaction_id from the inserted transaction
            const transactionId = results.insertId;

            // Prepare the inventory queries
            let checkQuery, updateQuery, inventoryQuery;

            switch (itemType) {
                case 'Chicks':
                    checkQuery = 'SELECT * FROM chicks_inv WHERE item_name = ? AND item_type = ? AND batch_id = ?';
                    updateQuery = 'UPDATE chicks_inv SET amount_left = amount_left + ?, transaction_id = ? WHERE item_name = ? AND item_type = ? AND batch_id = ?';
                    inventoryQuery = 'INSERT INTO chicks_inv(date, item_type, item_name, amount_left, batch_id, transaction_id) VALUES (?, ?, ?, ?, ?, ?)';
                    break;
                case 'Feeds':
                    checkQuery = 'SELECT * FROM feeds_inv WHERE item_name = ? AND item_type = ? AND batch_id = ?';
                    updateQuery = 'UPDATE feeds_inv SET amount_left = amount_left + ?, transaction_id = ? WHERE item_name = ? AND item_type = ? AND batch_id = ?';
                    inventoryQuery = 'INSERT INTO feeds_inv(date, item_type, item_name, amount_left, batch_id, transaction_id) VALUES (?, ?, ?, ?, ?, ?)';
                    break;
                case 'Supplements':
                    checkQuery = 'SELECT * FROM supplements_inv WHERE item_name = ? AND item_type = ? AND batch_id = ?';
                    updateQuery = 'UPDATE supplements_inv SET amount_left = amount_left + ?, transaction_id = ? WHERE item_name = ? AND item_type = ? AND batch_id = ?';
                    inventoryQuery = 'INSERT INTO supplements_inv(date, item_type, item_name, amount_left, batch_id, transaction_id) VALUES (?, ?, ?, ?, ?, ?)';
                    break;
                default:
                    const error = new Error('Invalid item type.');
                    error.status = 400;
                    return next(error);
            }

            // Check if the item already exists in inventory
            const [existingInventory] = await db.execute(checkQuery, [itemName, itemType, batchId]);

            if (existingInventory.length > 0) {
                // The item exists, update the amount_left and transaction_id
                await db.execute(updateQuery, [quantity, transactionId, itemName, itemType, batchId]);
            } else {
                // The item doesn't exist, insert a new record with transaction_id
                await db.execute(inventoryQuery, [transactionDate, itemType, itemName, quantity, batchId, transactionId]);
            }

            // Commit the changes
            await connection.commit();

            res.status(201).json({
                message: 'Transaction added successfully and inventory updated',
                data: {
                    id: transactionId,
                    transactionDate,
                    transactionType,
                    itemType,
                    quantity,
                    pricePerUnit,
                    totalCost: computedTotalCost,
                    contactName,
                    batchId
                }
            });
        } else {
            // Insert the transaction (for non-inventory expenses)
            const transactionQuery = `
                INSERT INTO transactions
                (transaction_date, transaction_type, item_type, item_name, quantity, price_per_unit, total_cost, contact_name, batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const [results] = await db.execute(transactionQuery, [
                transactionDate,
                transactionType,
                itemType,
                itemName,
                quantity,
                pricePerUnit,
                computedTotalCost,
                contactName,
                batchId
            ]);
        
            await connection.commit();
        
            res.status(201).json({
                message: 'Transaction added successfully without adding to inventory',
                data: {
                    id: results.insertId,  // Now 'results' is defined
                    transactionDate,
                    transactionType,
                    itemType,
                    quantity,
                    pricePerUnit,
                    totalCost: computedTotalCost,
                    contactName,
                    batchId
                }
            });
        }

    } catch (err) {
        await connection.rollback();
        console.error('Error details:', err);
        const error = new Error('Unable to insert transaction');
        error.status = 500;
        return next(error);
    } finally {
        connection.release();
    }
};

// GET ALL TRANSACTIONS FOR A SPECIFIC BATCH
export const getTransactions = async (req, res, next) => {
    const { batchId } = req.params;  // Retrieve batchId from the request parameters

    try {
        const [results] = await db.execute(
            `SELECT t.* 
             FROM transactions t
             INNER JOIN batch b ON t.batch_id = b.batch_id
             WHERE t.batch_id = ? AND b.is_active = 1
             ORDER BY t.transaction_date DESC`,
            [batchId]
        );
        res.json(results);  // Send the transactions as a JSON response
    } catch (err) {
        console.log(error);
        const error = new Error('Unable to fetch transactions');
        error.status = 500;
        console.log(error);
        return next(error);
    }
};

// Get a Single Transaction by ID:
export const getTransactionById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute('SELECT * FROM transactions WHERE id = ?', [id]);

        if (result.length === 0) {
            const error = new Error('Transaction not found');
            error.status = 404;
            return next(error);
        }
        res.json(result[0]);
    } catch (err) {
        const error = new Error('Unable to fetch transaction');
        error.status = 500;
        return next(error);
    }
};


// Update a Transaction:
export const editTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;  // Get ID from URL parameters
        const { batchId, transactionDate, transactionType, contactName, itemType, itemName, quantity, pricePerUnit, totalCost, } = req.body;
        // Validate if required fields are provided
        // if (!batchId || !transactionDate || !transactionType || !contactName || !itemType || !itemName || !quantity || !pricePerUnit || !totalCost) {
        //     const error = new Error('All fields are required.');
        //     error.status = 400;
        //     return next(error);
        // }

        // SQL query to update the transaction data
        const query = `UPDATE transactions 
                       SET transaction_date = ?, transaction_Type = ?, contact_name = ?, item_type = ?,  item_name = ?, quantity = ?, price_per_unit = ?, total_cost = ?
                       WHERE transaction_id = ?`;

        const [result] = await db.execute(query, [transactionDate, transactionType, contactName, itemType, itemName, quantity, pricePerUnit, totalCost, id]);

        if (result.affectedRows === 0) {
            const error = new Error('Transaction not found');
            error.status = 404;
            return next(error);
        }

        res.json({ message: 'Transaction updated successfully' });
    } catch (err) {
        console.error("Error:", err)
        const error = new Error('Unable to update transaction');
        error.status = 500;
        return next(error);
    }
};


// // Update a Transaction: EXTRA  SANA TO
// export const editTransaction = async (req, res, next) => {
//     try {
//         const { id } = req.params; // Get ID from URL parameters
//         const { batchId, transactionDate, transactionType, contactName, itemType, itemName, quantity, pricePerUnit, totalCost } = req.body;

//         // Validate if required fields are provided
//         // if (!batchId || !transactionDate || !transactionType || !contactName || !itemType || !itemName || !quantity || !pricePerUnit || !totalCost) {
//         //     const error = new Error('All fields are required.');
//         //     error.status = 400;
//         //     return next(error);
//         // }

//         // SQL query to update the transaction data
//         const updateTransactionQuery = `
//             UPDATE transactions 
//             SET transaction_date = ?, transaction_Type = ?, contact_name = ?, item_type = ?, item_name = ?, quantity = ?, price_per_unit = ?, total_cost = ?
//             WHERE transaction_id = ?`;

//         const [transactionResult] = await db.execute(updateTransactionQuery, [
//             transactionDate, transactionType, contactName, itemType, itemName, quantity, pricePerUnit, totalCost, id
//         ]);

//         if (transactionResult.affectedRows === 0) {
//             const error = new Error('Transaction not found');
//             error.status = 404;
//             return next(error);
//         }

//         // Update the corresponding item-specific table based on itemType
//         let updateItemQuery;
//         let updateItemParams;

//         switch (itemType.toLowerCase()) {
//             case 'chicks':
//                 updateItemQuery = `
//                     UPDATE chicks_inv 
//                     SET item_type = ?, item_name = ?, date = ?, amount_left = ?, ready_to_harvest = ?, undersize = ?, sold = ?, mortality = ?
//                     WHERE transaction_id = ?
//                     LIMIT 1`; // Limit to the first matching row
//                 updateItemParams = [itemType, itemName, transactionDate, quantity, null, null, null, null, id];
//                 break;

//             case 'feeds':
//                 updateItemQuery = `
//                     UPDATE feeds_inv
//                     SET item_type = ?, item_name = ?, date = ?, amount_left = ?, amount_consumed = ?
//                     WHERE transaction_id = ?
//                     LIMIT 1`; // Limit to the first matching row
//                 updateItemParams = [itemType, itemName, transactionDate, quantity, null, id];
//                 break;

//             case 'supplements':
//                 updateItemQuery = `
//                     UPDATE supplements_inv
//                     SET item_type = ?, item_name = ?, date = ?, amount_left = ?, amount_consumed = ?
//                     WHERE transaction_id = ?
//                     LIMIT 1`; // Limit to the first matching row
//                 updateItemParams = [ itemType, itemName, transactionDate, quantity, null, id];
//                 break;

//             default:
//                 const error = new Error('Invalid item type');
//                 error.status = 400;
//                 return next(error);
//         }

//         // Execute the item-specific update query
//         const [itemResult] = await db.execute(updateItemQuery, updateItemParams);

//         if (itemResult.affectedRows === 0) {
//             const error = new Error('Item not found in the corresponding table');
//             error.status = 404;
//             return next(error);
//         }

//         res.json({ message: 'Transaction and corresponding item updated successfully' });
//     } catch (err) {
//         console.error("Error:", err);
//         const error = new Error('Unable to update transaction or item');
//         error.status = 500;
//         return next(error);
//     }
// };

