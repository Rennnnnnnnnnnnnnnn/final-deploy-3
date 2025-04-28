import db from '../config/database.js';
import express from 'express';
const router = express.Router();

// Save a contact name (Buyer/Seller)
export const saveContact = async (req, res, next) => {
  const { name, type } = req.body; // type = 'buyer' or 'seller'

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  try {
    // Check if name already exists to avoid duplicates
    const [existing] = await db.execute(
      'SELECT id FROM contacts WHERE name = ? AND type = ?',
      [name, type]
    );

    if (existing.length > 0) {
      return res.status(200).json({ message: 'Contact already exists' });
    }

    // Insert new contact
    const [result] = await db.execute(
      'INSERT INTO contacts (name, type) VALUES (?, ?)',
      [name, type]
    );

    res.status(200).json({ contactId: result.insertId });
  } catch (err) {
    console.error('Error saving contact:', err);
    const error = new Error('Unable to save contact');
    error.status = 500;
    next(error);
  }
};

// Fetch contact suggestions (Autocomplete)
export const getContactSuggestions = async (req, res, next) => {
    const { query, type } = req.query; // type = 'buyer' or 'seller'
  
    if (!query || !type) {
      return res.status(400).json({ message: 'Query and type are required' });
    }
  
    try {
      const [suggestions] = await db.execute(
        'SELECT id, name, type, created_at FROM contacts WHERE name LIKE ? AND type = ? LIMIT 5',
        [`%${query}%`, type]
      );
  
      // Format dates if needed (optional)
      const formattedSuggestions = suggestions.map(contact => ({
        ...contact,
        created_at: new Date(contact.created_at).toISOString() // Format timestamp
      }));
  
      res.status(200).json(formattedSuggestions);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      const error = new Error('Unable to fetch suggestions');
      error.status = 500;
      next(error);
    }
  };

export default router;