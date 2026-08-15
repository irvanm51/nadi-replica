# Requirements: Replica Web Kampus (NADI)

## Tujuan

Membangun replica website manajemen data kampus yang realistis, dipakai staf kampus untuk
mengelola data akademik. Aplikasi ini menjadi baseline **"sebelum Zero Trust"** untuk eksperimen
skripsi — harus punya login konvensional (username + password + captcha), bukan Zero Trust,
supaya bisa dibandingkan dengan baseline "sesudah" yang diproteksi Teleport (lihat
[03-teleport-sso-plan.md](./03-teleport-sso-plan.md)).

## Arsitektur

- **Monolith**, tidak ada pemisahan BE/FE terpisah. Server-side rendering.
- **Backend**: Node.js + Express.
- **View engine**: EJS (server-rendered HTML, tanpa build step FE terpisah).
- **Database**: PostgreSQL — dibutuhkan karena data relasional (mahasiswa ↔ mata kuliah ↔ nilai)
  dan harus persisten antar restart container.
- **Containerization**: Docker. 2 service di `docker-compose.yml`: `app` (Express) dan `db`
  (postgres:16-alpine), dihubungkan lewat network compose + named volume untuk data Postgres.

Kenapa monolith, bukan microservice/BE-FE terpisah: aplikasi ini merepresentasikan "legacy campus
app" yang jadi target eksperimen, bukan produk jangka panjang — kompleksitas tambahan (API
terpisah, build FE, CORS, dsb) tidak menambah nilai untuk tujuan skripsi dan hanya menambah
attack-surface yang tidak relevan dengan variabel yang diuji (Zero Trust vs non-Zero Trust).

## Autentikasi

- Login: username + password.
  - Password di-hash dengan `bcrypt` (cost factor 12), tidak pernah disimpan plaintext.
- Captcha: Google reCAPTCHA v2 ("I'm not a robot" checkbox), tier gratis.
  - Site key & secret key disimpan di environment variable (`RECAPTCHA_SITE_KEY`,
    `RECAPTCHA_SECRET_KEY`), **tidak hardcode**.
  - Verifikasi captcha di server sebelum cek kredensial.
- Session: `express-session` dengan store Postgres (`connect-pg-simple`) — supaya session
  survive restart container dan konsisten kalau nanti diletakkan di belakang reverse proxy /
  Teleport.
- Rate limiting percobaan login (mis. `express-rate-limit`) untuk mencegah brute force sederhana
  — relevan sebagai pembanding terhadap Zero Trust yang punya MFA/lockout bawaan.

## RBAC (Role-Based Access Control)

Role harus **konsisten dengan role yang sudah didefinisikan di Teleport lab**
(`teleport/skripsi/teleport-lab/roles/`), supaya baseline before/after sebanding:

| Role | Deskripsi | Akses |
|---|---|---|
| `staf-akademik` | Staf tata usaha/akademik | Full CRUD: mahasiswa, dosen, mata kuliah |
| `dosen` | Dosen pengampu | Lihat peserta mata kuliah yang diampu, input nilai |
| `mahasiswa` | Mahasiswa | Lihat/isi KRS sendiri, lihat nilai sendiri |

## Modul Fungsional

1. **Dashboard** — tampilan berbeda sesuai role setelah login.
2. **Manajemen Mahasiswa** (`staf-akademik`): CRUD data mahasiswa (NIM, nama, email, program studi).
3. **Manajemen Dosen** (`staf-akademik`): CRUD data dosen (NIDN, nama, email).
4. **Manajemen Mata Kuliah** (`staf-akademik`): CRUD mata kuliah (kode, nama, SKS, dosen pengampu).
5. **KRS / Enrollment**:
   - `mahasiswa`: pilih/lihat mata kuliah yang diambil semester berjalan.
   - `dosen`: lihat daftar peserta mata kuliah yang diampu.
6. **Nilai**:
   - `dosen`: input/update nilai mahasiswa per mata kuliah yang diampu.
   - `mahasiswa`: lihat nilai sendiri (read-only).

## Skema Data (PostgreSQL)

```
users        (id, username, password_hash, role, created_at)
students     (id, user_id FK, nim, full_name, program_studi)
lecturers    (id, user_id FK, nidn, full_name)
courses      (id, code, name, sks, lecturer_id FK)
enrollments  (id, student_id FK, course_id FK, semester)
grades       (id, enrollment_id FK, score, letter_grade)
```

Data seed wajib **sintetis/dummy** (nama, NIM, NIDN palsu) — tidak boleh ada data pribadi asli,
sesuai kebijakan perlindungan data.

## Konfigurasi & Secrets

Semua nilai sensitif lewat environment variable, dicontohkan di `.env.example` dengan placeholder
kosong:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `SESSION_SECRET`
- `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`
- `APP_PORT`

Tidak ada kredensial atau secret yang hardcode di source code mana pun.

## Docker

- `Dockerfile`: multi-stage build (install deps → copy source → runtime slim `node:20-alpine`),
  jalan sebagai non-root user.
- `docker-compose.yml`: service `app` + `db`, healthcheck di keduanya, named volume
  `pgdata` untuk persistensi, `.env` di-load lewat `env_file`.

## Definition of Done

- [ ] `docker compose up` berhasil menjalankan app + db dari kondisi bersih.
- [ ] Login dengan captcha berfungsi untuk ketiga role, kredensial salah ditolak.
- [ ] Setiap role hanya bisa mengakses modul sesuai tabel RBAC di atas (verifikasi manual per role).
- [ ] Tidak ada secret/kredensial hardcoded di repo (`grep` untuk password/key sebelum commit).
- [ ] Seed data sepenuhnya sintetis.
