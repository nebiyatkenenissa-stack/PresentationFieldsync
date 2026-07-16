// routes/audit.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// GET all audit logs (manager only – we'll filter by role in App)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST a new audit log
router.post('/', async (req, res) => {
    try {
        const data = req.body;
        const result = await pool.query(
            `INSERT INTO audit_logs (id, user_id, user_name, action, details, timestamp, ip)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                data.id,
                data.userId,
                data.userName,
                data.action,
                data.details || '',
                data.timestamp || new Date().toISOString(),
                data.ip || '127.0.0.1'
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE all audit logs (manager only)
router.delete('/', async (req, res) => {
    try {
        await pool.query('DELETE FROM audit_logs');
        res.json({ message: 'All audit logs cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;