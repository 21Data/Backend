const path = require('path'); // Add this line at the top

// Modify this line:
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Keep your console.log for verification
console.log('dotenv loaded. DB_USER from seed.js:', process.env.DB_USER);
const { query, pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');

async function seedDatabase() {
    try {
        console.log('--- Starting Database Seeding ---');

        // 1. Clear existing data (optional, but good for consistent seeding)
        console.log('Clearing existing data...');
        await query('DELETE FROM admin_verifications;');
        await query('DELETE FROM messages;');
        await query('DELETE FROM property_images;');
        await query('DELETE FROM properties;');
        await query('DELETE FROM users;');
        await query('ALTER SEQUENCE users_id_seq RESTART WITH 1;');
        await query('ALTER SEQUENCE properties_id_seq RESTART WITH 1;');
        await query('ALTER SEQUENCE property_images_id_seq RESTART WITH 1;');
        await query('ALTER SEQUENCE messages_id_seq RESTART WITH 1;');
        await query('ALTER SEQUENCE admin_verifications_id_seq RESTART WITH 1;');
        console.log('Existing data cleared.');

        // 2. Create Users (Landlords and Tenants)
        console.log('Creating users...');
        const users = [];
        const hashedPassword = await bcrypt.hash('password123', 10); // Common password for test users

        // Create an Admin user
        const adminUser = await query(
            `INSERT INTO users (role, name, date_of_birth, email, password_hash, phone, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *;`,
            ['admin', 'Admin User', '1980-01-01', 'admin@myrent.com', hashedPassword, faker.phone.number()]
        );
        users.push(adminUser.rows[0]);
        console.log('Admin user created.');

        // Create Landlords
        const landlords = [];
        for (let i = 0; i < 3; i++) {
            const landlord = await query(
                `INSERT INTO users (role, name, date_of_birth, email, password_hash, phone, address, nin, passport_photo_url, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *;`,
                [
                    'landlord',
                    faker.person.fullName(),
                    faker.date.past({ years: 40 }).toISOString().split('T')[0],
                    faker.internet.email(),
                    hashedPassword,
                    faker.phone.number(),
                    faker.location.streetAddress(true),
                    faker.string.alphanumeric(10),
                    faker.image.urlLoremFlickr({ category: 'people' }) // Placeholder image URL
                ]
            );
            landlords.push(landlord.rows[0]);
            users.push(landlord.rows[0]);
        }
        console.log(`${landlords.length} landlords created.`);

        // Create Tenants
        const tenants = [];
        for (let i = 0; i < 5; i++) {
            const tenant = await query(
                `INSERT INTO users (role, name, date_of_birth, email, password_hash, phone, marital_status, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *;`,
                [
                    'tenant',
                    faker.person.fullName(),
                    faker.date.past({ years: 25 }).toISOString().split('T')[0],
                    faker.internet.email(),
                    hashedPassword,
                    faker.phone.number(),
                    faker.helpers.arrayElement(['Single', 'Married', 'Divorced'])
                ]
            );
            tenants.push(tenant.rows[0]);
            users.push(tenant.rows[0]);
        }
        console.log(`${tenants.length} tenants created.`);

        // 3. Create Properties
        console.log('Creating properties...');
        const properties = [];
        const locations = ['Abuja City Centre', 'Wuse 2', 'Maitama', 'Gwarinpa', 'Kubwa'];
        for (const landlord of landlords) {
            for (let i = 0; i < faker.number.int({ min: 1, max: 3 }); i++) { // Each landlord lists 1-3 properties
                const property = await query(
                    `INSERT INTO properties (landlord_id, title, description, location, price, lease_duration_months, is_occupied, ownership_certificate_token, rent_expiry_date, verified, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *;`,
                    [
                        landlord.id,
                        faker.lorem.words({ min: 2, max: 5 }) + ' Apartment',
                        faker.lorem.paragraph(),
                        faker.helpers.arrayElement(locations),
                        faker.commerce.price({ min: 50000, max: 500000, dec: 0 }),
                        faker.helpers.arrayElement([6, 12, 24]),
                        false, // Initially not occupied
                        faker.string.alphanumeric(20),
                        faker.date.future({ years: 1 }).toISOString().split('T')[0],
                        faker.datatype.boolean() // Randomly verified or not
                    ]
                );
                properties.push(property.rows[0]);

                // Add images for the property
                for (let j = 0; j < faker.number.int({ min: 1, max: 4 }); j++) {
                    await query(
                        'INSERT INTO property_images (property_id, image_url) VALUES ($1, $2);',
                        [property.rows[0].id, faker.image.urlLoremFlickr({ category: 'house' })]
                    );
                }
            }
        }
        console.log(`${properties.length} properties created.`);

        // 4. Create Messages
        console.log('Creating messages...');
        for (let i = 0; i < faker.number.int({ min: 5, max: 15 }); i++) { // Create some random conversations
            const sender = faker.helpers.arrayElement(users);
            const recipient = faker.helpers.arrayElement(users.filter(u => u.id !== sender.id));
            const property = faker.helpers.arrayElement(properties);

            if (sender && recipient && property) {
                await query(
                    'INSERT INTO messages (sender_id, recipient_id, property_id, message, sent_at) VALUES ($1, $2, $3, $4, NOW());',
                    [sender.id, recipient.id, property.id, faker.lorem.sentence()]
                );
            }
        }
        console.log('Messages created.');

        // 5. Create Admin Verifications for some properties
        console.log('Creating admin verifications...');
        const adminUserRecord = users.find(u => u.role === 'admin');
        if (adminUserRecord) {
            for (let i = 0; i < faker.number.int({ min: 0, max: properties.length }); i++) {
                const propertyToVerify = faker.helpers.arrayElement(properties);
                if (propertyToVerify) {
                    await query(
                        'INSERT INTO admin_verifications (property_id, admin_id, verified, verified_at) VALUES ($1, $2, $3, NOW());',
                        [propertyToVerify.id, adminUserRecord.id, faker.datatype.boolean()]
                    );
                }
            }
        }
        console.log('Admin verifications created.');


        console.log('--- Database Seeding Complete! ---');

    } catch (error) {
        console.error('Error during database seeding:', error);
    } finally {
        pool.end(); // Close the database connection pool
    }
}

seedDatabase();
