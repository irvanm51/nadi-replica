const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.get('/lecturers', requireAuth, requireRole('staf-akademik'), async (req, res) => {
  const { rows } = await pool.query('SELECT id, nidn, full_name FROM lecturers ORDER BY full_name');
  res.render('lecturers/index', { lecturers: rows });
});

router.post('/lecturers', requireAuth, requireRole('staf-akademik'), async (req, res) => {
  const { nidn, full_name } = req.body;
  await pool.query('INSERT INTO lecturers (nidn, full_name) VALUES ($1, $2)', [nidn, full_name]);
  res.redirect('/lecturers');
});

module.exports = router;
