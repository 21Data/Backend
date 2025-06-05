
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { query } = require('../config/db');

// POST /api/messages - Send Message
router.post('/', authenticateToken, async (req, res) => {
    const { recipientId, propertyId, message } = req.body;
    const senderId = req.user.id; // Sender is the authenticated user

    if (!recipientId || !propertyId || !message) {
        return res.status(400).json({ error: 'Recipient ID, Property ID, and message are required.' });
    }

    try {
        // Optional: Verify recipientId and propertyId exist
        const recipientExists = await query('SELECT id FROM users WHERE id = $1', [recipientId]);
        if (recipientExists.rows.length === 0) {
            return res.status(404).json({ error: 'Recipient user not found.' });
        }

        const propertyExists = await query('SELECT id FROM properties WHERE id = $1', [propertyId]);
        if (propertyExists.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found.' });
        }

        const messageInsertQuery = `
            INSERT INTO messages (sender_id, recipient_id, property_id, message, sent_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, sent_at;
        `;
        const newMessage = await query(messageInsertQuery, [senderId, recipientId, propertyId, message]);
        const messageId = newMessage.rows[0].id;
        const timestamp = newMessage.rows[0].sent_at;

        res.status(201).json({ messageId, timestamp: timestamp.toISOString() });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});

// GET /api/messages - Get Messages (filtered by propertyId and participantId)
router.get('/', authenticateToken, async (req, res) => {
    const { propertyId, participantId } = req.query; // participantId is the other user in the conversation
    const currentUserId = req.user.id;

    if (!propertyId || !participantId) {
        return res.status(400).json({ error: 'propertyId and participantId are required query parameters.' });
    }

    try {
        // Ensure both currentUserId and participantId are involved in messages for this property
        const messagesQuery = `
            SELECT id, sender_id, recipient_id, property_id, message, sent_at
            FROM messages
            WHERE property_id = $1
            AND (
                (sender_id = $2 AND recipient_id = $3) OR
                (sender_id = $3 AND recipient_id = $2)
            )
            ORDER BY sent_at ASC;
        `;
        const messagesResult = await query(messagesQuery, [propertyId, currentUserId, participantId]);

        const messages = messagesResult.rows.map(msg => ({
            id: msg.id,
            senderId: msg.sender_id,
            recipientId: msg.recipient_id,
            propertyId: msg.property_id,
            message: msg.message,
            timestamp: msg.sent_at.toISOString()
        }));

        res.status(200).json(messages);

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
});

module.exports = router;