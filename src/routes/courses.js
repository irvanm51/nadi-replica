const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.get('/courses', requireAuth, requireRole('staf-akademik', 'mahasiswa'), async (req, res) => {
  const { rows } = await pool.query(`
    SELECT c.id, c.code, c.name, c.sks, l.full_name AS lecturer_name
    FROM courses c LEFT JOIN lecturers l ON l.id = c.lecturer_id
    ORDER BY c.code
  `);
  const lecturers = await pool.query('SELECT id, full_name FROM lecturers ORDER BY full_name');
  res.render('courses/index', { courses: rows, lecturers: lecturers.rows, role: req.session.user.role });
});

router.post('/courses', requireAuth, requireRole('staf-akademik'), async (req, res) => {
  const { code, name, sks, lecturer_id } = req.body;
  await pool.query(
    'INSERT INTO courses (code, name, sks, lecturer_id) VALUES ($1, $2, $3, $4)',
    [code, name, sks, lecturer_id || null]
  );
  res.redirect('/courses');
});

module.exports = router;
