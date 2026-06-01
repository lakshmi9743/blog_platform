const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'premium_blogging_platform_jwt_secret_token_2026_key';

// A collection of gorgeous HSL gradients/colors for user avatars
const AVATAR_COLORS = [
  'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)', // Coral Sunset
  'linear-gradient(135deg, #4E65FF 0%, #92EFFD 100%)', // Ocean Blue
  'linear-gradient(135deg, #7F00FF 0%, #E100FF 100%)', // Neon Violet
  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', // Emerald Glow
  'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)', // Solar Flare
  'linear-gradient(135deg, #8A2387 0%, #E94057 100%, #F27121 100%)', // Aurora Rose
  'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)', // Electric Cyan
  'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)'  // Crimson Gold
];

// @route   POST api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Simple validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    // Wait for DB initialization (just in case)
    let checks = 0;
    while (!db.isReady && checks < 20) {
      await new Promise(r => setTimeout(r, 100));
      checks++;
    }

    // Check for existing user by username
    const existingUserByName = await db.users.findByUsername(username);
    if (existingUserByName) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    // Check for existing user by email
    const existingUserByEmail = await db.users.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Pick a random avatar gradient
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    // Create user
    const user = await db.users.create(username, email, passwordHash, avatarColor);

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarColor: user.avatar_color
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during user registration.' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: 'Please enter all fields.' });
    }

    // Wait for DB initialization
    let checks = 0;
    while (!db.isReady && checks < 20) {
      await new Promise(r => setTimeout(r, 100));
      checks++;
    }

    // Check for user
    let user = null;
    if (usernameOrEmail.includes('@')) {
      user = await db.users.findByEmail(usernameOrEmail);
    } else {
      user = await db.users.findByUsername(usernameOrEmail);
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials. User does not exist.' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials. Password incorrect.' });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarColor: user.avatar_color
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// @route   GET api/auth/me
// @desc    Get current user details
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await db.users.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarColor: user.avatar_color
    });
  } catch (err) {
    console.error('Get user details error:', err);
    res.status(500).json({ message: 'Server error retrieving profile details.' });
  }
});

module.exports = router;
