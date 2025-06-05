// db.js or wherever you configure your database connection

const { Pool } = require('pg');

// Retrieve the DATABASE_URL from environment variables
// Render automatically provides this when you link a PostgreSQL database.
const connectionString = process.env.DATABASE_URL;

// IMPORTANT: For production deployments on Render,
// you must enable SSL for your PostgreSQL connection.
// Render's PostgreSQL databases require SSL connections.
const sslConfig = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set. Please ensure it is configured correctly.');
  process.exit(1); // Exit if DB connection string is missing, as it's critical
}

// Create a new PostgreSQL connection pool
// A pool is recommended for production applications to manage multiple connections efficiently.
const pool = new Pool({
  connectionString: connectionString,
  ssl: sslConfig, // Apply SSL configuration
});

// Listener for successful connections from the pool
pool.on('connect', (client) => {
  console.log('Successfully connected a client from the PostgreSQL pool!');
  // Optional: You could log client details if needed, but keep it concise for production
});

// Listener for errors emitted by idle clients in the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message, err); // Log the full error object for debugging
  // Depending on your error handling strategy, you might choose to exit or try to reconnect.
  // For now, we'll just log the error and let the application continue if possible.
});

// Test the database connection immediately upon application startup
async function testDbConnection() {
  try {
    const client = await pool.connect(); // Attempt to acquire a client from the pool
    await client.query('SELECT 1'); // Execute a simple query to verify connection
    client.release(); // Release the client back to the pool
    console.log('Database connection test successful: Able to connect and query PostgreSQL.');
  } catch (err) {
    console.error('Initial database connection test failed:', err.message, err); // Log the full error for failed test
    // If the initial connection test fails, it's often a critical error.
    // You might want to prevent the server from starting, or implement a retry mechanism.
    // For now, we'll log and let the server attempt to start, but be aware of this.
    process.exit(1); // Exit if the initial connection fails, as the app likely won't function
  }
}

// Call the connection test function
testDbConnection();


// Export the pool so other parts of your application can use it to query the database
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool // You might also export the pool directly for more advanced usage
};
