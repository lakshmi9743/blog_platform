const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// @route   POST api/comments/post/:postId
// @desc    Add a comment to a blog post
// @access  Private
router.post('/post/:postId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const { postId } = req.params;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content cannot be empty.' });
    }

    // Verify post exists
    const post = await db.posts.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }

    const comment = await db.comments.create(
      postId,
      req.user.id,
      req.user.username,
      content.trim()
    );

    res.status(201).json(comment);
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ message: 'Server error during comment creation.' });
  }
});

// @route   DELETE api/comments/:id
// @desc    Delete a comment (by comment owner OR post owner)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const commentId = req.params.id;

    // Fetch comment
    const comment = await db.comments.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    // Fetch post to check if current user is the post author
    const post = await db.posts.findById(comment.post_id);
    if (!post) {
      return res.status(404).json({ message: 'Associated blog post not found.' });
    }

    // Authorization: User must be comment author OR post author
    const isCommentAuthor = String(comment.author_id) === String(req.user.id);
    const isPostAuthor = String(post.author_id) === String(req.user.id);

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ message: 'Authorization denied. You do not have permission to delete this comment.' });
    }

    const success = await db.comments.delete(commentId);
    if (success) {
      res.json({ message: 'Comment deleted successfully.' });
    } else {
      res.status(400).json({ message: 'Failed to delete comment.' });
    }
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ message: 'Server error deleting comment.' });
  }
});

module.exports = router;
