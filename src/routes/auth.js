const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/login', (req, res) => {
  res.render('login', { error: null, siteKey: process.env.RECAPTCHA_SITE_KEY });
});

async function verifyCaptcha(token) {
  if (!process.env.RECAPTCHA_SECRET_KEY) return true; // allow local dev without keys configured
  const params = new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET_KEY, response: token || '' });
  const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: params });
  const data = await resp.json();
  return data.success === true;
}

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password, 'g-recaptcha-response': captchaToken } = req.body;

  const captchaOk = await verifyCaptcha(captchaToken);
  if (!captchaOk) {
    return res.status(400).render('login', { error: 'Captcha tidak valid.', siteKey: process.env.RECAPTCHA_SITE_KEY });
  }

  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  const passwordOk = user && (await bcrypt.compare(password || '', user.password_hash));

  if (!passwordOk) {
    return res.status(401).render('login', { error: 'Username atau password salah.', siteKey: process.env.RECAPTCHA_SITE_KEY });
  }

  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
