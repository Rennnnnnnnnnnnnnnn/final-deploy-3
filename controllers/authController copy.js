import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import nodemailer from 'nodemailer'; // For sending emails

// Login controller (existing code)
// export const login = async (req, res) => {
//     const { email, password } = req.body;  // Get the email and password from the request body

//     if (!email || !password) {
//         return res.status(400).json({ message: 'Please provide both email and password' });
//     }

//     try {
//         // Query the database to find the user by email
//         const [results] = await db.execute('SELECT * FROM accounts WHERE email = ?', [email]);

//         if (results.length === 0) {
//             return res.status(400).json({ message: 'User not found' });
//         }

//         // Check if the password matches the hashed password in the database
//         const user = results[0];  // Since emails are unique, we expect only one user to be returned
//         const passwordMatch = await bcrypt.compare(password, user.password);

//         if (!passwordMatch) {
//             return res.status(400).json({ message: 'Incorrect password' });
//         }

//         // Generate a JSON Web Token (JWT) for the user
//         const token = jwt.sign(
//             { userId: user.Student_Number, email: user.email },  // Payload
//             process.env.JWT_SECRET,  // Secret key (should be in .env file)
//             { expiresIn: '1h' }  // Token expiry time
//         );

//         // Respond with the token and user details (optional)
//         res.json({ message: 'Login successful', token, user: { name: user.name, email: user.email } });
//     } catch (error) {
//         res.status(500).json({ message: 'Server error', error: error.message });
//     }
// };

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide both email and password' });
    }

    try {
        const [results] = await db.execute('SELECT * FROM accounts WHERE email = ?', [email]);

        if (results.length === 0) {
            return res.status(400).json({ message: 'User not found' });
        }

        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            logger.warn(`Failed login attempt for email: ${email}`);
            return res.status(400).json({ message: 'Incorrect password' });
        }

        const token = jwt.sign(
            { userId: user.Student_Number, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000,
            sameSite: 'strict',
        });

        res.json({ message: 'Login successful', user: { name: user.name, email: user.email } });
    } catch (error) {
        logger.error(`Login error: ${error.message}`);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


// Forgot Password controller
export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Please provide an email address' });
    }

    try {
        // Check if the user exists
        const [results] = await db.execute('SELECT * FROM accounts WHERE email = ?', [email]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = results[0];

        // Generate a reset token
        const resetToken = jwt.sign(
            { userId: user.account_id }, // Use account_id instead of Student_Number
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Save the reset token to the database
        await db.execute('UPDATE accounts SET reset_token = ? WHERE account_id = ?', [resetToken, user.account_id]);

        // Send the reset link via email
        const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset',
            text: `Click the link to reset your password:\n${resetLink}`, 
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return res.status(500).json({ message: 'Error sending email' });
            }
            res.status(200).json({ message: 'Reset link sent to your email' });
        });
    } catch (error) {
        console.error('Error in forgotPassword:', error); // Log the error for debugging
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};




export const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Please provide a token and new password' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find the user by the decoded userId (account_id)
        const [results] = await db.execute('SELECT * FROM accounts WHERE account_id = ?', [decoded.userId]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = results[0];

        // Verify the reset token matches the one in the database
        if (user.reset_token !== token) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password and clear the reset token
        await db.execute('UPDATE accounts SET password = ?, reset_token = NULL WHERE account_id = ?', [hashedPassword, user.account_id]);

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error in resetPassword:', error); // Log the error for debugging
        res.status(400).json({ message: 'Invalid or expired token' });
    }
};