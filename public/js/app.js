import api from './api.js';
import {
  NavbarComponent,
  BlogCardComponent,
  PostDetailComponent,
  CommentListComponent,
  EditorComponent,
  DashboardComponent,
  parseMarkdown
} from './components.js';

// Application State
const state = {
  currentUser: null,
  activeSearchQuery: '',
  activeTagFilter: ''
};

// Mount points
const navbarMount = document.getElementById('navbar-container');
const viewportMount = document.getElementById('app-viewport');
const authModal = document.getElementById('auth-modal');

// --- Central Notification Toast System ---
export function showToast(message, type = 'success') {
  const container = document.getElementById('notification-center');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <span class="toast-text">${message}</span>
    <button class="toast-close">&times;</button>
  `;
  
  container.appendChild(toast);
  
  // Close handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 350);
  });
  
  // Auto dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// --- Dynamic View Routing Coordinator ---
async function handleRouting() {
  const hash = window.location.hash || '#/';
  
  // Clear search on page navigation unless we are on the feed
  if (!hash.startsWith('#/') || hash.includes('/post/') || hash.includes('/edit/')) {
    state.activeSearchQuery = '';
    state.activeTagFilter = '';
  }

  // Scroll to top on routing
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Route 1: Post Compose Workspace
  if (hash === '#/write') {
    if (!api.isAuthenticated()) {
      showToast('Authentication required to access composition tools.', 'error');
      window.location.hash = '#/';
      openAuthModal(false); // Open on login
      return;
    }
    renderEditor();
    return;
  }

  // Route 2: Post Editing Workspace
  if (hash.startsWith('#/edit/')) {
    if (!api.isAuthenticated()) {
      showToast('Authentication required to refine narrative.', 'error');
      window.location.hash = '#/';
      return;
    }
    const postId = hash.split('#/edit/')[1];
    renderEditor(postId);
    return;
  }

  // Route 3: Portfolio Creator Dashboard
  if (hash === '#/dashboard') {
    if (!api.isAuthenticated()) {
      showToast('Access denied. Identity verification required.', 'error');
      window.location.hash = '#/';
      openAuthModal(false);
      return;
    }
    renderDashboard();
    return;
  }

  // Route 4: Narrative Immersive Detail Reading Room
  if (hash.startsWith('#/post/')) {
    const postId = hash.split('#/post/')[1];
    renderPostDetail(postId);
    return;
  }

  // Route 5: Home Feed (Default)
  if (hash.startsWith('#/')) {
    renderHomeFeed();
    return;
  }

  // Fallback
  window.location.hash = '#/';
}

// --- View Renderers ---

// 1. Home Feed View
async function renderHomeFeed() {
  viewportMount.innerHTML = `
    <div class="feed-header">
      <div class="feed-title-section">
        <h1 class="gradient-text" style="font-size: 2.5rem; margin-bottom: 4px;">Explore Perspectives</h1>
        <p class="feed-subtitle" id="feed-subtitle-desc">Thought leadership, technical breakdowns, and design philosophies.</p>
      </div>
      <div>
        <button class="btn btn-secondary" id="feed-write-shortcut">✍️ Draft Article</button>
      </div>
    </div>
    
    <div class="posts-grid" id="posts-grid-mount">
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        Quantum alignment in progress... Loading insights.
      </div>
    </div>
  `;

  // Setup header write shortcut
  document.getElementById('feed-write-shortcut').addEventListener('click', () => {
    if (api.isAuthenticated()) {
      window.location.hash = '#/write';
    } else {
      showToast('Please authenticate to begin writing.', 'error');
      openAuthModal(false);
    }
  });

  // Pull posts from APIs
  try {
    const posts = await api.getPosts(state.activeSearchQuery, state.activeTagFilter);
    const grid = document.getElementById('posts-grid-mount');
    const desc = document.getElementById('feed-subtitle-desc');

    if (state.activeSearchQuery) {
      desc.textContent = `Search results matching query: "${state.activeSearchQuery}"`;
    } else if (state.activeTagFilter) {
      desc.textContent = `Insights categorized under tag: #${state.activeTagFilter}`;
    }

    if (posts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <h4 class="empty-state-title">No Narratives Match Filters</h4>
          <p class="empty-state-subtitle">Be the pioneer to write on this topic!</p>
          <button class="btn btn-primary" id="empty-state-write-btn">Compose Story</button>
        </div>
      `;
      document.getElementById('empty-state-write-btn').addEventListener('click', () => {
        location.hash = api.isAuthenticated() ? '#/write' : '#/';
        if (!api.isAuthenticated()) openAuthModal(false);
      });
      return;
    }

    grid.innerHTML = posts.map(post => BlogCardComponent(post)).join('');
  } catch (err) {
    showToast('Failed to connect to narrative indexes.', 'error');
  }
}

// 2. Post Details and Comments View
async function renderPostDetail(postId) {
  viewportMount.innerHTML = `<div style="text-align: center; padding: 60px;">Immersing into composition details...</div>`;
  
  try {
    const post = await api.getPost(postId);
    viewportMount.innerHTML = PostDetailComponent(post, state.currentUser);
    
    // Mount Comments Thread
    renderCommentsSection(post);

    // Delete post actions handler (for authors)
    const deleteBtn = document.getElementById('delete-post-btn-action');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm('Are you absolutely certain you wish to delete this narrative? This operation is permanent.')) {
          try {
            await api.deletePost(id);
            showToast('Narrative deleted successfully.', 'success');
            window.location.hash = '#/';
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    }

  } catch (err) {
    viewportMount.innerHTML = `
      <div class="empty-state">
        <h4 class="empty-state-title">Narrative Index Unresolved</h4>
        <p class="empty-state-subtitle">The story you are searching for does not exist or has been deleted.</p>
        <button class="btn btn-primary" onclick="location.hash='#/'">Return to Feed</button>
      </div>
    `;
  }
}

// Comments Helper Renderer
function renderCommentsSection(post) {
  const mount = document.getElementById('comments-section-mount');
  if (!mount) return;

  const isPostAuthor = state.currentUser && String(post.author_id) === String(state.currentUser.id);
  mount.innerHTML = CommentListComponent(post.comments || [], state.currentUser, isPostAuthor);

  // Bind Submit Comment Form
  const form = document.getElementById('comment-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = document.getElementById('comment-content').value;
      
      const submitBtn = document.getElementById('comment-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Publishing...';

      try {
        const newComment = await api.addComment(post.id, content);
        showToast('Comment published successfully.', 'success');
        
        // Refresh comments list
        post.comments = post.comments || [];
        post.comments.push(newComment);
        renderCommentsSection(post);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Comment';
      }
    });
  }

  // Bind Unauthenticated login trigger
  const loginTrigger = document.getElementById('comment-login-trigger');
  if (loginTrigger) {
    loginTrigger.addEventListener('click', () => openAuthModal(false));
  }

  // Bind Delete Comment Actions
  const deleteCommentButtons = mount.querySelectorAll('.delete-comment-btn-action');
  deleteCommentButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const commentId = e.target.getAttribute('data-id');
      if (confirm('Delete this comment permanently?')) {
        try {
          await api.deleteComment(commentId);
          showToast('Comment deleted.', 'success');
          
          // Re-fetch post details to update comment list dynamically
          const updatedPost = await api.getPost(post.id);
          renderCommentsSection(updatedPost);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

// 3. Write & Edit Post Canvas View
async function renderEditor(postId = null) {
  const isEdit = postId !== null;
  
  if (isEdit) {
    viewportMount.innerHTML = `<div style="text-align: center; padding: 60px;">Opening editing workshop...</div>`;
    try {
      const post = await api.getPost(postId);
      
      // Ownership safeguard
      if (String(post.author_id) !== String(state.currentUser.id)) {
        showToast('Access denied. You do not hold publishing rights for this narrative.', 'error');
        window.location.hash = '#/';
        return;
      }
      
      viewportMount.innerHTML = EditorComponent(post);
      setupEditorListeners(post.id);
    } catch (err) {
      showToast('Could not load narrative properties.', 'error');
      window.location.hash = '#/';
    }
  } else {
    viewportMount.innerHTML = EditorComponent();
    setupEditorListeners();
  }
}

// Setup real-time listeners inside Editor
function setupEditorListeners(postId = null) {
  const form = document.getElementById('editor-form');
  const textarea = document.getElementById('editor-content');
  const previewPanel = document.getElementById('editor-preview-panel');
  const titleInput = document.getElementById('editor-title');

  // Real-time interactive preview updater helper
  const updatePreview = () => {
    const textVal = textarea.value;
    const titleVal = titleInput.value || 'Untitled Story';
    
    if (!textVal.trim() && !titleInput.value.trim()) {
      previewPanel.innerHTML = `<div class="editor-preview-empty">Your live render will display here as you write.</div>`;
      return;
    }

    previewPanel.innerHTML = `
      <article>
        <h1 style="font-size: 2.2rem; margin-bottom: 20px; font-family: var(--font-display);">${titleVal}</h1>
        <div class="post-detail-content">
          ${parseMarkdown(textVal)}
        </div>
      </article>
    `;
  };

  // Attach preview listeners
  textarea.addEventListener('input', updatePreview);
  titleInput.addEventListener('input', updatePreview);
  
  // Run once initially if editing
  if (postId) updatePreview();

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const coverImage = document.getElementById('editor-cover').value.trim();
    const tags = document.getElementById('editor-tags').value.trim();
    const content = textarea.value;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing Narrative...';

    try {
      if (postId) {
        await api.updatePost(postId, title, content, coverImage, tags);
        showToast('Story updated successfully.', 'success');
        window.location.hash = `#/post/${postId}`;
      } else {
        const newPost = await api.createPost(title, content, coverImage, tags);
        showToast('Story published to Aether feed.', 'success');
        window.location.hash = `#/post/${newPost.id}`;
      }
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = postId ? 'Save Refinements' : 'Publish to Feed';
    }
  });
}

// 4. User Dashboard View
async function renderDashboard() {
  viewportMount.innerHTML = `<div style="text-align: center; padding: 60px;">Analyzing creator stats...</div>`;
  
  try {
    const posts = await api.getPosts();
    // Filter posts authored by user (handle string or number formats safely)
    const userPosts = posts.filter(p => String(p.author_id) === String(state.currentUser.id));
    
    viewportMount.innerHTML = DashboardComponent(userPosts, state.currentUser);
    
    // Bind Delete Post Buttons on Dashboard list
    const deleteButtons = viewportMount.querySelectorAll('.dashboard-delete-post-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm('Confirm permanent deletion of this story? This cannot be undone.')) {
          try {
            await api.deletePost(id);
            showToast('Narrative deleted.', 'success');
            renderDashboard(); // Reload view
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

  } catch (err) {
    showToast('Failed to load portfolio indexes.', 'error');
  }
}

// --- Navigation bar manager ---
function renderNavbar() {
  navbarMount.innerHTML = NavbarComponent(state.currentUser);
  
  // Re-bind login triggers
  const triggerLoginBtn = document.getElementById('trigger-login-btn');
  if (triggerLoginBtn) {
    triggerLoginBtn.addEventListener('click', () => openAuthModal(false));
  }

  // Handle avatar menu dropdown
  const avatarBtn = document.getElementById('navbar-avatar-btn');
  const dropdown = document.getElementById('navbar-dropdown');
  
  if (avatarBtn && dropdown) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    // Close on click outside
    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });
  }

  // Bind logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      api.logout();
      state.currentUser = null;
      showToast('Logged out of session. Safe travels!', 'success');
      renderNavbar();
      
      // If on write/dashboard pages, redirect to feed
      const hash = window.location.hash;
      if (hash === '#/write' || hash === '#/dashboard' || hash.startsWith('#/edit/')) {
        window.location.hash = '#/';
      } else {
        handleRouting(); // Reload current view
      }
    });
  }

  // Bind search input events
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = state.activeSearchQuery;
    
    // Input event for instant dynamic search experience (de-bounced)
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      state.activeSearchQuery = e.target.value;
      
      timeout = setTimeout(() => {
        // Only trigger update if we are on the Home Feed
        if (window.location.hash.startsWith('#/') && !window.location.hash.includes('/post/') && !window.location.hash.includes('/edit/')) {
          renderHomeFeed();
        } else {
          // If user searches elsewhere, redirect to home feed with search active
          window.location.hash = '#/';
        }
      }, 350);
    });
  }
}

// --- Full Screen Login Overlay Manager ---
function openAuthModal(signupMode = false) {
  authModal.classList.remove('hidden');
  toggleAuthTab(signupMode);
}

function toggleAuthTab(signupMode = false) {
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  if (signupMode) {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  } else {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  }
}

// Bind Global Auth Modal Event Listeners
function setupAuthModalListeners() {
  const closeBtn = document.getElementById('close-auth-btn');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  closeBtn.addEventListener('click', () => {
    authModal.classList.add('hidden');
  });

  // Clicking outside card closes modal
  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
      authModal.classList.add('hidden');
    }
  });

  tabLogin.addEventListener('click', () => toggleAuthTab(false));
  tabSignup.addEventListener('click', () => toggleAuthTab(true));

  // Submit Login Form
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userOrEmail = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;
    
    const submitBtn = loginForm.querySelector('.auth-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authorizing...';

    try {
      const user = await api.login(userOrEmail, pass);
      state.currentUser = user;
      showToast(`Welcome back, ${user.username}!`, 'success');
      authModal.classList.add('hidden');
      
      // Reset forms
      loginForm.reset();
      
      // Re-render nav & routing
      renderNavbar();
      handleRouting();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Authorize Session';
    }
  });

  // Submit Signup Form
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userVal = document.getElementById('signup-user').value.trim();
    const emailVal = document.getElementById('signup-email').value.trim();
    const passVal = document.getElementById('signup-pass').value;

    const submitBtn = signupForm.querySelector('.auth-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';

    try {
      const user = await api.register(userVal, emailVal, passVal);
      state.currentUser = user;
      showToast(`Welcome to Aether, ${user.username}!`, 'success');
      authModal.classList.add('hidden');
      
      // Reset forms
      signupForm.reset();
      
      // Re-render nav & routing
      renderNavbar();
      handleRouting();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register Identity';
    }
  });
}

// --- Application Core Bootstrap ---
async function bootstrapApp() {
  // Setup Overlay tabs
  setupAuthModalListeners();
  
  // Inspect user session cache on startup
  try {
    const verifiedUser = await api.checkAuthStatus();
    state.currentUser = verifiedUser;
  } catch (err) {
    console.warn('Initial session check failed.');
  }

  // Setup routing bindings
  window.addEventListener('hashchange', handleRouting);
  
  // Render primary navigation
  renderNavbar();

  // Load active view
  handleRouting();
}

// Trigger startup once DOM completes
document.addEventListener('DOMContentLoaded', bootstrapApp);
