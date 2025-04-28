import mysql from 'mysql2';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Log the values to make sure they're being loaded correctly
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);





// Create a database connection pool (using a promise-based approach)
const db = mysql.createPool({
    host: process.env.DB_HOST,          // use env variable for host
    user: process.env.DB_USER,          // use env variable for user
    password: process.env.DB_PASSWORD,  // use env variable for password
    database: process.env.DB_NAME       // use env variable for database name
}).promise();  // Use promise-based queries

// Test the connection (optional, the pool automatically manages connections)
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to MySQL database!');
    connection.release();  // Release the connection back to the pool
});

// Export the db connection to be used in other files
export default db;
