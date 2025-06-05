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
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1); // Exit if DB connection string is missing
}

// Create a new PostgreSQL connection pool
// A pool is recommended for production applications to manage multiple connections efficiently.
const pool = new Pool({
  connectionString: connectionString,
  ssl: sslConfig, // Apply SSL configuration
});

// Optional: Add a connection test to ensure the database is reachable
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database!');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // process.exit(-1); // Depending on your error handling strategy, you might exit or try to reconnect
});

// Export the pool so other parts of your application can use it to query the database
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool // You might also export the pool directly for more advanced usage
};

