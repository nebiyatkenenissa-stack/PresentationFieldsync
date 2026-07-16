// routes/alerts.js
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

// GET all alerts (manager only)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM alerts ORDER BY timestamp DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST a new alert
router.post('/', async (req, res) => {
    try {
        const data = req.body;
        const result = await pool.query(
            `INSERT INTO alerts (
                id, title, message, priority, type, timestamp, read,
                target_all, target_employee_id, sent_by, sent_by_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                data.id,
                data.title,
                data.message,
                data.priority || 'medium',
                data.type || 'emergency',
                data.timestamp || new Date().toISOString(),
                data.read || false,
                data.targetAll !== undefined ? data.targetAll : true,
                data.targetEmployeeId || null,
                data.sentBy,
                data.sentByName
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE all alerts (manager only)
router.delete('/', async (req, res) => {
    try {
        await pool.query('DELETE FROM alerts');
        res.json({ message: 'All alerts cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;