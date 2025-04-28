import jwt from 'jsonwebtoken';

const authenticateUser = (req, res, next) => {
    // Get the token from the Authorization header
    const token = req.headers['authorization']?.split(' ')[1];  // 'Bearer token'

    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    try {
        // Verify the token using the secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the decoded user info to the request object
        req.user = decoded;
        next();  // Token is valid, proceed to the next middleware/route
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

export default authenticateUser;