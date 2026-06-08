require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const axios = require('axios');
const { spawn } = require('child_process');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

// CORS allowlist — only the configured client(s) may call us with credentials.
// `credentials: true` is required so the browser sends the httpOnly auth cookies
// on cross-origin XHRs from the React dev server (5173) to the API (5000).
const CLIENT_URLS = (process.env.CLIENT_URLS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / curl / server-to-server (no Origin header).
    if (!origin) return cb(null, true);
    if (CLIENT_URLS.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS allowlist`));
  },
  credentials: true,
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Shared cookie attributes for the two auth cookies. SameSite=Lax is the right
// default for a same-site cross-port pairing; SameSite=None would be needed
// only if the client lives on a totally different domain (e.g. *.vercel.app
// calling *.fly.dev) — that's a Phase 2b concern.
const ACCESS_TOKEN_TTL_MS  = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cookieOpts = (maxAge) => ({
  httpOnly: true,
  secure:   IS_PROD,
  sameSite: 'lax',
  maxAge,
  path:     '/',
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect((err) => {
  if (err) {
    console.error('Failed to connect to database:', err);
  } else {
    console.log('Connected to PostgreSQL database.');
  }
});

const authenticateToken = (req, res, next) => {
  // Read access token from the httpOnly cookie set by /api/login. Older
  // clients that still send `Authorization: Bearer <jwt>` are accepted as a
  // transitional courtesy and will go away once all sessions roll over.
  const cookieToken = req.cookies && req.cookies.access_token;
  const headerToken = req.header('Authorization');
  const token = cookieToken || (headerToken && headerToken.replace('Bearer ', ''));

  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Token expired, please refresh.' });
    }
    req.user = decoded;
    next();
  });
};



const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  message: { message: "Too many attempts. Try again in 15 minutes." },
  headers: true, // Include rate limit headers in responses
});

// --- Geocoding + district resolution ---------------------------------------
//
// Single helper used at signup AND on address-update. Geocodes the (street,
// city, state, zip) tuple via Nominatim, then spawns districts/find_district.py
// to point-in-polygon match the resulting lat/lon against the state's TIGER
// shapefiles. The street is held in memory only — callers are expected to
// drop it after this returns.
async function resolveDistricts({ street_address, city, state, zip_code }) {
  const formatted = `${street_address}, ${city}, ${state}, ${zip_code}`;
  const geoRes = await axios.get(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formatted)}&format=json`,
    { headers: { 'User-Agent': 'OtP civic-tech bot (https://github.com/akenney87/of-the-people)' } }
  );
  if (!geoRes.data.length) {
    const err = new Error('Address not found.');
    err.status = 404;
    throw err;
  }
  const { lat, lon } = geoRes.data[0];

  const pythonPath = process.env.PYTHON_PATH || 'C:\\Python313\\python.exe';
  const output = await new Promise((resolve, reject) => {
    const proc = spawn(pythonPath, ['districts/find_district.py', lat, lon, state]);
    let out = '', errOut = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { errOut += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`find_district.py exited ${code}: ${errOut}`));
      resolve(out.trim());
    });
  });

  const d = JSON.parse(output);

  // Normalize to the formats we persist on users (and that the rep query
  // expects). cong_district stays 2-char zero-padded ("09"); senate strips
  // leading zeros to match the OpenStates rep loader; house stays as TIGER
  // emits it.
  return {
    lat,
    lon,
    county: d.county,
    cong_district:     d.congressional ? d.congressional.padStart(2, '0') : null,
    state_senate_dist: d.state_senate  ? d.state_senate.replace(/^0+/, '') : null,
    state_house_dist:  d.state_assembly || null,
  };
}


app.post('/api/register', authLimiter, async (req, res) => {
  const { email, password, street_address, city, state, zip_code, votes } = req.body;

  if (!email || !password || !state || !city || !street_address || !zip_code) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (!Array.isArray(votes) || votes.length !== 10) {
    return res.status(400).json({ message: '10 votes with passion weights are required.' });
  }

  // Resolve districts FIRST so we can fail the registration cleanly if the
  // address is bogus. The street_address local stays in this function's
  // scope only; it's never written to the database.
  let districts;
  try {
    districts = await resolveDistricts({ street_address, city, state, zip_code });
  } catch (geoErr) {
    console.error('District resolution failed during registration:', geoErr.message);
    return res.status(geoErr.status || 500).json({
      message: geoErr.status === 404
        ? 'Could not locate that address. Please check the street, city, and ZIP and try again.'
        : 'Error resolving districts for that address.',
    });
  }

  try {
    // Log just the geo result — explicitly not the street address.
    console.log('Registering user:', { email, city, state, zip_code, districts });
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (
         email, password, city, state, zip_code,
         county, cong_district, state_senate_dist, state_house_dist,
         districts_resolved_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id`,
      [
        email, hashedPassword, city, state, zip_code,
        districts.county, districts.cong_district,
        districts.state_senate_dist, districts.state_house_dist,
      ]
    );

    const userId = userResult.rows[0].id;
    console.log('User registered successfully:', userId);

    // Generate and store verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');
    const expiration = new Date(Date.now() + 3600000); // Token expires in 1 hour
    await pool.query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [verificationToken, expiration, userId]
    );

    // Record votes
    const voteQueries = votes.map(({ issue_id, vote, passion_weight }) => {
      return pool.query(
        'INSERT INTO votes (user_id, issue_id, vote, passion_weight) VALUES ($1, $2, $3, $4)',
        [userId, issue_id, vote, passion_weight]
      );
    });

    await Promise.all(voteQueries);
    console.log("Votes recorded successfully for user:", userId);

    // Send verification email (single attempt, with error handling)
    try {
      const verificationUrl = `http://localhost:5173/verify/${verificationToken}`;
      await transporter.sendMail({
        to: email,
        subject: 'Email Verification',
        text: `Please verify your email by clicking on this link: ${verificationUrl}`,
      });
      console.log(`Verification email sent to: ${email}`);
    } catch (emailErr) {
      console.error("Error sending verification email:", emailErr);
      return res.status(500).json({ message: 'User registered, but verification email failed to send. Please contact support.' });
    }

    res.status(201).json({ success: true, userId });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ message: 'Error registering user.' });
  }
});

// Nodemailer setup with logging
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error("Email Transporter Error:", error);
  } else {
    console.log("Email Server is Ready to Send Messages");
  }
});


// User Login Endpoint
app.post('/api/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  try {
    console.log('Login attempt for:', email); // Debug log
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      console.log('User not found:', email); // Debug log
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for:', email); // Debug log
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    // Auth tokens live in httpOnly cookies so they are unreachable from JS
    // (XSS-safe). The browser sends them automatically on same-site requests
    // when axios is configured with withCredentials: true.
    res.cookie('access_token',  accessToken,  cookieOpts(ACCESS_TOKEN_TTL_MS));
    res.cookie('refresh_token', refreshToken, cookieOpts(REFRESH_TOKEN_TTL_MS));

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Login error:', err); // Detailed error log
    res.status(500).json({ message: 'Error logging in.' });
  }
});

app.post('/api/refresh-token', async (req, res) => {
  // Read refresh token from cookie. Body-based refresh is no longer accepted —
  // the client never sees the refresh token anymore.
  const refreshToken = req.cookies && req.cookies.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required.' });
  }

  try {
    const result = await pool.query('SELECT id FROM users WHERE refresh_token = $1', [refreshToken]);
    if (result.rowCount === 0) {
      return res.status(403).json({ message: 'Invalid refresh token.' });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) {
        // Wipe stale cookies so the client stops retrying.
        res.clearCookie('access_token',  { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
        return res.status(403).json({ message: 'Invalid or expired refresh token.' });
      }

      const newAccessToken = jwt.sign(
        { userId: decoded.userId },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      res.cookie('access_token', newAccessToken, cookieOpts(ACCESS_TOKEN_TTL_MS));
      res.json({ success: true });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error refreshing token.' });
  }
});


app.post('/api/logout', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.userId]);
    res.clearCookie('access_token',  { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error logging out.' });
  }
});


//Send verification email
app.post('/api/send-verification-email', authLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log(`Invalid email format: ${email}`);
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    // Check if user exists
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      console.log(`User not found: ${email}`);
      return res.status(404).json({ message: 'User not found.' });
    }

    const userId = result.rows[0].id;
    const verificationToken = crypto.randomBytes(20).toString('hex');
    const expiration = new Date(Date.now() + 3600000); // Token expires in 1 hour

    // Store verification token
    await pool.query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [verificationToken, expiration, userId]
    );

    const verificationUrl = `http://localhost:5173/verify/${verificationToken}`;

    console.log(`Sending verification email to: ${email}`);

    // Send verification email
    await transporter.sendMail({
      to: email,
      subject: 'Email Verification',
      text: `Please verify your email by clicking on this link: ${verificationUrl}`,
    });

    console.log(`Verification email successfully sent to: ${email}`);
    res.json({ message: 'Verification email sent successfully.' });

  } catch (err) {
    console.error("Error sending verification email:", err);
    res.status(500).json({ message: "Error sending verification email." });
  }
});

// Replace this in server.js
app.get('/api/verify/:token', async (req, res) => {
  const { token } = req.params;

  try {
    console.log(`🔍 Received verification request for token: ${token}`);

    const user = await pool.query(
      'SELECT id, is_verified FROM users WHERE verification_token = $1 AND verification_token_expires > NOW()',
      [token]
    );

    if (user.rowCount === 0) {
      console.log("❌ Invalid or expired verification token.");
      return res.status(400).json({ message: "Invalid or expired verification token." });
    }

    const userId = user.rows[0].id;
    const alreadyVerified = user.rows[0].is_verified;

    if (alreadyVerified) {
      console.log(`✅ User ${userId} is already verified.`);
      return res.status(200).json({ message: "Email is already verified. Redirecting to login..." });
    }

    console.log(`🔄 Updating verification status for User ID: ${userId}`);

    await pool.query(
      'UPDATE users SET is_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = $1',
      [userId]
    );

    console.log(`✅ User ID ${userId} successfully verified.`);

    res.status(200).json({ message: "Email verified successfully! Redirecting to login..." });
  } catch (err) {
    console.error("🚨 Error verifying email:", err);
    res.status(500).json({ message: "Error verifying email." });
  }
});



// Forgot Password Endpoint
app.post('/api/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  try {
    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rowCount === 0) return res.status(404).json({ message: 'User not found.' });

    const token = crypto.randomBytes(20).toString('hex');
    const expiration = new Date(Date.now() + 3600000);

    await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3', [token, expiration, email]);

    const resetUrl = `http://localhost:5173/reset-password/${token}`;
    await transporter.sendMail({
      to: email,
      subject: 'Password Reset Request',
      text: `Click the following link to reset your password: ${resetUrl}`,
    });

    res.json({ message: 'Password reset link sent to email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error sending reset email.' });
  }
});

// Reset Password Endpoint
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required.' });

  try {
    const user = await pool.query('SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()', [token]);

    if (user.rowCount === 0) return res.status(400).json({ message: 'Invalid or expired token.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [hashedPassword, user.rows[0].id]);

    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error resetting password.' });
  }
});

// Get user profile
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    // Note: street_address intentionally not selected — we don't store it.
    // Profile shows "City, State ZIP" + the resolved district names instead.
    const user = await pool.query(
      `SELECT id, email, city, state, zip_code, county,
              cong_district, state_senate_dist, state_house_dist, districts_resolved_at
         FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (user.rowCount === 0) return res.status(404).json({ message: 'User not found.' });

    res.json(user.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching user data.' });
  }
});


// Update user profile (Prevent duplicate emails)
app.put('/api/user', authenticateToken, async (req, res) => {
  const { email } = req.body;
  try {
    // Check if the email already exists (excluding the current user)
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.userId]);
    
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ message: 'Email is already in use by another account.' });
    }

    // Update the email if it's unique
    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, req.user.userId]);
    res.json({ message: 'Profile updated successfully.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating profile.' });
  }
});


// Update user address — geocodes once, persists only the resolved districts.
// The street stays in this request handler's memory and is never written to disk.
app.put('/api/user/address', authenticateToken, async (req, res) => {
  const { street_address, city, state, zip_code, password } = req.body;

  if (!street_address || !city || !state || !zip_code || !password) {
    return res.status(400).json({ message: 'Street, city, state, ZIP, and password are required.' });
  }

  try {
    const userRow = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.userId]);
    if (userRow.rowCount === 0) return res.status(404).json({ message: 'User not found.' });
    if (!(await bcrypt.compare(password, userRow.rows[0].password))) {
      return res.status(400).json({ message: 'Incorrect password.' });
    }

    let districts;
    try {
      districts = await resolveDistricts({ street_address, city, state, zip_code });
    } catch (geoErr) {
      return res.status(geoErr.status || 500).json({
        message: geoErr.status === 404
          ? 'Could not locate that address. Please check the street, city, and ZIP and try again.'
          : 'Error resolving districts for that address.',
      });
    }

    await pool.query(
      `UPDATE users
          SET city = $1, state = $2, zip_code = $3,
              county = $4, cong_district = $5,
              state_senate_dist = $6, state_house_dist = $7,
              districts_resolved_at = NOW()
        WHERE id = $8`,
      [
        city, state, zip_code,
        districts.county, districts.cong_district,
        districts.state_senate_dist, districts.state_house_dist,
        req.user.userId,
      ]
    );
    res.json({ message: 'Address updated successfully.' });
  } catch (err) {
    console.error('Error updating address:', err);
    res.status(500).json({ message: 'Error updating address.' });
  }
});


// Update user password
app.put('/api/user/password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.userId]);
    if (user.rowCount === 0) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(oldPassword, user.rows[0].password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect current password.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.userId]);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating password.' });
  }
});

// Note: Congress.gov and OpenStates ingestion now live in the Python CLI
// at districts/update_representatives.py — run that script directly to refresh
// the representatives table. The on-server fetch helpers and the wide-open
// /api/load-* HTTP endpoints they backed were removed in Phase 1 of the plan.

app.get('/api/representatives', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT city, state, county, cong_district, state_senate_dist, state_house_dist
         FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const { city, state, county, cong_district, state_senate_dist, state_house_dist } = userResult.rows[0];

    // If a legacy user pre-dates the Phase 2a.2 migration, their district
    // columns will be NULL. Send them to update their address so we can
    // resolve districts fresh (without re-geocoding the old street).
    if (!state || !cong_district) {
      return res.status(400).json({
        message: 'District data missing. Please update your address in your profile.',
      });
    }

    // Pull every rep that matches any of the user's geographic memberships:
    //   - federal senators (statewide), federal representative (by CD)
    //   - state senator + state house member (by district)
    //   - statewide elected positions (Governor / Lt. Gov / AG / SoS / etc.)
    //   - county-wide officials (county string match, tolerant of "St." vs. "Saint")
    //   - city-wide officials (e.g. mayor, city council)
    //
    // "Assembly Member" stays alongside "State Representative" so any partially
    // migrated DB still returns results.
    const query = `
      SELECT id, name, position, state, county, email, bio, policies, city, photo_url, party,
             office_name, phone, website, election_date, cong_district, state_senate_district, state_assembly_district
      FROM representatives
      WHERE (position = 'U.S. Senator' AND state = $1)
         OR (position = 'U.S. Representative' AND cong_district = $2)
         OR (position = 'State Senator' AND state_senate_district = $3)
         OR (position IN ('State Representative', 'Assembly Member') AND state_assembly_district = $4)
         OR (position IN (
               'Governor', 'Lieutenant Governor', 'Attorney General',
               'Secretary of State', 'State Auditor', 'Chief of Elections', 'Comptroller'
             ) AND state = $1)
         OR (
              (county = $5 OR county = REPLACE($5, 'St.', 'Saint') OR county = REPLACE($5, 'Saint', 'St.'))
              AND state = $1
            )
         OR (city = $6 AND state = $1)`;

    const result = await pool.query(query, [
      state, cong_district, state_senate_dist, state_house_dist, county, city,
    ]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /api/representatives:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});



// Fetch Representative Votes & Calculate Weighted Alignment Score
app.get('/api/representatives/:repId/alignment', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const repId = req.params.repId;

  try {
    const result = await pool.query(
      `SELECT 
          u.issue_id, 
          u.vote AS user_vote, 
          u.passion_weight AS user_passion,
          r.name AS rep_name, 
          rv.vote AS rep_vote, 
          rv.passion_weight AS rep_passion,
          (1 - (ABS(((CASE WHEN u.vote THEN 5 ELSE 0 END) + u.passion_weight) - 
                    ((CASE WHEN rv.vote THEN 5 ELSE 0 END) + rv.passion_weight)) / 10.0)) 
            - (CASE WHEN u.vote <> rv.vote THEN 0.1 ELSE 0 END) AS base_alignment,
          CASE u.passion_weight 
              WHEN 5 THEN 1.5 
              WHEN 4 THEN 1.4 
              WHEN 3 THEN 1.3 
              WHEN 2 THEN 1.2 
              ELSE 1.1 
          END AS weight_multiplier
      FROM votes u
      JOIN representative_votes rv ON rv.issue_id = u.issue_id
      JOIN representatives r ON r.id = rv.rep_id
      WHERE u.user_id = $1 AND rv.rep_id = $2;`,
      [userId, repId]
    );

    if (result.rowCount === 0) {
      return res.json({ message: 'No alignment data available for this representative.' });
    }

    // Compute weighted sum with penalties
    const weightedSum = result.rows.reduce((acc, row) => acc + (parseFloat(row.base_alignment) * parseFloat(row.weight_multiplier)), 0);
    const weightSum = result.rows.reduce((acc, row) => acc + parseFloat(row.weight_multiplier), 0);
    const finalAlignmentScore = weightSum > 0 ? ((weightedSum / weightSum) * 100).toFixed(0) : 0;

    res.json({ representative: result.rows[0].rep_name, alignment_score: `${finalAlignmentScore}%`, details: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching alignment data.' });
  }
});


// Store Representative Votes
app.post('/api/representatives/:repId/vote', authenticateToken, async (req, res) => {
  const repId = req.params.repId;
  const { issue_id, vote, passion_weight } = req.body;

  try {
    await pool.query(
      `INSERT INTO representative_votes (rep_id, issue_id, vote, passion_weight)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (rep_id, issue_id) DO UPDATE
       SET vote = EXCLUDED.vote, passion_weight = EXCLUDED.passion_weight;`,
      [repId, issue_id, vote, passion_weight]
    );

    res.status(200).json({ message: 'Representative vote recorded successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error recording vote.' });
  }
});

// Fetch a single representative by ID
app.get('/api/representatives/:repId', authenticateToken, async (req, res) => {
  const repId = req.params.repId;

  try {
    const result = await pool.query(
      `SELECT id, name, position, email, policies 
       FROM representatives 
       WHERE id = $1`, 
      [repId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Representative not found." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching representative:", err);
    res.status(500).json({ message: "Error fetching representative." });
  }
});

// Removed in Phase 1:
//   GET  /api/civic-info               (Google Civic Information API was sunset April 2025)
//   POST /api/get-districts            (unauthenticated address-to-district lookup;
//                                       use authenticated /api/representatives instead)
//   POST /api/get-representatives      (unauthenticated district-to-reps lookup;
//                                       same — superseded by /api/representatives)
//   POST /api/load-ny-assembly         (NY-only loader; replaced by the
//                                       districts/update_representatives.py CLI)
//   POST /api/load-openstates-reps...  (NY-only loader; same replacement)
//   POST /api/load-ny-county-officials (NY-only loader; same replacement)
//
// All five of those POSTs had no auth and one of them TRUNCATEd a public table.
// Refresh rep data by running:  python districts/update_representatives.py

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Get all issues
app.get('/api/issues', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM issues ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching issues:', err);
    res.status(500).json({ message: 'Error fetching issues.' });
  }
});

// Get user's votes
app.get('/api/user/votes', authenticateToken, async (req, res) => {
  try {
    // First, get the user's votes
    const votesResult = await pool.query(
      'SELECT issue_id, vote, passion_weight, last_updated FROM votes WHERE user_id = $1',
      [req.user.userId]
    );
    
    // Check if we have the last_updated column
    const hasLastUpdated = votesResult.rows.length > 0 && 'last_updated' in votesResult.rows[0];
    
    // If not, we need to add it
    if (!hasLastUpdated) {
      try {
        await pool.query('ALTER TABLE votes ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
        console.log("Added last_updated column to votes table");
      } catch (alterErr) {
        console.error("Error adding last_updated column:", alterErr);
        // Continue anyway, we'll handle missing column in the response
      }
    }
    
    res.json(votesResult.rows);
  } catch (err) {
    console.error('Error fetching user votes:', err);
    res.status(500).json({ message: 'Error fetching your votes.' });
  }
});

// Update a user's vote
app.put('/api/user/votes/:issueId', authenticateToken, async (req, res) => {
  const { issueId } = req.params;
  const { vote, passion_weight } = req.body;
  
  if (vote === undefined || passion_weight === undefined) {
    return res.status(400).json({ message: 'Vote and passion weight are required.' });
  }
  
  if (passion_weight < 1 || passion_weight > 5) {
    return res.status(400).json({ message: 'Passion weight must be between 1 and 5.' });
  }
  
  try {
    // Check if vote exists
    const checkResult = await pool.query(
      'SELECT * FROM votes WHERE user_id = $1 AND issue_id = $2',
      [req.user.userId, issueId]
    );
    
    if (checkResult.rowCount === 0) {
      return res.status(404).json({ message: 'Vote not found.' });
    }
    
    // Check if last_updated column exists
    try {
      // Update the vote with current timestamp
      await pool.query(
        'UPDATE votes SET vote = $1, passion_weight = $2, last_updated = NOW() WHERE user_id = $3 AND issue_id = $4',
        [vote, passion_weight, req.user.userId, issueId]
      );
    } catch (updateErr) {
      // If the last_updated column doesn't exist, try without it
      if (updateErr.code === '42703') { // Column doesn't exist
        await pool.query(
          'UPDATE votes SET vote = $1, passion_weight = $2 WHERE user_id = $3 AND issue_id = $4',
          [vote, passion_weight, req.user.userId, issueId]
        );
      } else {
        throw updateErr;
      }
    }
    
    res.json({ message: 'Vote updated successfully.' });
  } catch (err) {
    console.error('Error updating vote:', err);
    res.status(500).json({ message: 'Error updating vote.' });
  }
});

// Recalculate alignment scores
app.post('/api/user/recalculate-alignment', authenticateToken, async (req, res) => {
  try {
    // Get all representatives for the user's state
    const userResult = await pool.query('SELECT state FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const userState = userResult.rows[0].state;
    
    // Get representatives
    const repsResult = await pool.query(
      'SELECT id FROM representatives WHERE state = $1',
      [userState]
    );
    
    // For each representative, recalculate alignment score
    for (const rep of repsResult.rows) {
      // Get all matching votes between user and representative
      const votesResult = await pool.query(
        `SELECT 
          u.issue_id, 
          u.vote AS user_vote, 
          u.passion_weight AS user_passion,
          rv.vote AS rep_vote, 
          rv.passion_weight AS rep_passion
        FROM votes u
        JOIN representative_votes rv ON rv.issue_id = u.issue_id
        WHERE u.user_id = $1 AND rv.rep_id = $2`,
        [req.user.userId, rep.id]
      );
      
      if (votesResult.rowCount > 0) {
        // Calculate alignment score
        let totalWeight = 0;
        let weightedSum = 0;
        
        for (const voteMatch of votesResult.rows) {
          // Convert boolean to number (5 for yes, 0 for no)
          const userVoteValue = voteMatch.user_vote ? 5 : 0;
          const repVoteValue = voteMatch.rep_vote ? 5 : 0;
          
          // Calculate base alignment (0-1 scale)
          const difference = Math.abs((userVoteValue + voteMatch.user_passion) - 
                                     (repVoteValue + voteMatch.rep_passion));
          let baseAlignment = 1 - (difference / 10.0);
          
          // Penalty for opposite votes
          if (voteMatch.user_vote !== voteMatch.rep_vote) {
            baseAlignment -= 0.1;
          }
          
          // Weight multiplier based on user's passion
          const weightMultiplier = 1 + (voteMatch.user_passion * 0.1);
          
          totalWeight += weightMultiplier;
          weightedSum += baseAlignment * weightMultiplier;
        }
        
        // Calculate final score (0-100 scale)
        const alignmentScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
        
        // Check if alignment_scores table exists
        try {
          // Store or update alignment score
          await pool.query(
            `INSERT INTO alignment_scores (user_id, rep_id, score)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, rep_id) 
             DO UPDATE SET score = $3`,
            [req.user.userId, rep.id, alignmentScore]
          );
        } catch (alignmentErr) {
          console.error('Error updating alignment score:', alignmentErr);
          // Continue with the next representative
        }
      }
    }
    
    res.json({ message: 'Alignment scores recalculated successfully.' });
  } catch (err) {
    console.error('Error recalculating alignment scores:', err);
    res.status(500).json({ message: 'Error recalculating alignment scores.' });
  }
});

// Modify the POST endpoint for creating/updating votes
app.post('/api/user/votes', authenticateToken, async (req, res) => {
  const { issue_id, vote, passion_weight } = req.body;
  
  if (!issue_id || vote === undefined || passion_weight === undefined) {
    return res.status(400).json({ message: 'Issue ID, vote, and passion weight are required.' });
  }
  
  if (passion_weight < 1 || passion_weight > 5) {
    return res.status(400).json({ message: 'Passion weight must be between 1 and 5.' });
  }
  
  try {
    console.log(`Creating/updating vote for user ${req.user.userId}, issue ${issue_id}: vote=${vote}, passion=${passion_weight}`);
    
    // Check if vote already exists
    const checkResult = await pool.query(
      'SELECT * FROM votes WHERE user_id = $1 AND issue_id = $2',
      [req.user.userId, issue_id]
    );
    
    if (checkResult.rowCount > 0) {
      // Vote exists, update it
      await pool.query(
        'UPDATE votes SET vote = $1, passion_weight = $2, last_updated = NOW() WHERE user_id = $3 AND issue_id = $4',
        [vote, passion_weight, req.user.userId, issue_id]
      );
      console.log(`Updated existing vote for issue ${issue_id}`);
    } else {
      // Vote doesn't exist, create it
      await pool.query(
        'INSERT INTO votes (user_id, issue_id, vote, passion_weight, last_updated) VALUES ($1, $2, $3, $4, NOW())',
        [req.user.userId, issue_id, vote, passion_weight]
      );
      console.log(`Created new vote for issue ${issue_id}`);
    }
    
    // Check if the issue exists in the issues table
    const issueCheck = await pool.query('SELECT * FROM issues WHERE id = $1', [issue_id]);
    
    // If the issue doesn't exist in the issues table, add it
    if (issueCheck.rowCount === 0) {
      // Find the issue text from our list
      const issueText = findIssueText(issue_id);
      if (issueText) {
        await pool.query(
          'INSERT INTO issues (id, text) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
          [issue_id, issueText]
        );
        console.log(`Added issue ${issue_id} to issues table`);
      }
    }
    
    res.status(201).json({ message: 'Vote created/updated successfully.' });
  } catch (err) {
    console.error('Error creating/updating vote:', err);
    res.status(500).json({ message: 'Error creating/updating vote.' });
  }
});

// Canonical issues list — single source of truth shared by client + server + cron.
// See OtP/shared/issues.json for the data; do not duplicate the list here.
const issuesList = require('./shared/issues.json');

function findIssueText(issueId) {
  const issue = issuesList.find(i => i.id === parseInt(issueId));
  return issue ? issue.text : null;
}
