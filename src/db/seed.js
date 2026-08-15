require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./pool');

// Data dummy/sintetis untuk keperluan demo & eksperimen skripsi - bukan data pribadi asli.
async function seed() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  const staf = await pool.query(
    `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'staf-akademik')
     ON CONFLICT (username) DO NOTHING RETURNING id`,
    ['staf.andi', passwordHash]
  );

  const dosenUser = await pool.query(
    `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'dosen')
     ON CONFLICT (username) DO NOTHING RETURNING id`,
    ['dosen.budi', passwordHash]
  );
  if (dosenUser.rows[0]) {
    await pool.query(
      `INSERT INTO lecturers (user_id, nidn, full_name) VALUES ($1, $2, $3)
       ON CONFLICT (nidn) DO NOTHING`,
      [dosenUser.rows[0].id, '0001028901', 'Budi Santoso (dummy)']
    );
  }

  const mahasiswaUser = await pool.query(
    `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'mahasiswa')
     ON CONFLICT (username) DO NOTHING RETURNING id`,
    ['mhs.citra', passwordHash]
  );
  if (mahasiswaUser.rows[0]) {
    await pool.query(
      `INSERT INTO students (user_id, nim, full_name, program_studi) VALUES ($1, $2, $3, $4)
       ON CONFLICT (nim) DO NOTHING`,
      [mahasiswaUser.rows[0].id, '2110000001', 'Citra Dewi (dummy)', 'Teknik Informatika']
    );
  }

  const lecturer = await pool.query(`SELECT id FROM lecturers WHERE nidn = '0001028901'`);
  if (lecturer.rows[0]) {
    await pool.query(
      `INSERT INTO courses (code, name, sks, lecturer_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING`,
      ['IF101', 'Pengantar Zero Trust Architecture (dummy)', 3, lecturer.rows[0].id]
    );
  }

  console.log('Seed complete. Login dummy: staf.andi / dosen.budi / mhs.citra, password: ChangeMe123!');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
