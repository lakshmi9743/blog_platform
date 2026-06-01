// UI Utilities
export function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

// Map hash value of string to a specific aesthetic cover gradient class
export function getCoverGradient(seed) {
  const num = Math.abs(seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
  const gradientIdx = (num % 7) + 1; // 1 to 7
  return `art-gradient-${gradientIdx}`;
}

// Extremely simple Markdown parsing helper for beautiful typography
export function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Bold / Italic
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Line breaks & Paragraphs
  const lines = html.split('\n');
  let result = '';
  let inList = false;
  let inOrderedList = false;

  lines.forEach(line => {
    const trimmed = line.trim();
    
    // Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        result += '<ul>';
        inList = true;
      }
      result += `<li>${trimmed.substring(2)}</li>`;
      return;
    } else if (inList) {
      result += '</ul>';
      inList = false;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (!inOrderedList) {
        result += '<ol>';
        inOrderedList = true;
      }
      result += `<li>${trimmed.replace(/^\d+\.\s/, '')}</li>`;
      return;
    } else if (inOrderedList) {
      result += '</ol>';
      inOrderedList = false;
    }

    // Default paragraphs
    if (trimmed.length > 0 && !trimmed.startsWith('<h') && !trimmed.startsWith('<blockquote')) {
      result += `<p>${line}</p>`;
    } else {
      result += line;
    }
  });

  if (inList) result += '</ul>';
  if (inOrderedList) result += '</ol>';

  return result;
}

// Component 1: Sticky Navigation Bar
export function NavbarComponent(user) {
  const authSection = user 
    ? `
      <div class="user-menu">
        <button class="btn btn-secondary btn-sm" onclick="location.hash='#/write'" style="padding: 8px 16px; font-size: 0.85rem;">
          <span>✨ Write Post</span>
        </button>
        <div class="user-avatar" id="navbar-avatar-btn" style="background: ${user.avatarColor || 'var(--gradient-main)'};">
          ${user.username.substring(0, 2).toUpperCase()}
        </div>
        <div class="dropdown-menu" id="navbar-dropdown">
          <div style="padding: 10px 16px; border-bottom: 1px solid var(--border-light); font-size: 0.8rem; color: var(--text-muted);">
            Logged in as <strong style="color: var(--text-primary);">${user.username}</strong>
          </div>
          <div class="dropdown-item" onclick="location.hash='#/dashboard'">
            📂 My Dashboard
          </div>
          <div class="dropdown-item" onclick="location.hash='#/write'">
            ✍️ Compose Post
          </div>
          <div class="dropdown-item" id="logout-btn" style="color: var(--accent-pink);">
            🚪 Log Out
          </div>
        </div>
      </div>
    `
    : `
      <button class="btn btn-primary" id="trigger-login-btn">
        <span>Connect Identity</span>
      </button>
    `;

  return `
    <div class="container navbar">
      <a href="#/" class="nav-brand">
        <div class="nav-logo">Æ</div>
        <span class="gradient-text">Aether</span>
      </a>
      
      <div class="nav-search" id="navbar-search-mount">
        <span class="nav-search-icon">🔍</span>
        <input type="text" class="nav-search-input" id="search-input" placeholder="Search insights, narratives..." value="">
      </div>

      <div class="nav-actions">
        ${authSection}
      </div>
    </div>
  `;
}

// Component 2: Grid Post card listing
export function BlogCardComponent(post) {
  const gradientClass = getCoverGradient(post.id.toString());
  const tagList = post.tags ? post.tags.split(',') : [];
  const primaryTag = tagList.length > 0 ? tagList[0] : 'insight';
  const displayCover = post.cover_image 
    ? `<img src="${post.cover_image}" alt="${post.title}" class="blog-card-cover-art" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">`
    : '';

  const fallbackArt = `<div class="blog-card-cover-art ${gradientClass}" style="display: ${post.cover_image ? 'none' : 'block'}; height: 100%; width: 100%;"></div>`;

  return `
    <article class="glass-card blog-card" onclick="location.hash='#/post/${post.id}'" style="cursor: pointer;">
      <div class="blog-card-cover">
        ${displayCover}
        ${fallbackArt}
        <span class="blog-card-cover-tag">${primaryTag}</span>
      </div>
      <div class="blog-card-body">
        <div class="blog-card-meta">
          <span>${formatDate(post.created_at)}</span>
        </div>
        <h3 class="blog-card-title">${post.title}</h3>
        <p class="blog-card-excerpt">${post.content.replace(/[#*>_\-`]/g, '').substring(0, 140)}...</p>
        
        <div class="blog-card-footer">
          <div class="blog-card-author">
            <div class="user-avatar blog-card-author-avatar" style="background: var(--gradient-main);">
              ${post.author_name.substring(0, 2).toUpperCase()}
            </div>
            <span class="blog-card-author-name">${post.author_name}</span>
          </div>
          <div class="blog-card-readtime">
            <span>⏱️ ${post.read_time} min read</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

// Component 3: Complete Post Detailed View
export function PostDetailComponent(post, currentUser) {
  const gradientClass = getCoverGradient(post.id.toString());
  const tagList = post.tags ? post.tags.split(',') : [];
  
  const displayCover = post.cover_image 
    ? `<img src="${post.cover_image}" alt="${post.title}" class="post-detail-cover-art" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">`
    : '';

  const fallbackArt = `<div class="post-detail-cover-art ${gradientClass}" style="display: ${post.cover_image ? 'none' : 'block'}; height: 100%; width: 100%;"></div>`;

  const editControls = currentUser && String(post.author_id) === String(currentUser.id)
    ? `
      <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
        <button class="btn btn-secondary btn-sm" onclick="location.hash='#/edit/${post.id}'">✍️ Edit Post</button>
        <button class="btn btn-danger btn-sm" id="delete-post-btn-action" data-id="${post.id}">🗑️ Delete Post</button>
      </div>
    `
    : '';

  const badges = tagList.map(tag => `<span class="tag-badge">#${tag}</span>`).join('');

  return `
    <div class="post-detail-container">
      <div class="post-detail-header">
        <div class="post-detail-meta">
          <span>📅 ${formatDate(post.created_at)}</span>
          <span>•</span>
          <span>⏱️ ${post.read_time} min read</span>
        </div>
        <h1 class="post-detail-title">${post.title}</h1>
        <div class="post-detail-author-card">
          <div class="user-avatar" style="background: var(--gradient-main); width: 32px; height: 32px; font-size: 0.8rem;">
            ${post.author_name.substring(0, 2).toUpperCase()}
          </div>
          <span style="font-weight: 600;">${post.author_name}</span>
        </div>
        ${editControls}
      </div>

      <div class="post-detail-cover">
        ${displayCover}
        ${fallbackArt}
      </div>

      <div class="post-detail-content">
        ${parseMarkdown(post.content)}
      </div>

      <div class="post-detail-tags">
        ${badges}
      </div>

      <!-- Live comments anchor -->
      <section class="comments-section" id="comments-section-mount"></section>
    </div>
  `;
}

// Component 4: Threaded Comments Section Component
export function CommentListComponent(comments, currentUser, isPostAuthor) {
  const commentCount = comments.length;
  
  const commentBox = currentUser
    ? `
      <div class="comment-box glass-card" style="box-shadow: none; border-color: rgba(255,255,255,0.05); margin-bottom: 30px;">
        <h4 class="comment-box-title">Add to the Conversation</h4>
        <form id="comment-form">
          <textarea class="comment-textarea" id="comment-content" required placeholder="Write a respectful, thoughtful response..."></textarea>
          <button type="submit" class="btn btn-primary" id="comment-submit-btn">Publish Comment</button>
        </form>
      </div>
    `
    : `
      <div class="empty-state" style="padding: 30px 20px; margin-bottom: 30px;">
        <h4 class="empty-state-title" style="font-size: 1.05rem;">Want to share your thoughts?</h4>
        <p class="empty-state-subtitle" style="font-size: 0.85rem; margin-bottom: 12px;">Sign in to join the conversation and interact with this author.</p>
        <button class="btn btn-secondary btn-sm" id="comment-login-trigger">Connect Identity</button>
      </div>
    `;

  let commentsHtml = '';
  if (commentCount === 0) {
    commentsHtml = `
      <div style="text-align: center; padding: 30px; color: var(--text-muted); font-style: italic; font-size: 0.95rem;">
        No reflections yet. Be the first to express a perspective on this post!
      </div>
    `;
  } else {
    commentsHtml = comments.map(comment => {
      const isCommentOwner = currentUser && String(comment.author_id) === String(currentUser.id);
      const showDelete = isCommentOwner || (currentUser && isPostAuthor);

      const deleteBtn = showDelete
        ? `<button class="btn btn-danger btn-sm delete-comment-btn-action" data-id="${comment.id}" style="padding: 6px 12px; font-size: 0.75rem; border-radius: var(--radius-sm);">Delete</button>`
        : '';

      return `
        <div class="comment-card">
          <div class="user-avatar" style="background: var(--gradient-main); width: 34px; height: 34px; font-size: 0.8rem; flex-shrink: 0;">
            ${comment.author_name.substring(0, 2).toUpperCase()}
          </div>
          <div class="comment-body">
            <div class="comment-header">
              <div class="comment-author-info">
                <span class="comment-author-name">${comment.author_name}</span>
                <span class="comment-time">${formatDate(comment.created_at)}</span>
              </div>
              ${deleteBtn}
            </div>
            <p class="comment-text">${comment.content}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  return `
    <h3 class="comments-title">
      <span>Reflections</span>
      <span class="comments-count-badge">${commentCount}</span>
    </h3>
    ${commentBox}
    <div class="comments-list">
      ${commentsHtml}
    </div>
  `;
}

// Component 5: Dynamic Markdown Editor and Composer
export function EditorComponent(post = null) {
  const isEdit = post !== null;
  const title = isEdit ? 'Refine Narrative' : 'Compose Narrative';
  const subtitle = isEdit ? 'Polishing and updating your shared insights.' : 'Draft your ideas and share them with the Aether community.';

  return `
    <div class="editor-container">
      <div style="margin-bottom: 30px;">
        <h1 class="gradient-text" style="font-size: 2.2rem; margin-bottom: 6px;">${title}</h1>
        <p class="feed-subtitle">${subtitle}</p>
      </div>

      <div class="editor-grid">
        <!-- Editor Input Panel -->
        <div class="glass-card" style="box-shadow: none;">
          <form id="editor-form" style="display: flex; flex-direction: column; gap: 20px;">
            <div class="form-group">
              <label for="editor-title">Narrative Title</label>
              <input type="text" id="editor-title" required placeholder="e.g. The Quiet Splendor of Pure Styling" value="${isEdit ? post.title : ''}">
            </div>
            
            <div class="form-group">
              <label for="editor-cover">Cover Image URL (Optional)</label>
              <input type="url" id="editor-cover" placeholder="e.g. https://images.unsplash.com/... (blank for abstract dynamic gradient)" value="${isEdit ? post.cover_image : ''}">
            </div>
            
            <div class="form-group">
              <label for="editor-tags">Tags (Comma-separated)</label>
              <input type="text" id="editor-tags" placeholder="e.g. design, css, minimalism" value="${isEdit ? post.tags : ''}">
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label for="editor-content">Content Draft</label>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Supports basic markdown formatting</div>
              </div>
              <textarea id="editor-content" required placeholder="Begin typing your story... Use # for headers, * for lists, and ** for bold text." style="min-height: 280px; font-family: var(--font-body); line-height: 1.5; resize: vertical;">${isEdit ? post.content : ''}</textarea>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 10px;">
              <button type="submit" class="glow-button" style="padding: 10px 24px; font-size: 0.85rem;">
                ${isEdit ? 'Save Refinements' : 'Publish to Feed'}
              </button>
              <button type="button" class="btn btn-secondary" onclick="location.hash='#/'" style="padding: 10px 24px; font-size: 0.85rem;">
                Discard
              </button>
            </div>
          </form>
        </div>

        <!-- Real-Time Interactive Preview Panel -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-family: var(--font-display); font-weight: 600; font-size: 0.95rem; color: var(--text-secondary);">Interactive Live Preview</span>
            <span style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Aether Format</span>
          </div>
          <div class="editor-preview-panel" id="editor-preview-panel">
            <div class="editor-preview-empty">Your live render will display here as you write.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Component 6: Creator Dashboard & Performance Portfolio
export function DashboardComponent(posts, user) {
  const totalPosts = posts.length;
  // Calculate aggregate reading time and mock simple engagement stats
  const totalReadTime = posts.reduce((sum, p) => sum + (parseInt(p.read_time) || 0), 0);
  
  let rowsHtml = '';
  if (totalPosts === 0) {
    rowsHtml = `
      <div class="empty-state">
        <h4 class="empty-state-title">No Narratives Found</h4>
        <p class="empty-state-subtitle">You have not published any stories under Aether yet.</p>
        <button class="btn btn-primary" onclick="location.hash='#/write'">✨ Compose First Story</button>
      </div>
    `;
  } else {
    rowsHtml = posts.map(post => `
      <div class="dashboard-post-row">
        <div class="dashboard-post-info">
          <span class="dashboard-post-title" onclick="location.hash='#/post/${post.id}'">${post.title}</span>
          <span class="dashboard-post-date">Published on ${formatDate(post.created_at)} • ⏱️ ${post.read_time} min read</span>
        </div>
        <div class="dashboard-post-actions">
          <button class="btn btn-secondary btn-sm" onclick="location.hash='#/edit/${post.id}'" style="padding: 6px 12px; font-size: 0.75rem; border-radius: var(--radius-sm);">Edit</button>
          <button class="btn btn-danger btn-sm dashboard-delete-post-btn" data-id="${post.id}" style="padding: 6px 12px; font-size: 0.75rem; border-radius: var(--radius-sm);">Delete</button>
        </div>
      </div>
    `).join('');
  }

  return `
    <div>
      <div style="margin-bottom: 40px;">
        <h1 class="gradient-text" style="font-size: 2.4rem; margin-bottom: 6px;">Creator Portfolio</h1>
        <p class="feed-subtitle">Analyze engagement, manage narrative drafts, and publish edits.</p>
      </div>

      <div class="dashboard-grid">
        <!-- Sidebar Navigation & Profiler -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div class="glass-card" style="box-shadow: none; text-align: center; padding: 24px;">
            <div class="user-avatar" style="background: ${user.avatarColor || 'var(--gradient-main)'}; width: 64px; height: 64px; font-size: 1.5rem; margin: 0 auto 16px;">
              ${user.username.substring(0, 2).toUpperCase()}
            </div>
            <h3 style="font-size: 1.2rem; margin-bottom: 4px;">${user.username}</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted);">${user.email}</p>
          </div>

          <div class="dashboard-nav">
            <div class="dashboard-nav-item active">📁 Managed Stories (${totalPosts})</div>
            <div class="dashboard-nav-item" onclick="location.hash='#/write'">✨ Publish Narrative</div>
            <div class="dashboard-nav-item" onclick="location.hash='#/'">🌎 Back to Feed</div>
          </div>
        </div>

        <!-- Performance Statistics and Content Manager -->
        <div>
          <div class="dashboard-stats">
            <div class="stat-card">
              <div class="stat-val">${totalPosts}</div>
              <div class="stat-label">Total Posts</div>
            </div>
            <div class="stat-card">
              <div class="stat-val">${totalReadTime}m</div>
              <div class="stat-label">Total Read Time</div>
            </div>
            <div class="stat-card">
              <div class="stat-val">Active</div>
              <div class="stat-label">Status</div>
            </div>
          </div>

          <h2 style="font-size: 1.4rem; margin-bottom: 16px; font-family: var(--font-display);">Your Narratives</h2>
          <div class="dashboard-posts-list">
            ${rowsHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}
