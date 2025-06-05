const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { query } = require('../config/db');
const multer = require('multer'); // Import multer

// Configure multer for memory storage
// This stores the file in memory as a Buffer, which is good for immediate processing
// without saving to disk first, especially for cloud uploads.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper function to check if user is landlord (still useful for other landlord-specific routes)
const isLandlord = (req, res, next) => {
    if (req.user.role !== 'landlord') {
        return res.status(403).json({ error: 'Access forbidden: Only landlords can perform this action.' });
    }
    next();
};

// POST /api/properties - Create a Property Listing (Landlord Only)
// This endpoint now expects 'multipart/form-data' for image uploads.
// 'upload.array('images', 10)' means it expects an array of files named 'images', up to 10.
router.post('/', authenticateToken, isLandlord, upload.array('images', 10), async (req, res) => {
    // req.body contains text fields
    const { title, description, location, price, leaseDurationMonths, ownershipCertificateToken } = req.body;
    const landlordId = req.user.id;
    const files = req.files; // req.files contains the uploaded image files (as buffers in memory)

    if (!title || !description || !location || !price || !leaseDurationMonths || !ownershipCertificateToken || !files || files.length === 0) {
        return res.status(400).json({ error: 'Missing required property fields or image files.' });
    }

    // --- IMPORTANT: REAL PRODUCTION IMAGE UPLOAD LOGIC GOES HERE ---
    // In a real application, you would upload `files` (the image buffers)
    // to a cloud storage service like AWS S3, Google Cloud Storage, or Cloudinary.
    // This process would typically return public URLs for each uploaded image.
    // For demonstration, we'll simulate this by creating mock URLs.
    const uploadedImageUrls = files.map((file, index) => {
        // Replace this with actual cloud storage upload logic.
        // You'll need to configure your cloud storage SDK (e.g., aws-sdk for S3, @google-cloud/storage for GCS).
        // Example for a cloud storage service (pseudo-code):
        /*
        const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
        const s3Client = new S3Client({ region: "your-region" }); // e.g., "us-east-1"
        const bucketName = "your-s3-bucket-name";
        const key = `properties/${landlordId}/${Date.now()}-${file.originalname}`; // Unique key for the object

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: file.buffer, // The image buffer from multer
            ContentType: file.mimetype,
            ACL: 'public-read' // Make the object publicly accessible
        });

        try {
            await s3Client.send(command);
            return `https://${bucketName}.s3.your-region.amazonaws.com/${key}`; // Public URL
        } catch (s3Error) {
            console.error("S3 Upload Error:", s3Error);
            throw new Error("Failed to upload image to cloud storage."); // Propagate error
        }
        */

        // Simulation: create a mock URL based on filename and a timestamp
        const mockFilename = `image-${Date.now()}-${index}.${file.originalname.split('.').pop()}`;
        return `https://your-cloud-storage-domain.com/properties/${mockFilename}`;
    });
    // --- END OF IMPORTANT SECTION ---

    try {
        const propertyInsertQuery = `
            INSERT INTO properties (landlord_id, title, description, location, price, lease_duration_months, ownership_certificate_token, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING id;
        `;
        const propertyResult = await query(propertyInsertQuery, [
            landlordId,
            title,
            description,
            location,
            parseFloat(price), // Ensure price is parsed as a number
            parseInt(leaseDurationMonths, 10), // Ensure duration is parsed as an integer
            ownershipCertificateToken
        ]);
        const propertyId = propertyResult.rows[0].id;

        // Insert property images URLs (these are now the mock cloud URLs)
        const imageInsertPromises = uploadedImageUrls.map(imageUrl =>
            query('INSERT INTO property_images (property_id, image_url) VALUES ($1, $2)', [propertyId, imageUrl])
        );
        await Promise.all(imageInsertPromises);

        res.status(201).json({ id: propertyId, message: 'Property listed successfully, pending admin verification.' });

    } catch (error) {
        console.error('Create property error:', error);
        res.status(500).json({ error: 'Failed to create property listing.' });
    }
});

// GET /api/properties - List All Properties (Dynamic based on user role)
// - Landlords see their own properties (all statuses)
// - Tenants see all verified and unoccupied properties
// - Admins see all properties (all statuses)
router.get('/', authenticateToken, async (req, res) => {
    const userRole = req.user.role;
    const userId = req.user.id;

    let queryText = `
        SELECT
            p.id,
            p.title,
            p.description,
            p.location,
            p.price,
            p.lease_duration_months,
            p.is_occupied,
            p.ownership_certificate_token,
            p.rent_expiry_date,
            p.verified,
            ARRAY_AGG(pi.image_url) AS images
        FROM properties p
        LEFT JOIN property_images pi ON p.id = pi.property_id
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (userRole === 'landlord') {
        queryText += ` WHERE p.landlord_id = $${paramIndex++}`;
        queryParams.push(userId);
    } else if (userRole === 'tenant') {
        // Tenants only see verified and unoccupied properties
        queryText += ` WHERE p.verified = TRUE AND p.is_occupied = FALSE`;
    } else if (userRole === 'admin') {
        // Admins see all properties, no additional WHERE clause needed here
    } else {
        // Default for unhandled roles or guests (though authenticateToken should prevent this)
        return res.status(403).json({ error: 'Access forbidden: Invalid user role.' });
    }

    queryText += ` GROUP BY p.id ORDER BY p.created_at DESC;`;

    try {
        const propertiesResult = await query(queryText, queryParams);

        const properties = propertiesResult.rows.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description,
            location: p.location,
            price: parseFloat(p.price), // Convert numeric string to float
            leaseDurationMonths: p.lease_duration_months,
            isOccupied: p.is_occupied,
            ownershipCertificateToken: p.ownership_certificate_token,
            images: p.images.filter(img => img !== null), // Filter out nulls if no images
            rentExpiryDate: p.rent_expiry_date ? new Date(p.rent_expiry_date).toISOString().split('T')[0] : null,
            verified: p.verified
        }));

        res.status(200).json(properties);

    } catch (error) {
        console.error('List properties error:', error);
        res.status(500).json({ error: 'Failed to retrieve properties.' });
    }
});

// PATCH /api/properties/:propertyId/status - Update Property Status (Landlord Only)
router.patch('/:propertyId/status', authenticateToken, isLandlord, async (req, res) => {
    const { propertyId } = req.params;
    const { isOccupied } = req.body;
    const landlordId = req.user.id;

    if (typeof isOccupied !== 'boolean') {
        return res.status(400).json({ error: 'isOccupied must be a boolean.' });
    }

    try {
        // Verify property belongs to the landlord
        const propertyCheck = await query('SELECT landlord_id FROM properties WHERE id = $1', [propertyId]);
        if (propertyCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found.' });
        }
        if (propertyCheck.rows[0].landlord_id !== landlordId) {
            return res.status(403).json({ error: 'Access forbidden: You do not own this property.' });
        }

        await query(
            'UPDATE properties SET is_occupied = $1, updated_at = NOW() WHERE id = $2;',
            [isOccupied, propertyId]
        );

        res.status(200).json({ message: 'Property status updated successfully.' });

    } catch (error) {
        console.error('Update property status error:', error);
        res.status(500).json({ error: 'Failed to update property status.' });
    }
});

// GET /api/properties/search - Search Properties (Tenant Only)
router.get('/search', authenticateToken, async (req, res) => {
    const { minPrice, maxPrice, location, apartmentType } = req.query; // apartmentType is 'leaseDurationMonths' in schema

    // Ensure only tenants can search
    if (req.user.role !== 'tenant') {
        return res.status(403).json({ error: 'Access forbidden: Only tenants can search properties.' });
    }

    let queryText = `
        SELECT p.id, p.title, p.location, p.price, p.is_occupied,
               ARRAY_AGG(pi.image_url) AS images
        FROM properties p
        LEFT JOIN property_images pi ON p.id = pi.property_id
        WHERE p.verified = TRUE AND p.is_occupied = FALSE
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (minPrice) {
        queryText += ` AND p.price >= $${paramIndex++}`;
        queryParams.push(minPrice);
    }
    if (maxPrice) {
        queryText += ` AND p.price <= $${paramIndex++}`;
        queryParams.push(maxPrice);
    }
    if (location) {
        queryText += ` AND p.location ILIKE $${paramIndex++}`; // ILIKE for case-insensitive search
        queryParams.push(`%${location}%`);
    }
    if (apartmentType) { // Mapping 'apartmentType' to 'lease_duration_months' if that's the intention
        // You might need more sophisticated logic here based on what 'apartmentType' means
        // For now, let's assume it maps to lease duration or a specific property type in description
        // If 'apartmentType' refers to a specific value in lease_duration_months
        if (!isNaN(parseInt(apartmentType))) {
            queryText += ` AND p.lease_duration_months = $${paramIndex++}`;
            queryParams.push(parseInt(apartmentType));
        } else {
            // Or if it's a keyword in description
            queryText += ` AND p.description ILIKE $${paramIndex++}`;
            queryParams.push(`%${apartmentType}%`);
        }
    }

    queryText += ` GROUP BY p.id ORDER BY p.created_at DESC;`;

    try {
        const searchResult = await query(queryText, queryParams);

        const properties = searchResult.rows.map(p => ({
            id: p.id,
            title: p.title,
            location: p.location,
            price: parseFloat(p.price),
            images: p.images.filter(img => img !== null),
            isOccupied: p.is_occupied // Should always be false due to WHERE clause
        }));

        res.status(200).json(properties);

    } catch (error) {
        console.error('Search properties error:', error);
        res.status(500).json({ error: 'Failed to search properties.' });
    }
});

// GET /api/properties/:propertyId - Get Property Details
router.get('/:propertyId', authenticateToken, async (req, res) => {
    const { propertyId } = req.params;

    try {
        const propertyResult = await query(
            `SELECT p.id, p.title, p.description, p.location, p.price, p.lease_duration_months,
                    p.is_occupied, p.rent_expiry_date, p.verified,
                    u.id AS owner_id, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
                    ARRAY_AGG(pi.image_url) AS images
             FROM properties p
             JOIN users u ON p.landlord_id = u.id
             LEFT JOIN property_images pi ON p.id = pi.property_id
             WHERE p.id = $1
             GROUP BY p.id, u.id;`,
            [propertyId]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found.' });
        }

        const property = propertyResult.rows[0];

        // Check if the property is verified and not occupied for non-landlord viewers
        // Landlords can view their own unverified/occupied properties
        if (!property.verified || property.is_occupied) {
            if (!req.user || req.user.id !== property.owner_id) {
                return res.status(404).json({ error: 'Property not found or not available.' });
            }
        }

        res.status(200).json({
            id: property.id,
            title: property.title,
            description: property.description,
            location: property.location,
            price: parseFloat(property.price),
            leaseDurationMonths: property.lease_duration_months,
            isOccupied: property.is_occupied,
            rentExpiryDate: property.rent_expiry_date ? new Date(property.rent_expiry_date).toISOString().split('T')[0] : null,
            verified: property.verified,
            owner: {
                id: property.owner_id,
                name: property.owner_name,
                email: property.owner_email,
                phone: property.owner_phone
            },
            images: property.images.filter(img => img !== null)
        });

    } catch (error) {
        console.error('Get property details error:', error);
        res.status(500).json({ error: 'Failed to retrieve property details.' });
    }
});

module.exports = router;
