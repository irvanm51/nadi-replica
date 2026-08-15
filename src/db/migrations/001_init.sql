CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('staf-akademik', 'dosen', 'mahasiswa')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lecturers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  nidn TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  nim TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  program_studi TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sks INTEGER NOT NULL,
  lecturer_id INTEGER REFERENCES lecturers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  semester TEXT NOT NULL,
  UNIQUE (student_id, course_id, semester)
);

CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER UNIQUE REFERENCES enrollments(id) ON DELETE CASCADE,
  score NUMERIC(5, 2),
  letter_grade TEXT
);

-- express-session store (connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
