const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// KRS mahasiswa: lihat & isi mata kuliah yang diambil
router.get('/enrollments', requireAuth, requireRole('mahasiswa'), async (req, res) => {
  const student = await pool.query('SELECT id FROM students WHERE user_id = $1', [req.session.user.id]);
  const studentId = student.rows[0] && student.rows[0].id;

  const enrolled = studentId
    ? await pool.query(
        `SELECT e.id, c.code, c.name FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         WHERE e.student_id = $1`,
        [studentId]
      )
    : { rows: [] };
  const allCourses = await pool.query('SELECT id, code, name FROM courses ORDER BY code');

  res.render('enrollments/index', { enrolled: enrolled.rows, courses: allCourses.rows, hasProfile: !!studentId });
});

router.post('/enrollments', requireAuth, requireRole('mahasiswa'), async (req, res) => {
  const { course_id, semester } = req.body;
  const student = await pool.query('SELECT id FROM students WHERE user_id = $1', [req.session.user.id]);
  const studentId = student.rows[0] && student.rows[0].id;
  if (studentId) {
    await pool.query(
      'INSERT INTO enrollments (student_id, course_id, semester) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [studentId, course_id, semester]
    );
  }
  res.redirect('/enrollments');
});

// Dosen: lihat peserta mata kuliah yang diampu
router.get('/my-courses', requireAuth, requireRole('dosen'), async (req, res) => {
  const lecturer = await pool.query('SELECT id FROM lecturers WHERE user_id = $1', [req.session.user.id]);
  const lecturerId = lecturer.rows[0] && lecturer.rows[0].id;

  const courses = lecturerId
    ? await pool.query('SELECT id, code, name FROM courses WHERE lecturer_id = $1', [lecturerId])
    : { rows: [] };

  const participants = lecturerId
    ? await pool.query(
        `SELECT e.id AS enrollment_id, c.code, s.full_name, s.nim
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         JOIN students s ON s.id = e.student_id
         WHERE c.lecturer_id = $1
         ORDER BY c.code, s.full_name`,
        [lecturerId]
      )
    : { rows: [] };

  res.render('enrollments/my-courses', { courses: courses.rows, participants: participants.rows, hasProfile: !!lecturerId });
});

module.exports = router;
