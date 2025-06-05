
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { query } = require('../config/db');

// GET /api/users/me - Get User Profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // req.user is populated by the authenticateToken middleware
        const userId = req.user.id;

        const userResult = await query(
            `SELECT id, role, name, date_of_birth, email, phone, address, nin, marital_status, passport_photo_url
             FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User profile not found.' });
        }

        const userProfile = userResult.rows[0];

        // Format dateOfBirth to YYYY-MM-DD
        if (userProfile.date_of_birth) {
            userProfile.dateOfBirth = new Date(userProfile.date_of_birth).toISOString().split('T')[0];
        }
        // Clean up database field names for API response
        delete userProfile.date_of_birth;
        userProfile.passportPhotoUrl = userProfile.passport_photo_url;
        delete userProfile.passport_photo_url;
        userProfile.maritalStatus = userProfile.marital_status;
        delete userProfile.marital_status;

        res.status(200).json(userProfile);

    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

module.exports = router;