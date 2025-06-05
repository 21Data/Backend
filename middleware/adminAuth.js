const authenticateToken = require('./auth'); // Re-use the base authentication middleware

/**
 * Middleware to check if the authenticated user has an 'admin' role.
 */
const authorizeAdmin = (req, res, next) => {
    // authenticateToken should have already attached req.user
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated.' }); // Should not happen if authenticateToken runs first
    }

    if (req.user.role !== 'admin') { // Assuming 'admin' is a valid role
        return res.status(403).json({ error: 'Access forbidden: Admins only.' });
    }
    next();
};

// Export an array of middlewares to be used in routes
module.exports = [authenticateToken, authorizeAdmin];