
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { generateToken } = require('../utils/jwt');

// POST /api/auth/signup - User Registration
router.post('/signup', async (req, res) => {
    const { role, name, dateOfBirth, email, password, phone, address, nin, maritalStatus, passportPhotoUrl } = req.body;

    // Basic validation
    if (!role || !name || !dateOfBirth || !email || !password || !phone) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (role !== 'tenant' && role !== 'landlord') {
        return res.status(400).json({ error: 'Invalid role specified. Must be "tenant" or "landlord".' });
    }

    try {
        // Check if user already exists
        const userExists = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 10); // Hash the password

        let insertUserQuery = `
            INSERT INTO users (role, name, date_of_birth, email, password_hash, phone, created_at, updated_at`;
        let queryParams = [role, name, dateOfBirth, email, passwordHash, phone];
        let valuesPlaceholder = `VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()`;
        let paramIndex = 7;

        // Add role-specific fields
        if (role === 'landlord') {
            if (!address || !nin || !passportPhotoUrl) {
                return res.status(400).json({ error: 'Landlord registration requires address, NIN, and passportPhotoUrl.' });
            }
            insertUserQuery += `, address, nin, passport_photo_url`;
            valuesPlaceholder += `, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}`;
            queryParams.push(address, nin, passportPhotoUrl);
        } else if (role === 'tenant') {
            if (!maritalStatus) {
                return res.status(400).json({ error: 'Tenant registration requires maritalStatus.' });
            }
            insertUserQuery += `, marital_status`;
            valuesPlaceholder += `, $${paramIndex++}`;
            queryParams.push(maritalStatus);
        }

        insertUserQuery += `) ${valuesPlaceholder}) RETURNING id;`;

        const newUser = await query(insertUserQuery, queryParams);
        const userId = newUser.rows[0].id;

        res.status(201).json({ userId, message: 'User registered successfully. Please verify your email.' });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to register user.' });
    }
});

// POST /api/auth/login - User Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const userResult = await query('SELECT id, role, name, email, password_hash FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Generate JWT token
        const token = generateToken({ userId: user.id, role: user.role });

        res.status(200).json({
            token,
            user: {
                id: user.id,
                role: user.role,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to log in.' });
    }
});

module.exports = router;