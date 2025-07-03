import express from 'express';
const router = express.Router();
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { authenticateToken } from './authMiddleware.js';

// ===== Signup =====
router.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).render('pages/signup', { error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2)',
      [email, hashedPassword]
    );

    res.redirect('/');
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).render('pages/signup', { error: 'Signup failed. Try again.' });
  }
});

// ===== Login =====
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.rows[0].id, email: user.rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ===== Protected Dashboard Route =====
router.get('/dashboard', (req, res) => {
  res.render('pages/dashboard');
});


// ===== Company Routes =====
router.post('/company', authenticateToken, async (req, res) => {
  const { name, industry, description, logo_url } = req.body;
  const userId = req.user.userId;

  try {
    const existing = await pool.query('SELECT * FROM companies WHERE user_id = $1', [userId]);

    if (existing.rows.length > 0) {
      const updated = await pool.query(
        'UPDATE companies SET name = $1, industry = $2, description = $3, logo_url = $4 WHERE user_id = $5 RETURNING *',
        [name, industry, description, logo_url, userId]
      );
      return res.json({ message: 'Company updated', company: updated.rows[0] });
    } else {
      const created = await pool.query(
        'INSERT INTO companies (user_id, name, industry, description, logo_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, name, industry, description, logo_url]
      );
      return res.status(201).json({ message: 'Company created', company: created.rows[0] });
    }
  } catch (err) {
    console.error('Company error:', err);
    res.status(500).json({ error: 'Could not save company' });
  }
});

router.get('/company', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies');
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch companies error:', err);
    res.status(500).json({ error: 'Could not fetch companies' });
  }
});

// ===== Tender Routes =====
router.post('/tender', authenticateToken, async (req, res) => {
  const { title, description, deadline, budget } = req.body;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      'INSERT INTO tenders (user_id, title, description, deadline, budget) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, title, description, deadline, budget]
    );
    res.status(201).json({ message: 'Tender created', tender: result.rows[0] });
  } catch (err) {
    console.error('Create tender error:', err);
    res.status(500).json({ error: 'Could not create tender' });
  }
});

router.get('/tender', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenders ORDER BY deadline ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('List tenders error:', err);
    res.status(500).json({ error: 'Could not list tenders' });
  }
});

router.get('/tender/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tenders WHERE user_id = $1 ORDER BY deadline DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('User tenders error:', err);
    res.status(500).json({ error: 'Could not fetch your tenders' });
  }
});

// ===== Application Routes =====
router.post('/application', authenticateToken, async (req, res) => {
  const { tender_id, proposal } = req.body;
  const userId = req.user.userId;

  if (!tender_id || !proposal) {
    return res.status(400).json({ error: 'tender_id and proposal are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO applications (tender_id, user_id, proposal) VALUES ($1, $2, $3) RETURNING *',
      [tender_id, userId, proposal]
    );
    res.status(201).json({ message: 'Application submitted', application: result.rows[0] });
  } catch (err) {
    console.error('Application error:', err);
    res.status(500).json({ error: 'Could not submit application' });
  }
});

router.get('/company/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Company details error:', err);
    res.status(500).json({ error: 'Could not fetch company details' });
  }
});

router.get('/company/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query missing' });

  try {
    const result = await pool.query(
      `SELECT * FROM companies 
       WHERE LOWER(name) LIKE LOWER($1)
         OR LOWER(industry) LIKE LOWER($1)
         OR LOWER(description) LIKE LOWER($1)`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Company search error:', err);
    res.status(500).json({ error: 'Could not search companies' });
  }
});

router.get('/signup', (req, res) => {
  res.render('pages/signup');
});

router.get('/alltenders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenders ORDER BY deadline ASC');
    res.render('pages/tenders', { tenders: result.rows });
  } catch (err) {
    console.error('Tenders fetch error:', err);
    res.status(500).send('Could not load tenders');
  }
});

router.get('/allcompanies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies ORDER BY id DESC');
    res.render('pages/companies', { companies: result.rows });
  } catch (err) {
    console.error('Company list error:', err);
    res.status(500).send('Could not load companies');
  }
});

export default router;
