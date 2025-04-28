import express from 'express';
import { login, forgotPassword, resetPassword } from '../controllers/authController.js'; // Import the new controllers

const router = express.Router();

// Route for login
router.post('/login', login);

// Route for forgot password
router.post('/forgot-password', forgotPassword);

// Route for reset password
router.post('/reset-password', resetPassword);

export default router;