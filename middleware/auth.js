const { verifyToken } = require('../utils/jwt');
const { query } = require('../config/db');

/**
 * Middleware to authenticate user via JWT token.
 * Attaches user information to req.user if successful.
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Authentication token required.' });
    }

    try {
        const decoded = verifyToken(token); // Verify the token
        
        // Fetch user from database to ensure user still exists and is active
        const userResult = await query('SELECT id, role, name, email FROM users WHERE id = $1', [decoded.userId]);

        if (userResult.rows.length === 0) {
            return res.status(403).json({ error: 'User not found or token invalid.' });
        }

        req.user = userResult.rows[0]; // Attach user info to the request object
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Authentication token expired.' });
        }
        return res.status(403).json({ error: 'Invalid authentication token.' });
    }
};

module.exports = authenticateToken;