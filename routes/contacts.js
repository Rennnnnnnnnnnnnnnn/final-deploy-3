import express from 'express';
import { 
  saveContact, 
  getContactSuggestions 
} from '../controllers/contactController.js';

const router = express.Router();

// Save a contact name (Buyer/Seller)
router.post('/save-contact', saveContact);

// Fetch contact suggestions (Autocomplete)
router.get('/contact-suggestions', getContactSuggestions);

export default router;