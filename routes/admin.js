
const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth'); // Array of middlewares [authenticateToken, authorizeAdmin]
const { query } = require('../config/db');

// PATCH /api/admin/properties/:propertyId/verify - Verify Property Listing (Admin Only)
router.patch('/properties/:propertyId/verify', adminAuth, async (req, res) => {
    const { propertyId } = req.params;
    const { verified } = req.body;
    const adminId = req.user.id; // Admin's ID from authenticated token

    if (typeof verified !== 'boolean') {
        return res.status(400).json({ error: 'The "verified" field must be a boolean.' });
    }

    try {
        // Update property verification status
        const updatePropertyResult = await query(
            'UPDATE properties SET verified = $1, updated_at = NOW() WHERE id = $2 RETURNING id;',
            [verified, propertyId]
        );

        if (updatePropertyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found.' });
        }

        // Record the verification action in admin_verifications table
        await query(
            'INSERT INTO admin_verifications (property_id, admin_id, verified, verified_at) VALUES ($1, $2, $3, NOW());',
            [propertyId, adminId, verified]
        );

        res.status(200).json({ message: 'Property verification status updated.' });

    } catch (error) {
        console.error('Verify property error:', error);
        res.status(500).json({ error: 'Failed to update property verification status.' });
    }
});

// GET /api/admin/users - Get All Users (Admin Only)
router.get('/users', adminAuth, async (req, res) => {
    try {
        const usersResult = await query(
            'SELECT id, role, name, date_of_birth, email, phone, address, nin, marital_status, passport_photo_url, created_at, updated_at FROM users;'
        );

        const users = usersResult.rows.map(user => ({
            id: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
            verified: user.verified // Assuming there's a 'verified' column for users as well, though not in schema
        }));

        res.status(200).json(users);

    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Failed to retrieve all users.' });
    }
});

module.exports = router;