const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Helper to calculate reading time (standard 200 words per minute)
function calculateReadTime(content) {
  const words = content.trim().split(/\s+/).length;
  const time = Math.ceil(words / 200);
  return Math.max(1, time); // Minimum 1 minute
}

// @route   GET api/posts
// @desc    Get all blog posts (supports optional search and tag filters)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { q, tag } = req.query;
    const posts = await db.posts.findAll(q, tag);
    res.json(posts);
  } catch (err) {
    console.error('Fetch posts error:', err);
    res.status(500).json({ message: 'Server error retrieving blog posts.' });
  }
});

// @route   GET api/posts/:id
// @desc    Get a single blog post by ID along with its comments
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const post = await db.posts.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    const comments = await db.comments.findByPostId(req.params.id);
    res.json({
      ...post,
      comments
    });
  } catch (err) {
    console.error('Fetch single post error:', err);
    res.status(500).json({ message: 'Server error retrieving post details.' });
  }
});

// @route   POST api/posts
// @desc    Create a new blog post
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, coverImage, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }

    // Process tags
    let processedTags = [];
    if (tags) {
      processedTags = tags.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);
    }

    const readTime = calculateReadTime(content);

    const post = await db.posts.create(
      title,
      content,
      coverImage || '',
      req.user.id,
      req.user.username,
      processedTags,
      readTime
    );

    res.status(201).json(post);
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ message: 'Server error during blog post creation.' });
  }
});

// @route   PUT api/posts/:id
// @desc    Update an existing blog post
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, coverImage, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }

    // Find the post first
    const post = await db.posts.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    // Check post ownership (author_id can be integer or string depending on sqlite/json fallback)
    if (String(post.author_id) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Authorization denied. You are not the author of this post.' });
    }

    // Process tags
    let processedTags = [];
    if (tags) {
      processedTags = tags.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);
    }

    const readTime = calculateReadTime(content);

    const updatedPost = await db.posts.update(
      req.params.id,
      title,
      content,
      coverImage || '',
      processedTags,
      readTime
    );

    res.json(updatedPost);
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ message: 'Server error updating the blog post.' });
  }
});

// @route   DELETE api/posts/:id
// @desc    Delete a blog post
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    // Find post
    const post = await db.posts.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    // Check post ownership
    if (String(post.author_id) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Authorization denied. You can only delete your own posts.' });
    }

    const success = await db.posts.delete(req.params.id);
    if (success) {
      res.json({ message: 'Blog post deleted successfully.' });
    } else {
      res.status(400).json({ message: 'Failed to delete blog post.' });
    }
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ message: 'Server error deleting the blog post.' });
  }
});

module.exports = router;
