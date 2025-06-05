const { Pool } = require('pg');

// Create a new Pool instance for database connections
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: '1234567890',
    port: process.env.DB_PORT,
});

console.log('--- DB Connection Debug Info ---');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_DATABASE:', process.env.DB_DATABASE);
console.log('DB_PASSWORD length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'undefined'); // Log length instead of actual password for security
console.log('DB_PASSWORD first 5 chars:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.substring(0, 5) : 'undefined'); // Log first few chars
console.log('DB_PASSWORD last 5 chars:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.slice(-5) : 'undefined'); // Log last few chars
console.log('--- End Debug Info ---');
/**
 * Executes a SQL query using the connection pool.
 * @param {string} text - The SQL query string.
 * @param {Array} params - An array of parameters for the query.
 * @returns {Promise<Object>} - The result of the query.
 */
async function query(text, params) {
    try {
        const res = await pool.query(text, params);
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error; // Re-throw the error for handling in the route
    }
}

module.exports = {
    query,
    pool // Export the pool itself if you need direct client access (e.g., for transactions)
};