require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const axios = require('axios');
const { exec } = require("child_process");
const fs = require("fs");
const rateLimit = require('express-rate-limit');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

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
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET, (err, decoded) => {
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


app.post('/api/register', authLimiter, async (req, res) => {
  const { email, password, street_address, city, state, zip_code, votes } = req.body;

  if (!email || !password || !state || !city || !street_address || !zip_code) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (!Array.isArray(votes) || votes.length !== 10) {
    return res.status(400).json({ message: '10 votes with passion weights are required.' });
  }

  try {
    console.log("Registering user:", { email, street_address, city, state, zip_code });
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      'INSERT INTO users (email, password, street_address, city, state, zip_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [email, hashedPassword, street_address, city, state, zip_code]
    );
    
    const userId = userResult.rows[0].id;
    console.log("User registered successfully:", userId);

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

    console.log('Generated tokens for:', email); // Debug log
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);
    console.log('Stored refresh token for user:', user.id); // Debug log

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err); // Detailed error log
    res.status(500).json({ message: 'Error logging in.' });
  }
});

app.post('/api/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required.' });
  }

  try {
    // Check if Refresh Token exists in DB
    const result = await pool.query('SELECT id FROM users WHERE refresh_token = $1', [refreshToken]);
    if (result.rowCount === 0) {
      return res.status(403).json({ message: 'Invalid refresh token.' });
    }

    // Verify Refresh Token
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid or expired refresh token.' });
      }

      const userId = decoded.userId;

      // Generate a new Access Token
      const newAccessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: '15m' } // New short-lived token
      );

      res.json({ accessToken: newAccessToken });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error refreshing token.' });
  }
});


app.post('/api/logout', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.userId]);
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
    const user = await pool.query(
      'SELECT id, email, street_address, city, state, zip_code FROM users WHERE id = $1',
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

// Fetch federal representatives from Congress.gov API
const fetchFederalRepresentatives = async (state) => {
  try {
    const response = await axios.get(`https://api.congress.gov/v3/member?state=${state}`, {
      headers: { 'X-API-Key': process.env.CONGRESS_API_KEY },
    });
    // Process and return the data as needed
    return response.data.results;
  } catch (error) {
    console.error('Error fetching data from Congress.gov API:', error);
    return [];
  }
};

const fetchOpenStatesRepresentatives = async (state) => {
  try {
    let allReps = [];
    let page = 1;
    let hasMorePages = true;
    const maxRetries = 3; // Retry failed requests up to 3 times
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // Helper function for delay

    while (hasMorePages) {
      let response;
      let attempts = 0;

      while (attempts < maxRetries) {
        try {
          console.log(`🌍 Fetching Open States reps for ${state}, Page ${page}...`);
          
          response = await axios.get(
            `https://v3.openstates.org/people?jurisdiction=${encodeURIComponent(state)}&per_page=50&page=${page}`,
            { headers: { "x-api-key": process.env.OPENSTATES_API_KEY } }
          );

          break; // Exit retry loop if successful
        } catch (error) {
          if (error.response?.status === 429) {
            console.warn(`⏳ Rate limited! Retrying in 10 seconds... (Attempt ${attempts + 1}/${maxRetries})`);
            await delay(10000); // Wait 10 seconds before retrying
          } else {
            console.error("🚨 API Error:", error.response?.data || error.message);
            return []; // Exit early on non-rate-limit errors
          }
        }
        attempts++;
      }

      if (!response) {
        console.error("❌ Failed to fetch Open States data after retries.");
        return allReps;
      }

      const reps = response.data.results;
      allReps = [...allReps, ...reps];

      const maxPage = response.data.pagination?.max_page || 1;
      console.log(`📄 Page ${page} fetched, total reps so far: ${allReps.length}`);

      if (page >= maxPage) {
        hasMorePages = false;
      } else {
        page++;
        await delay(500); // **Added 500ms delay to avoid hitting rate limits**
      }
    }

    console.log(`✅ Found ${allReps.length} total representatives for ${state}`);
    return allReps;
  } catch (error) {
    console.error("🚨 Critical error fetching Open States data:", error.response?.data || error.message);
    return [];
  }
};




app.get('/api/representatives', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT street_address, city, state, zip_code FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const { street_address, city, state, zip_code } = userResult.rows[0];
    console.log('User address:', { street_address, city, state, zip_code });

    if (!street_address || !city || !state || !zip_code) {
      console.log('Missing address fields:', { street_address, city, state, zip_code });
      return res.status(400).json({ message: 'User address incomplete. Please update your profile.' });
    }

    const formattedAddress = `${street_address}, ${city}, ${state}, ${zip_code}`;
    const geoResponse = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formattedAddress)}&format=json`
    );

    if (!geoResponse.data.length) {
      return res.status(404).json({ message: 'Address not found.' });
    }

    const { lat, lon } = geoResponse.data[0];
    console.log(`📍 Found coordinates: ${lat}, ${lon}`);

    // Use spawn() with the explicitly defined Python path
    const pythonPath = "C:\\Python313\\python.exe"; // Set the correct Python path
    const pythonProcess = spawn(pythonPath, ["districts/find_district.py", lat, lon]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        console.error(`🚨 Python script exited with code ${code}: ${errorOutput}`);
        return res.status(500).json({ message: "Error determining districts." });
      }

      try {
        const districtData = JSON.parse(output.trim());
        console.log("🏛️ Districts:", districtData);

        // Update user's county in the database if it was found
        if (districtData.county) {
          await pool.query(
            'UPDATE users SET county = $1 WHERE id = $2',
            [districtData.county, req.user.userId]
          );
        }

        // Format districts to match DB
        const congressional = districtData.congressional ? districtData.congressional.padStart(2, '0') : null; // "21"
        const stateSenate = districtData.state_senate ? districtData.state_senate.replace(/^0+/, '') : null; // "045" → "45"
        const stateAssembly = districtData.state_assembly; // "116"
        const county = districtData.county;

        console.log('Query districts:', { congressional, stateSenate, stateAssembly, county });

        // Query to get representatives including county officials
        const query = `
          SELECT id, name, position, state, county, email, bio, policies, city, photo_url, party,
                 office_name, phone, website, election_date, cong_district, state_senate_district, state_assembly_district
          FROM representatives
          WHERE (position = 'U.S. Senator' AND state = $1)
             OR (position = 'U.S. Representative' AND cong_district = $2)
             OR (position = 'State Senator' AND state_senate_district = $3)
             OR (position = 'Assembly Member' AND state_assembly_district = $4)
             OR (position IN ('Governor', 'Chief of Elections', 'Attorney General', 'Comptroller') AND state = $1)
             OR (
                  (county = $5 OR county = REPLACE($5, 'St.', 'Saint') OR county = REPLACE($5, 'Saint', 'St.'))
                  AND state = $1
                )`;
        
        const values = [state, congressional, stateSenate, stateAssembly, county];
        console.log('Querying representatives with:', { 
          state, 
          congressional, 
          stateSenate, 
          stateAssembly, 
          county,
          query 
        });
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
          console.log(`No representatives found for county: ${county}`);
        } else {
          console.log(`Found ${result.rows.length} representatives for ${county} county`);
        }
        res.json(result.rows);
      } catch (parseErr) {
        console.error("🚨 Error parsing district data or querying DB:", parseErr);
        res.status(500).json({ message: "Error processing district data." });
      }
    });

  } catch (err) {
    console.error("🚨 Error in /api/representatives:", err);
    res.status(500).json({ message: "Internal server error." });
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

// Fetch Representatives & Election Info from Google Civic API
app.get('/api/civic-info', authenticateToken, async (req, res) => {
  try {
    // Get user address
    const userResult = await pool.query('SELECT street_address, city, state, zip_code FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rowCount === 0) return res.status(404).json({ message: 'User not found.' });

    const { street_address, city, state, zip_code } = userResult.rows[0];
    const address = `${street_address}, ${city}, ${state}, ${zip_code}`;
    const apiKey = process.env.GOOGLE_CIVIC_API_KEY;

    // Call Google Civic API
    const response = await axios.get(`https://www.googleapis.com/civicinfo/v2/representatives`, {
      params: { address, key: apiKey }
    });

    const offices = response.data.offices;
    const officials = response.data.officials;
    const representatives = [];

    for (const [index, official] of officials.entries()) {
      const office = offices.find(o => o.officialIndices.includes(index));
      const position = office ? office.name : "Unknown Position";

      // Check if representative already exists in DB
      const existingRep = await pool.query(
        'SELECT id FROM representatives WHERE name = $1 AND office_name = $2',
        [official.name, position]
      );

      if (existingRep.rowCount === 0) {
        // Insert into database
        const insertQuery = `
          INSERT INTO representatives (name, position, party, office_name, email, phone, website, photo_url, state, city)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`;

        const newRep = await pool.query(insertQuery, [
          official.name,
          position,
          official.party || "Unknown",
          position,
          official.emails ? official.emails[0] : null,
          official.phones ? official.phones[0] : null,
          official.urls ? official.urls[0] : null,
          official.photoUrl || null,
          state,
          city
        ]);

        representatives.push(newRep.rows[0]);
      } else {
        // Already exists, fetch from DB
        const existingData = await pool.query('SELECT * FROM representatives WHERE id = $1', [existingRep.rows[0].id]);
        representatives.push(existingData.rows[0]);
      }
    }

    res.json(representatives);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching civic information.' });
  }
});

app.post("/api/get-districts", async (req, res) => {
  const { street_address, city, state, zip_code } = req.body;

  if (!street_address || !city || !state || !zip_code) {
    return res.status(400).json({ message: "All address fields are required." });
  }

  try {
    // Convert address to lat/lon using Nominatim
    const formattedAddress = `${street_address}, ${city}, ${state}, ${zip_code}`;
    const geoResponse = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formattedAddress)}&format=json`
    );

    if (!geoResponse.data.length) {
      return res.status(404).json({ message: "Address not found." });
    }

    const { lat, lon } = geoResponse.data[0];
    console.log(`📍 Found coordinates: ${lat}, ${lon}`);

    // Call Python script to get districts
    exec(`python districts/find_district.py ${lat} ${lon}`, (error, stdout, stderr) => {
      if (error) {
        console.error("🚨 Error executing Python script:", error);
        return res.status(500).json({ message: "Internal server error." });
      }

      try {
        const districtData = JSON.parse(stdout.replace("🗺️ Matched Districts: ", "").trim());
        console.log("🏛️ Matched Districts:", districtData);
        res.json(districtData);
      } catch (parseError) {
        console.error("🚨 Error parsing district data:", parseError);
        res.status(500).json({ message: "Error parsing district data." });
      }
    });
  } catch (err) {
    console.error("🚨 Error fetching coordinates:", err);
    res.status(500).json({ message: "Error fetching coordinates." });
  }
});

app.post("/api/get-representatives", async (req, res) => {
  const { congressional, state_senate, state_assembly } = req.body;

  if (!congressional || !state_senate || !state_assembly) {
    return res.status(400).json({ message: "District numbers are required." });
  }

  try {
    // Query representatives based on district numbers
    const result = await pool.query(
      `SELECT * FROM representatives 
       WHERE cong_district = $1 
       OR state_senate_district = $2 
       OR state_assembly_district = $3`,
      [congressional, state_senate, state_assembly]
    );

    if (result.rowCount === 0) {
      return res.json({ message: "No representatives found for these districts." });
    }

    res.json(result.rows);
  } catch (err) {
    console.error("🚨 Error fetching representatives:", err);
    res.status(500).json({ message: "Error fetching representatives." });
  }
});


app.post("/api/load-ny-assembly", async (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync("districts/ny_assembly_members.json", "utf-8"));


    for (const member of data) {
      await pool.query(
        `INSERT INTO representatives (name, position, state, state_assembly_district, email, website)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (name) DO UPDATE
         SET position = EXCLUDED.position,
             state = EXCLUDED.state,
             state_assembly_district = EXCLUDED.state_assembly_district, 
             email = EXCLUDED.email, 
             website = EXCLUDED.website;`,
        [member.name, "State Assembly Member", "NY", member.district, member.email, member.profile_url]
      );
      
    }

    res.json({ message: "✅ NY Assembly members loaded into database." });
  } catch (err) {
    console.error("🚨 Error loading NY Assembly data:", err);
    res.status(500).json({ message: "Error loading assembly data." });
  }
});

app.post("/api/load-openstates-representatives", async (req, res) => {
  try {
    // Step 1: Wipe the database
    await pool.query("TRUNCATE TABLE representatives RESTART IDENTITY CASCADE");
    console.log("🗑️  Cleared all existing representatives from the database.");

    // Step 2: Load new representatives
    const data = JSON.parse(fs.readFileSync("districts/openstates_representatives_fixed.json", "utf8").trim());



    let insertedCount = 0;

    for (const rep of data) {
      if (!rep.current_role) continue; // Skip reps with no current role

      const cleanText = (text) => {
        if (!text) return null; // Return null for empty values
        return text
          .normalize("NFKD")  // Normalize Unicode
          .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
          .trim();
      };
      
      await pool.query(
        `INSERT INTO representatives (name, position, state, email, party, website)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          cleanText(rep.name),
          cleanText(rep.current_role?.title || "Unknown Position"),
          "NY",
          cleanText(rep.email),
          cleanText(rep.party || "Unknown"),
          cleanText(rep.links?.[0]?.url)
        ]
      );
      insertedCount++;
      console.log(`✅ Inserted: ${rep.name}`);
    }

    res.json({ message: `✅ Database wiped and reloaded with ${insertedCount} Open States representatives.` });
  } catch (err) {
    console.error("🚨 Error loading Open States data:", err);
    res.status(500).json({ message: "Error loading Open States data." });
  }
});

app.post("/api/load-ny-county-officials", async (req, res) => {
  try {
    console.log("📂 Reading JSON file...");
    const countyData = JSON.parse(fs.readFileSync("districts/ny_county_officials.json", "utf-8"));
    console.log(`📊 Found ${Object.keys(countyData).length} counties in JSON file`);
    
    let insertedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;
    let errorCount = 0;
    let errorDetails = [];

    // Process each county
    for (const [county, data] of Object.entries(countyData)) {
      console.log(`\n🏛️ Processing ${county} County...`);
      
      try {
        // Handle variations of county names
        const countyVariations = [county];
        if (county.startsWith('St.')) {
          countyVariations.push(county.replace('St.', 'Saint'));
        } else if (county.startsWith('Saint')) {
          countyVariations.push(county.replace('Saint', 'St.'));
        }
        
        // First, check existing officials
        const existingResult = await pool.query(
          'SELECT id, name, position FROM representatives WHERE county = ANY($1)',
          [countyVariations]
        );
        console.log(`Found ${existingResult.rowCount} existing officials in ${county} County`);

        // Remove existing officials
        if (existingResult.rowCount > 0) {
          const removeResult = await pool.query(
            'DELETE FROM representatives WHERE county = ANY($1)',
            [countyVariations]
          );
          removedCount += removeResult.rowCount;
          console.log(`🗑️ Removed ${removeResult.rowCount} existing officials from ${county} County`);
        }

        // Now add the new officials
        if (!data.county_wide || !Array.isArray(data.county_wide)) {
          console.error(`❌ Invalid data structure for ${county} - missing or invalid county_wide array`);
          errorCount++;
          continue;
        }

        for (const official of data.county_wide) {
          try {
            console.log(`Processing official: ${official.name}, ${official.position}`);
            
            if (!official.name || !official.position) {
              throw new Error(`Missing required fields for official in ${county}`);
            }

            // Insert new official
            await pool.query(
              `INSERT INTO representatives (
                name, position, state, county, party, 
                last_verified, office_name
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                official.name,
                official.position,
                'NY',
                county,
                official.party || 'Unknown',
                data.last_verified || new Date().toISOString().split('T')[0],
                official.position
              ]
            );
            insertedCount++;
            console.log(`✅ Successfully inserted: ${official.name}`);
          } catch (err) {
            console.error(`❌ Error processing ${official?.name || 'unknown'} from ${county}:`, err);
            errorDetails.push({
              county,
              official: official?.name || 'unknown',
              error: err.message
            });
            errorCount++;
          }
        }
      } catch (err) {
        console.error(`❌ Error processing ${county} County:`, err);
        errorDetails.push({
          county,
          error: err.message
        });
        errorCount++;
      }
    }

    const summary = {
      message: "County officials import completed",
      stats: { 
        inserted: insertedCount, 
        updated: updatedCount,
        removed: removedCount,
        errors: errorCount 
      },
      errorDetails: errorDetails
    };

    console.log("\n📊 Import Summary:", JSON.stringify(summary, null, 2));
    res.json(summary);
  } catch (err) {
    console.error("🚨 Critical error loading county officials:", err);
    res.status(500).json({ 
      message: "Error loading county officials data",
      error: err.message
    });
  }
});

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

// Helper function to find issue text by ID
function findIssueText(issueId) {
  // Define the issues with their targets
  const issuesList = [
    // National issues
    { id: 101, text: "Should parents be allowed to use public funds (vouchers) to send their children to private schools?", target: "National" },
    { id: 102, text: "Should public colleges and universities be free for in-state residents?", target: "National" },
    { id: 103, text: "Should the government impose more regulations on large tech companies to prevent monopolies?", target: "National" },
    { id: 104, text: "Should the United States reduce foreign military interventions and focus on domestic issues?", target: "National" },
    { id: 105, text: "Should the government regulate the use of facial recognition technology by law enforcement?", target: "National" },
    { id: 106, text: "Should GMOs be more strictly regulated or banned in consumer food products?", target: "National" },
    { id: 107, text: "Should the U.S. enact stricter environmental rules, even if they slow some economic growth?", target: "National" },
    { id: 108, text: "Should health insurance companies be required to cover pre-existing conditions?", target: "National" },
    { id: 109, text: "Should the federal voting age be lowered to 16?", target: "National" },
    { id: 110, text: "Should children be required to show proof of vaccination to attend public schools?", target: "National" },
    { id: 111, text: "Should local or state governments be allowed to pass laws that differ significantly from federal policy on major issues?", target: "National" },
    { id: 112, text: "Should transgender athletes be allowed to join teams matching their gender identity at all levels?", target: "National" },
    { id: 113, text: "Should parents be allowed to refuse certain medical treatments for their children on religious grounds?", target: "National" },
    { id: 114, text: "Should hate speech be protected under free speech laws?", target: "National" },
    { id: 115, text: "Should local school boards be allowed to remove books from school libraries based on content?", target: "National" },
    { id: 116, text: "Should there be a federal ban on \"conversion therapy\" for minors?", target: "National" },
    { id: 117, text: "Should minors have access to gender-affirming healthcare without parental consent?", target: "National" },
    { id: 118, text: "Should universal childcare be provided by the federal government?", target: "National" },
    { id: 119, text: "Should public schools teach comprehensive sex education, including contraception and LGBTQ+ topics?", target: "National" },
    { id: 120, text: "Should the legal drinking age be lowered from 21 to 18?", target: "National" },
    { id: 121, text: "Should parents be allowed to homeschool their children without meeting state education standards?", target: "National" },
    { id: 122, text: "Should publicly funded adoption agencies be allowed to turn away prospective parents based on religious beliefs?", target: "National" },
    { id: 123, text: "Should businesses be allowed to refuse service to same-sex couples on religious grounds?", target: "National" },
    { id: 124, text: "Should the U.S. legalize physician-assisted suicide for terminally ill patients who consent?", target: "National" },
    { id: 125, text: "Should the government enforce stronger rules against \"offensive\" content on social media, beyond current laws?", target: "National" },
    { id: 126, text: "Should people be allowed to use certain psychedelics (like psilocybin) for therapy under medical supervision?", target: "National" },
    { id: 127, text: "Should police departments be required to reflect the demographics of the communities they serve?", target: "National" },
    { id: 128, text: "Should there be nationwide rent control to address housing affordability?", target: "National" },
    
    // New York issues
    { id: 201, text: "Should New York State keep its current bail reform laws?", target: "New York" },
    { id: 202, text: "Should undocumented immigrants in New York State be eligible for driver's licenses?", target: "New York" },
    { id: 203, text: "Should New York State adopt a single-payer healthcare system, independent of federal policy?", target: "New York" },
    { id: 204, text: "Should all New York State landlords follow the same rent stabilization rules as in New York City?", target: "New York" },
    { id: 205, text: "Should New York State fully ban fracking and new natural gas pipelines?", target: "New York" },
    { id: 206, text: "Should New York City eliminate its gifted and talented programs in public schools to promote equity?", target: "New York" },
    { id: 207, text: "Should New York State invest public funds to create safe injection sites for drug users?", target: "New York" },
    { id: 208, text: "Should New York State limit annual property tax increases for homeowners?", target: "New York" },
    { id: 209, text: "Should the MTA receive more New York State funding, even if that means higher taxes or fares?", target: "New York" },
    { id: 210, text: "Should New York State impose congestion pricing in Manhattan below 60th Street?", target: "New York" },
    { id: 211, text: "Should New York State require new housing projects to include affordable units?", target: "New York" },
    { id: 212, text: "Should New York State impose stricter rules on short-term rentals (like Airbnb) to help address the housing shortage?", target: "New York" },
    { id: 213, text: "Should local governments in New York State be able to opt out of legal cannabis?", target: "New York" },
    { id: 214, text: "Should New York State ban the sale of all flavored tobacco and vaping products?", target: "New York" },
    { id: 215, text: "Should New York State make all SUNY and CUNY schools tuition-free for in-state residents?", target: "New York" },
    { id: 216, text: "Should the New York State constitution explicitly protect abortion rights?", target: "New York" },
    { id: 217, text: "Should teacher salaries in New York State be funded mainly by the state to reduce disparities among districts?", target: "New York" },
    { id: 218, text: "Should New York State raise taxes on high earners to fund social programs like healthcare and housing?", target: "New York" },
    { id: 219, text: "Should New York State invest in a public broadband network to guarantee high-speed internet for all residents?", target: "New York" },
    { id: 220, text: "Should solitary confinement be completely banned in New York State prisons and jails?", target: "New York" },
  ];
  
  const issue = issuesList.find(issue => issue.id === parseInt(issueId));
  return issue ? issue.text : null;
}
