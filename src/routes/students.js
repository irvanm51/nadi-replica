const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.get('/students', requireAuth, requireRole('staf-akademik'), async (req, res) => {
  const { rows } = await pool.query('SELECT id, nim, full_name, program_studi FROM students ORDER BY full_name');
  res.render('students/index', { students: rows });
});

router.post('/students', requireAuth, requireRole('staf-akademik'), async (req, res) => {
  const { nim, full_name, program_studi } = req.body;
  await pool.query(
    'INSERT INTO students (nim, full_name, program_studi) VALUES ($1, $2, $3)',
    [nim, full_name, program_studi]
  );
  res.redirect('/students');
});

router.post('/students/:id/delete', requireAuth, requireRole('staf-akademik'), async (req, res) => {
  await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
  res.redirect('/students');
});

module.exports = router;
