
import db from '../config/database.js'; // Assuming your DB connection is set up correctly
import express from 'express';
const router = express.Router();

// FETCH ALL ITEM TYPES
// Function to get all unique item types from the inventory_items table
export const getItemTypes = async (req, res, next) => {
    try {
        // Query to select distinct item types
        const query = `SELECT DISTINCT t.item_type, t.item_name FROM transactions t INNER JOIN batch b ON t.batch_id = b.batch_id WHERE t.item_type IN ('Feeds', 'Chicks', 'Supplements') AND b.is_active = 1`;
        // Execute the query
        const [rows] = await db.execute(query);

        // Send a successful response with the retrieved item types
        res.status(200).json({
            message: 'Item types retrieved successfully',
            result: rows
        });
    } catch (err) {
        console.error('Error retrieving item types:', err);
        res.status(500).json({ message: 'Error retrieving item types' });
    }
};

// PARA FETCH ITEM STOCK DETAILS
export const getItemStockDetails = async (req, res, next) => {
    try {
        // Get the table name, item type, and item name from the request body
        const { table_name, item_type, item_name } = req.body;

        // Form the query with placeholders for item_type and item_name
        const query = `
            SELECT t.* 
            FROM ${table_name} t 
            INNER JOIN batch b ON t.batch_id = b.batch_id 
            WHERE t.item_type = ? AND t.item_name = ? AND b.is_active = 1 
            ORDER BY t.date DESC
        `;

        // Execute the query with item_type and item_name as parameters
        const [rows] = await db.execute(query, [item_type, item_name]);

        // Send a successful response with the retrieved item stock details
        res.status(200).json({
            message: 'Item stock details retrieved successfully',
            result: rows
        });
    } catch (err) {
        console.error('Error retrieving item stock details:', err);
        res.status(500).json({ message: 'Error retrieving item stock details' });
    }
};






export const addFeedsToStock = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id, date, amount_left, amount_consumed, batchId } = req.body;

        // Step 1: Fetch the current record to check the amount_left
        const fetchCurrentRecordQuery = `SELECT amount_left, batch_id, item_type, item_name FROM feeds_inv WHERE id = ?`;
        const [currentRecordRows] = await connection.query(fetchCurrentRecordQuery, [id]);
        const currentRecord = currentRecordRows[0];

        if (!currentRecord) {
            throw new Error('Record not found');
        }

        const currentAmountLeft = currentRecord.amount_left;
        const { batch_id, item_type, item_name } = currentRecord;

        // Step 2: Validate if amount_consumed is greater than amount_left
        const amountConsumedDecimal = parseFloat(amount_consumed); // Convert to decimal
        const amountLeftDecimal = parseFloat(currentAmountLeft);   // Convert to decimal
        console.log("amountConsumedDecimal" , amountConsumedDecimal , "amountLeftDecimal" , amountLeftDecimal);

        if (amountConsumedDecimal > amountLeftDecimal) {
            await connection.rollback();
            return res.status(400).json({ message: 'Error: Amount consumed is bigger than the amount left!' });
        }

        // Step 3: Update the existing record
        const updateQuery = `UPDATE feeds_inv SET amount_left = ?, amount_consumed = ? WHERE id = ?`;
        const updateValues = [amount_left, amount_consumed, id];
        await connection.query(updateQuery, updateValues);

        // Step 4: Fetch the last record for the same batch_id, item_type, and item_name
        const lastRecordQuery = `
            SELECT * FROM feeds_inv 
            WHERE batch_id = ? AND item_type = ? AND item_name = ? 
            ORDER BY id DESC 
            LIMIT 1
        `;
        const [lastRecordRows] = await connection.query(lastRecordQuery, [batch_id, item_type, item_name]);
        const lastRecord = lastRecordRows[0];

        if (lastRecord) {
            const { transaction_id } = lastRecord; // Get the transaction_id from the last record

            // Step 5: Calculate the new amount_left for the new record
            const newAmountLeft = amount_left - amount_consumed;

            // Step 6: Insert a new record with the transaction_id
            const insertQuery = `
                INSERT INTO feeds_inv 
                (batch_id, item_type, item_name, date, amount_left, transaction_id) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const insertValues = [batch_id, item_type, item_name, date, newAmountLeft, transaction_id];
            await connection.query(insertQuery, insertValues);

            await connection.commit();
            res.status(200).json({ message: 'Item updated and new record added successfully' });
        } else {
            await connection.rollback();
            throw new Error('No previous record found for the same batch, item type, and name');
        }
    } catch (error) {
        await connection.rollback();
        console.error('Error updating item or inserting new record:', error);
        res.status(500).json({ message: 'Error updating item or inserting new record', error });
    } finally {
        connection.release();
    }
};




export const addSupplementsToStock = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id, date, amount_left, amount_consumed } = req.body;

        // Step 1: Fetch the current record to check the amount_left
        const fetchCurrentRecordQuery = `SELECT amount_left, batch_id, item_type, item_name FROM supplements_inv WHERE id = ?`;
        const [currentRecordRows] = await connection.query(fetchCurrentRecordQuery, [id]);
        const currentRecord = currentRecordRows[0];

        if (!currentRecord) {
            throw new Error('Record not found');
        }

        const currentAmountLeft = currentRecord.amount_left;
        const { batch_id, item_type, item_name } = currentRecord;

        // Step 2: Validate if amount_consumed is greater than amount_left
        console.log("amount_consumed" , amount_consumed , "currentAmountLeft" , currentAmountLeft);

        if (amount_consumed > currentAmountLeft) {
            await connection.rollback();
            return res.status(400).json({ message: 'Error: Amount consumed is bigger than the amount left' });
        }

        // Step 3: Update the existing record
        const updateQuery = `UPDATE supplements_inv SET amount_left = ?, amount_consumed = ? WHERE id = ?`;
        const updateValues = [amount_left, amount_consumed, id];
        await connection.query(updateQuery, updateValues);

        // Step 4: Fetch the last record for the same batch_id, item_type, and item_name
        const lastRecordQuery = `
            SELECT * FROM supplements_inv 
            WHERE batch_id = ? AND item_type = ? AND item_name = ? 
            ORDER BY id DESC 
            LIMIT 1
        `;
        const [lastRecordRows] = await connection.query(lastRecordQuery, [batch_id, item_type, item_name]);
        const lastRecord = lastRecordRows[0];

        if (lastRecord) {
            const { transaction_id } = lastRecord; // Get the transaction_id from the last record

            // Step 5: Calculate the new amount_left for the new record
            const newAmountLeft = amount_left - amount_consumed;

            // Step 6: Insert a new record with the transaction_id
            const insertQuery = `
                INSERT INTO supplements_inv 
                (batch_id, item_type, item_name, date, amount_left, transaction_id) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const insertValues = [batch_id, item_type, item_name, date, newAmountLeft, transaction_id];
            await connection.query(insertQuery, insertValues);

            await connection.commit();
            res.status(200).json({ message: 'Item updated and new record added successfully' });
        } else {
            await connection.rollback();
            throw new Error('No previous record found for the same batch, item type, and name');
        }
    } catch (error) {
        await connection.rollback();
        console.error('Error updating item or inserting new record:', error);
        res.status(500).json({ message: 'Error updating item or inserting new record', error });
    } finally {
        connection.release();
    }
};





export const addChicksToStock = async (req, res, next) => {
    try {
        const { id, date, item_name, amount_left, ready_to_harvest, undersize, sold, mortality, batch_id, item_type } = req.body;

        // Fetch the last record from chicks_inv with the same batch_id, item_type, and item_name
        const lastRecordQuery = `
            SELECT * FROM chicks_inv 
            WHERE batch_id = ? AND item_type = ? AND item_name = ? 
            ORDER BY id DESC 
            LIMIT 1`;
        const [rows] = await db.query(lastRecordQuery, [batch_id, item_type, item_name]);
        const lastRecord = rows[0];

        // Check if a record was returned
        if (lastRecord) {
            const batchId = lastRecord.batch_id;
            const itemType = lastRecord.item_type;
            const itemName = lastRecord.item_name;
            const amountLeft = lastRecord.amount_left;
            const transactionId = lastRecord.transaction_id; // Get the transaction_id from the last record

            console.log("Last record value", lastRecord);

            // Calculate the new amount_left by subtracting mortality and sold
            const newAmountLeft = amountLeft - mortality - sold;

            console.log("New amount left after subtracting mortality and sold:", newAmountLeft);

            // SQL query to update the record for chicks
            const updateQuery = `
                UPDATE chicks_inv 
                SET amount_left = ?, ready_to_harvest = ?, undersize = ?, sold = ?, mortality = ?, transaction_id = ? 
                WHERE id = ?`;
            const updateValues = [amount_left, ready_to_harvest, undersize, sold, mortality, transactionId, id];

            // Execute the update query for chicks
            await db.query(updateQuery, updateValues);

            // Insert a new record with the calculated newAmountLeft and setting other fields to NULL
            const insertQuery = `
                INSERT INTO chicks_inv 
                (batch_id, item_type, item_name, date, amount_left, ready_to_harvest, undersize, sold, mortality, transaction_id) 
                VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?)
            `;

            // Insert new record with the provided values for chicks
            const insertValues = [
                batchId,
                itemType,
                itemName,
                date,
                newAmountLeft, // Use the new calculated amount left
                transactionId // Use the transaction_id from the last record
            ];

            await db.query(insertQuery, insertValues);

            // Send success response
            res.status(200).json({ message: 'Chick record updated and new record added successfully' });
        } else {
            throw new Error('No previous record found');
        }
    } catch (error) {
        // Handle errors
        console.error('Error updating chick record or inserting new record:', error);
        res.status(500).json({ message: 'Error updating chick record or inserting new record', error });
    }
};



export const deleteInventoryRecord = async (req, res, next) => {
    try {
        const { id } = req.params; // Extract id from URL params
        const { itemType, itemName, batchId } = req.body; // Extract additional data from request body

        let table_name;
        if (itemType === "Feeds") {
            table_name = "feeds_inv";
        } else if (itemType === "Supplements") {
            table_name = "supplements_inv";
        } else if (itemType === "Chicks") {
            table_name = "chicks_inv";
        } else {
            return console.log("Invalid item type!");
        }

        // Fetch the row being deleted
        const fetchDeletedRowQuery = `SELECT amount_left FROM ${table_name} WHERE id = ?`;
        const [deletedRow] = await db.query(fetchDeletedRowQuery, [id]);
        if (!deletedRow.length) {
            return res.status(404).json({ message: 'Row not found with the specified ID' });
        }
        const { amount_left: deletedAmountLeft } = deletedRow[0];

        // Common logic for deleting the row
        const deleteQuery = `DELETE FROM ${table_name} WHERE id = ?`;
        await db.query(deleteQuery, [id]);
        console.log(`Row with id: ${id} deleted successfully.`);

        if (itemType === "Chicks") {
            // Fetch the previous row with the same item_name and batch_id (if applicable)
            const fetchPreviousRowQuery = `
                SELECT id, amount_left, sold, mortality 
                FROM ${table_name} 
                WHERE id < ? AND item_name = ? AND batch_id = ?
                ORDER BY id DESC LIMIT 1
            `;
            const [previousRow] = await db.query(fetchPreviousRowQuery, [id, itemName, batchId]);

            let previousAmountLeft = deletedAmountLeft;

            if (previousRow.length > 0) {
                // If there's a previous row, calculate the updated amount_left based on the previous row
                previousAmountLeft = previousRow[0].amount_left - previousRow[0].sold - previousRow[0].mortality;
            }

            // Fetch all subsequent rows after the deleted row
            const fetchSubsequentRowsQuery = `
                SELECT id, sold, mortality FROM ${table_name} 
                WHERE id > ? AND item_name = ? AND batch_id = ?
                ORDER BY id ASC
            `;
            const [subsequentRows] = await db.query(fetchSubsequentRowsQuery, [id, itemName, batchId]);

            let previousSold = 0;
            let previousMortality = 0;

            if (previousRow.length > 0) {
                previousSold = previousRow[0].sold;
                previousMortality = previousRow[0].mortality;
            }

            // Loop through subsequent rows to recalculate the amount_left
            for (const row of subsequentRows) {
                const newRowAmountLeft = previousAmountLeft - previousSold - previousMortality;

                // Prevent negative amount_left values
                if (newRowAmountLeft < 0) {
                    console.warn(`Skipping update for row with id ${row.id}: calculated amount_left is negative.`);
                    continue;
                }

                console.log(`New amount_left for row with id ${row.id}: ${newRowAmountLeft}`);

                // Update the row with the recalculated amount_left
                const updateRowQuery = `UPDATE ${table_name} SET amount_left = ? WHERE id = ?`;
                await db.query(updateRowQuery, [newRowAmountLeft, row.id]);

                // Update previous values for the next iteration
                previousAmountLeft = newRowAmountLeft;
                previousSold = row.sold;
                previousMortality = row.mortality;
            }

            console.log(`Subsequent rows updated after deleting chick row.`);
        } else {
            // Retain the existing logic for Feeds and Supplements

            // Fetch the next row (row with id > deleted row)
            const fetchNextRowQuery = `SELECT id, amount_left, amount_consumed FROM ${table_name} WHERE id > ? ORDER BY id ASC LIMIT 1`;
            const [nextRow] = await db.query(fetchNextRowQuery, [id]);

            if (!nextRow.length) {
                return res.status(200).json({ message: 'Row deleted, no subsequent rows to update.' });
            }

            const { id: nextRowId, amount_left: nextRowAmountLeft, amount_consumed: nextRowAmountConsumed } = nextRow[0];

            // Update the next row's amount_left to the deleted row's amount_left
            const updateNextRowQuery = `UPDATE ${table_name} SET amount_left = ? WHERE id = ?`;
            await db.query(updateNextRowQuery, [deletedAmountLeft, nextRowId]);
            console.log(`Next row with id: ${nextRowId} updated with new amount_left: ${deletedAmountLeft}`);

            // Fetch all subsequent rows and recalculate their amount_left
            const fetchSubsequentRowsQuery = `
                SELECT id, amount_left, amount_consumed FROM ${table_name} 
                WHERE id > ? ORDER BY id ASC
            `;
            const [subsequentRows] = await db.query(fetchSubsequentRowsQuery, [nextRowId]);

            let previousAmountLeft = deletedAmountLeft;
            let previousAmountConsumed = nextRowAmountConsumed;

            for (const row of subsequentRows) {
                // Calculate new amount_left for this row
                const newRowAmountLeft = previousAmountLeft - previousAmountConsumed;

                // Update this row with the new amount_left
                const updateRowQuery = `UPDATE ${table_name} SET amount_left = ? WHERE id = ?`;
                await db.query(updateRowQuery, [newRowAmountLeft, row.id]);
                console.log(`Row with id: ${row.id} updated with new amount_left: ${newRowAmountLeft}`);

                // Update previousAmountLeft and previousAmountConsumed for the next iteration
                previousAmountLeft = newRowAmountLeft;
                previousAmountConsumed = row.amount_consumed;
            }
        }

        res.status(200).json({ message: 'Row deleted and subsequent rows updated successfully.' });
    } catch (error) {
        console.error('Error deleting row or updating subsequent rows:', error);
        res.status(500).json({ message: 'Error deleting row or updating subsequent rows', error });
    }
};





export const editFeedsStock = async (req, res, next) => {
    try {
        const { id, date, amount_consumed, amount_left } = req.body;

        // Step 1: Fetch the item_type and item_name of the selected row
        const fetchCurrentRowQuery = `SELECT item_type, item_name FROM feeds_inv WHERE id = ?`;
        const [currentRow] = await db.query(fetchCurrentRowQuery, [id]);

        if (!currentRow.length) {
            return res.status(404).json({ message: 'No row found with the specified ID' });
        }

        const { item_type, item_name } = currentRow[0];
        console.log(`Fetched row details: item_type: ${item_type}, item_name: ${item_name}`);

        // Step 2: Update the selected row with the provided values from the frontend
        const updateQuery = `UPDATE feeds_inv SET date = ?, amount_consumed = ?, amount_left = ? WHERE id = ?`;
        await db.query(updateQuery, [date, amount_consumed, amount_left, id]);
        console.log(`Selected row with id: ${id} updated successfully.`);

        // Step 3: Fetch all **previous** rows with the same item_type and item_name
        const fetchPreviousRowsQuery = `
            SELECT id, amount_left, amount_consumed FROM feeds_inv 
            WHERE id < ? AND item_type = ? AND item_name = ? 
            ORDER BY id ASC
        `;
        const [previousRows] = await db.query(fetchPreviousRowsQuery, [id, item_type, item_name]);

        if (previousRows.length > 0) {
            // Get the last row from previous rows to calculate the new amount_left for the current row
            const lastRow = previousRows[previousRows.length - 1];
            console.log(`Fetched last row with id: ${lastRow.id}, amount_left: ${lastRow.amount_left}, amount_consumed: ${lastRow.amount_consumed}`);

            // Calculate the new amount_left for the selected row (current row)
            const newAmountLeft = lastRow.amount_left - lastRow.amount_consumed;
            console.log(`New amount_left for row with id: ${id}: ${newAmountLeft}`);

            // Update the selected row (current row) with the new calculated amount_left
            const updateSelectedRowQuery = `UPDATE feeds_inv SET amount_left = ? WHERE id = ?`;
            await db.query(updateSelectedRowQuery, [newAmountLeft, id]);
            console.log(`Row with id: ${id} updated with new amount_left: ${newAmountLeft}`);
        }

        // Step 4: Fetch all **subsequent** rows with the same item_type and item_name
        const fetchSubsequentRowsQuery = `
            SELECT id, amount_left, amount_consumed FROM feeds_inv 
            WHERE id > ? AND item_type = ? AND item_name = ? 
            ORDER BY id ASC
        `;
        const [subsequentRows] = await db.query(fetchSubsequentRowsQuery, [id, item_type, item_name]);

        console.log(`${subsequentRows.length} subsequent rows found for recalculation.`);

        // Step 5: Adjust the amount_left in all subsequent rows based on the current row's updated amount_left
        let previousAmountLeft = amount_left;  // Start with the updated amount_left of the current row
        let previousAmountConsumed = amount_consumed;  // Start with the updated amount_consumed of the current row

        for (const row of subsequentRows) {
            console.log(`Processing row with id: ${row.id}, current amount_left: ${row.amount_left}, amount_consumed: ${row.amount_consumed}`);

            // Calculate new amount_left based on the previous row's amount_left minus the previous row's amount_consumed
            const newRowAmountLeft = previousAmountLeft - previousAmountConsumed;
            console.log(`New amount_left for row with id ${row.id}: ${newRowAmountLeft}`);

            // Update the current row with the new amount_left
            const updateFollowingRowQuery = `UPDATE feeds_inv SET amount_left = ? WHERE id = ?`;
            await db.query(updateFollowingRowQuery, [newRowAmountLeft, row.id]);
            console.log(`Row with id: ${row.id} updated with new amount_left: ${newRowAmountLeft}`);

            // Update previousAmountLeft and previousAmountConsumed for the next row in the loop
            previousAmountLeft = newRowAmountLeft;
            previousAmountConsumed = row.amount_consumed;  // This row's consumption becomes the previous one in the next iteration
        }

        // Step 6: Respond with success message
        res.status(200).json({ message: 'Selected row updated successfully, and subsequent rows adjusted.' });
    } catch (error) {
        console.error('Error updating the selected row or subsequent rows:', error);
        res.status(500).json({ message: 'Error updating the selected row or subsequent rows', error });
    }
};

export const editSupplementsStock = async (req, res, next) => {
    try {
        const { id, date, amount_left, amount_consumed } = req.body;

        // Step 1: Fetch the item_type and item_name of the selected row
        const fetchCurrentRowQuery = `SELECT item_type, item_name FROM supplements_inv WHERE id = ?`;
        const [currentRow] = await db.query(fetchCurrentRowQuery, [id]);

        if (!currentRow.length) {
            return res.status(404).json({ message: 'No row found with the specified ID' });
        }

        const { item_type, item_name } = currentRow[0];
        console.log(`Fetched row details: item_type: ${item_type}, item_name: ${item_name}`);

        // Step 2: Update the selected row with the provided values from the frontend
        const updateQuery = `UPDATE supplements_inv SET date = ?, amount_left = ?, amount_consumed = ? WHERE id = ?`;
        await db.query(updateQuery, [date, amount_left, amount_consumed, id]);
        console.log(`Selected row with id: ${id} updated successfully.`);

        // Step 3: Fetch all **previous** rows with the same item_type and item_name
        const fetchPreviousRowsQuery = `
            SELECT id, amount_left, amount_consumed FROM supplements_inv 
            WHERE id < ? AND item_type = ? AND item_name = ? 
            ORDER BY id ASC
        `;
        const [previousRows] = await db.query(fetchPreviousRowsQuery, [id, item_type, item_name]);

        if (previousRows.length > 0) {
            // Get the last row from previous rows to calculate the new amount_left for the current row
            const lastRow = previousRows[previousRows.length - 1];
            console.log(`Fetched last row with id: ${lastRow.id}, amount_left: ${lastRow.amount_left}, amount_consumed: ${lastRow.amount_consumed}`);

            // Calculate the new amount_left for the selected row (current row)
            const newAmountLeft = lastRow.amount_left - lastRow.amount_consumed;
            console.log(`New amount_left for row with id: ${id}: ${newAmountLeft}`);

            // Update the selected row (current row) with the new calculated amount_left
            const updateSelectedRowQuery = `UPDATE supplements_inv SET amount_left = ? WHERE id = ?`;
            await db.query(updateSelectedRowQuery, [newAmountLeft, id]);
            console.log(`Row with id: ${id} updated with new amount_left: ${newAmountLeft}`);
        }

        // Step 4: Fetch all **subsequent** rows with the same item_type and item_name
        const fetchSubsequentRowsQuery = `
            SELECT id, amount_left, amount_consumed FROM supplements_inv 
            WHERE id > ? AND item_type = ? AND item_name = ? 
            ORDER BY id ASC
        `;
        const [subsequentRows] = await db.query(fetchSubsequentRowsQuery, [id, item_type, item_name]);

        console.log(`${subsequentRows.length} subsequent rows found for recalculation.`);

        // Step 5: Adjust the amount_left in all subsequent rows based on the current row's updated amount_left
        let previousAmountLeft = amount_left;  // Start with the updated amount_left of the current row
        let previousAmountConsumed = amount_consumed;  // Start with the updated amount_consumed of the current row

        for (const row of subsequentRows) {
            console.log(`Processing row with id: ${row.id}, current amount_left: ${row.amount_left}, amount_consumed: ${row.amount_consumed}`);

            // Calculate new amount_left based on the previous row's amount_left minus the previous row's amount_consumed
            const newRowAmountLeft = previousAmountLeft - previousAmountConsumed;
            console.log(`New amount_left for row with id ${row.id}: ${newRowAmountLeft}`);

            // Update the current row with the new amount_left
            const updateFollowingRowQuery = `UPDATE supplements_inv SET amount_left = ? WHERE id = ?`;
            await db.query(updateFollowingRowQuery, [newRowAmountLeft, row.id]);
            console.log(`Row with id: ${row.id} updated with new amount_left: ${newRowAmountLeft}`);

            // Update previousAmountLeft and previousAmountConsumed for the next row in the loop
            previousAmountLeft = newRowAmountLeft;
            previousAmountConsumed = row.amount_consumed;  // This row's consumption becomes the previous one in the next iteration
        }

        // Step 6: Respond with success message
        res.status(200).json({ message: 'Selected row updated successfully, and subsequent rows adjusted.' });
    } catch (error) {
        console.error('Error updating the selected row or subsequent rows:', error);
        res.status(500).json({ message: 'Error updating the selected row or subsequent rows', error });
    }
};












export const editChicksStock = async (req, res, next) => {
    const connection = await db.getConnection(); // Assuming db provides connection handling
    try {
        await connection.beginTransaction();  // Start transaction

        const { id, date, amount_left, ready_to_harvest, sold, undersize, mortality } = req.body;

        // Fetch the item_type and item_name of the selected row
        const fetchCurrentRowQuery = `SELECT item_type, item_name FROM chicks_inv WHERE id = ?`;
        const [currentRow] = await connection.query(fetchCurrentRowQuery, [id]);

        if (!currentRow.length) {
            await connection.rollback();
            return res.status(404).json({ message: 'No row found with the specified ID' });
        }

        const { item_type, item_name } = currentRow[0];
        console.log(`Fetched row details: item_type: ${item_type}, item_name: ${item_name}`);

        // Update the selected row
        const updateQuery = `
            UPDATE chicks_inv 
            SET date = ?, amount_left = ?, ready_to_harvest = ?, sold = ?, undersize = ?, mortality = ? 
            WHERE id = ?
        `;
        await connection.query(updateQuery, [date, amount_left, ready_to_harvest, sold, undersize, mortality, id]);
        console.log(`Selected row with id: ${id} updated successfully.`);

        // Fetch all previous rows with the same item_type and item_name
        const fetchPreviousRowsQuery = `
            SELECT id, amount_left, sold, mortality FROM chicks_inv 
            WHERE id < ? AND item_type = ? AND item_name = ? 
            ORDER BY id ASC
        `;
        const [previousRows] = await connection.query(fetchPreviousRowsQuery, [id, item_type, item_name]);

        let updatedAmountLeft = amount_left;  // Start with the current amount_left

        if (previousRows.length > 0) {
            // Get the last row from previous rows
            const lastRow = previousRows[previousRows.length - 1];

            // Calculate the new amount_left for the selected row
            updatedAmountLeft = lastRow.amount_left - lastRow.sold - lastRow.mortality;
            console.log(`New amount_left for row with id: ${id}: ${updatedAmountLeft}`);

            // Update the selected row with the new calculated amount_left
            const updateSelectedRowQuery = `UPDATE chicks_inv SET amount_left = ? WHERE id = ?`;
            await connection.query(updateSelectedRowQuery, [updatedAmountLeft, id]);
        }

        // Fetch all subsequent rows
        const fetchSubsequentRowsQuery = `
            SELECT id, sold, mortality FROM chicks_inv 
            WHERE id > ? AND item_type = ? AND item_name = ? 
            ORDER BY id ASC
        `;
        const [subsequentRows] = await connection.query(fetchSubsequentRowsQuery, [id, item_type, item_name]);

        console.log(`${subsequentRows.length} subsequent rows found for recalculation.`);

        let previousAmountLeft = updatedAmountLeft;
        let previousSold = sold;
        let previousMortality = mortality;

        for (const row of subsequentRows) {
            const newRowAmountLeft = previousAmountLeft - previousSold - previousMortality;

            // Prevent negative amount_left values
            if (newRowAmountLeft < 0) {
                console.warn(`Skipping update for row with id ${row.id}: calculated amount_left is negative.`);
                continue;
            }

            console.log(`New amount_left for row with id ${row.id}: ${newRowAmountLeft}`);

            // Update the row with the new amount_left
            const updateFollowingRowQuery = `UPDATE chicks_inv SET amount_left = ? WHERE id = ?`;
            await connection.query(updateFollowingRowQuery, [newRowAmountLeft, row.id]);

            previousAmountLeft = newRowAmountLeft;
            previousSold = row.sold;
            previousMortality = row.mortality;
        }

        await connection.commit();  // Commit transaction
        res.status(200).json({ message: 'Selected row updated successfully, and subsequent rows adjusted.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating the selected row or subsequent rows:', error);
        res.status(500).json({ message: 'Error updating the selected row or subsequent rows', error });
    } finally {
        connection.release();  // Release connection
    }
};


















