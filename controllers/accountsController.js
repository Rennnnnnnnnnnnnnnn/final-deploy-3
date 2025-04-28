import db from '../config/database.js'; // Assuming your DB connection is set up correctly
import express from 'express';
import bcrypt from 'bcryptjs';
const router = express.Router();

export const addAccount = async (req, res) => {
    const { name, email, password, account_type } = req.body; // Get data from the request body

    try {
        // Hash the password before storing it in the database
        const hashedPassword = await bcrypt.hash(password, 10); // Use bcrypt to hash the password

        // Insert the new account into the database
        const [results] = await db.execute(
            'INSERT INTO accounts (name, email, password, account_type) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, account_type || 'User'] // Default account_type to 'User' if not provided
        );

        // Fetch the newly created account to return it in the response
        const [newAccount] = await db.execute(
            'SELECT * FROM accounts WHERE account_id = ?',
            [results.insertId] // Get the ID of the newly inserted account
        );

        res.status(201).json({ success: true, account: newAccount[0] }); // Return the new account
    } catch (error) {
        console.error('Error adding account:', error);
        res.status(500).json({ success: false, error: 'Failed to add account' }); // Handle errors
    }
};


// Get all accounts
export const getAccounts = async (req, res, next) => {
    try {
        const [results] = await db.execute('SELECT * FROM accounts'); // Fetch all accounts
        res.status(200).json({ accounts: results }); // Send the accounts as JSON response
    } catch (err) {
        console.error('Error fetching accounts:', err);
        res.status(500).json({ error: 'Unable to fetch accounts' }); // Handle errors
    }
};

// Get account details by account_id
export const getAccountDetails = async (req, res) => {
    const { account_id } = req.params; // Get account_id from the URL

    if (!account_id) {
        return res.status(400).json({ message: 'Account ID is required' }); // Validate account_id
    }

    try {
        const [results] = await db.execute(
            'SELECT * FROM accounts WHERE account_id = ?',
            [account_id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' }); // Handle case where user is not found
        }

        const user = results[0];
        res.status(200).json({ user }); // Return user details
    } catch (error) {
        console.error('Failed to fetch user details:', error);
        res.status(500).json({ error: 'Failed to fetch user details' }); // Handle errors
    }
};


// Update account details by account_id
export const updateAccount = async (req, res) => {
    const { account_id } = req.params; // Get account_id from the URL
    const { name, email, account_type } = req.body; // Get updated data from the request body

    try {
        const [results] = await db.execute(
            'UPDATE accounts SET name = ?, email = ?, account_type = ? WHERE account_id = ?',
            [name, email, account_type, account_id]
        );

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Account not found' }); // Handle case where account is not found
        }

        // Fetch the updated account to return it in the response
        const [updatedAccount] = await db.execute(
            'SELECT * FROM accounts WHERE account_id = ?',
            [account_id]
        );

        res.status(200).json({ account: updatedAccount[0] }); // Return the updated account
    } catch (error) {
        console.error('Error updating account:', error);
        res.status(500).json({ error: 'Failed to update account' }); // Handle errors
    }
};

// DELETE ACCOUNT
export const deleteAccount = async (req, res) => {
    const { account_id } = req.params; // Get account_id from the URL

    if (!account_id) {
        return res.status(400).json({ message: 'Account ID is required' }); // Validate account_id
    }

    try {
        const [results] = await db.execute(
            'DELETE FROM accounts WHERE account_id = ?',
            [account_id]
        );

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Account not found' }); // Handle case where account is not found
        }

        res.status(200).json({ message: 'Account deleted successfully' }); // Return success message
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account' }); // Handle errors
    }
};


// CHANGE PASSWORD
export const accountChangePassword = async (req, res) => {
    const { account_id } = req.params; // Get account_id from the URL
    const { currentPassword, newPassword } = req.body; // Get current and new password from the request body

    if (!account_id || !currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Account ID, current password, and new password are required' });
    }

    try {
        // Fetch the account from the database
        const [results] = await db.execute(
            'SELECT * FROM accounts WHERE account_id = ?',
            [account_id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const account = results[0];

        // Verify the current password
        const isPasswordValid = await bcrypt.compare(currentPassword, account.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password in the database
        await db.execute(
            'UPDATE accounts SET password = ? WHERE account_id = ?',
            [hashedPassword, account_id]
        );

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};


// Controller to verify the current password// Controller to verify the current password
export const verifyPassword = async (req, res) => {
    const { currentPassword } = req.body;
    const { account_id } = req.params; // Extract account_id from URL params

    console.log("Current password:", currentPassword);
    console.log("Account ID:", account_id);

    if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required' });
    }

    try {
        // Get hashed password from database
        const [results] = await db.execute(
            'SELECT password FROM accounts WHERE account_id = ?',
            [account_id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const hashedPassword = results[0].password;

        // Compare passwords
        const isValid = await bcrypt.compare(currentPassword, hashedPassword);

        res.status(200).json({ isValid });
    } catch (error) {
        console.error('Error verifying password:', error);
        res.status(500).json({ error: 'Failed to verify password' });
    }
};




export default router;