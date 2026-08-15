const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// Dosen: input/update nilai untuk mahasiswa yang diampu
router.post('/grades/:enrollmentId', requireAuth, requireRole('dosen'), async (req, res) => {
  const { score, letter_grade } = req.body;
  const lecturer = await pool.query('SELECT id FROM lecturers WHERE user_id = $1', [req.session.user.id]);
  const lecturerId = lecturer.rows[0] && lecturer.rows[0].id;

  // Pastikan enrollment ini memang milik mata kuliah yang diampu dosen tsb (guard RBAC di level data)
  const owns = await pool.query(
    `SELECT e.id FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.id = $1 AND c.lecturer_id = $2`,
    [req.params.enrollmentId, lecturerId]
  );
  if (owns.rows.length === 0) {
    return res.status(403).render('error', { message: 'Anda tidak mengampu mata kuliah ini.' });
  }

  await pool.query(
    `INSERT INTO grades (enrollment_id, score, letter_grade) VALUES ($1, $2, $3)
     ON CONFLICT (enrollment_id) DO UPDATE SET score = $2, letter_grade = $3`,
    [req.params.enrollmentId, score, letter_grade]
  );
  res.redirect('/my-courses');
});

// Mahasiswa: lihat nilai sendiri (read-only)
router.get('/grades', requireAuth, requireRole('mahasiswa'), async (req, res) => {
  const student = await pool.query('SELECT id FROM students WHERE user_id = $1', [req.session.user.id]);
  const studentId = student.rows[0] && student.rows[0].id;

  const grades = studentId
    ? await pool.query(
        `SELECT c.code, c.name, g.score, g.letter_grade
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         LEFT JOIN grades g ON g.enrollment_id = e.id
         WHERE e.student_id = $1
         ORDER BY c.code`,
        [studentId]
      )
    : { rows: [] };

  res.render('grades/index', { grades: grades.rows });
});

module.exports = router;
