require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db/pool');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const studentRoutes = require('./routes/students');
const lecturerRoutes = require('./routes/lecturers');
const courseRoutes = require('./routes/courses');
const enrollmentRoutes = require('./routes/enrollments');
const gradeRoutes = require('./routes/grades');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new pgSession({ pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.get('/healthz', (req, res) => res.status(200).send('ok'));
app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(studentRoutes);
app.use(lecturerRoutes);
app.use(courseRoutes);
app.use(enrollmentRoutes);
app.use(gradeRoutes);

app.use((req, res) => res.status(404).render('error', { message: 'Halaman tidak ditemukan.' }));

const port = process.env.APP_PORT || 3000;
app.listen(port, () => console.log(`nadi-replica listening on port ${port}`));
