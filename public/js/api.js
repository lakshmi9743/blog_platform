const TOKEN_KEY = 'aether_session_token';
const USER_KEY = 'aether_session_user';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY) || null;
    this.user = JSON.parse(localStorage.getItem(USER_KEY)) || null;
  }

  setSession(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  isAuthenticated() {
    return this.token !== null && this.user !== null;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `/api/${endpoint}`;
    const headers = this.getHeaders();
    const config = {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  }

  // Auth Operations
  async register(username, email, password) {
    const data = await this.request('auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
    this.setSession(data.token, data.user);
    return data.user;
  }

  async login(usernameOrEmail, password) {
    const data = await this.request('auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password })
    });
    this.setSession(data.token, data.user);
    return data.user;
  }

  logout() {
    this.setSession(null, null);
  }

  async checkAuthStatus() {
    if (!this.token) return null;
    try {
      const user = await this.request('auth/me');
      this.setSession(this.token, user);
      return user;
    } catch (err) {
      // Token expired or invalid
      this.logout();
      return null;
    }
  }

  // Posts Operations
  async getPosts(searchQuery = '', tagFilter = '') {
    let endpoint = 'posts';
    const params = [];
    if (searchQuery) params.push(`q=${encodeURIComponent(searchQuery)}`);
    if (tagFilter) params.push(`tag=${encodeURIComponent(tagFilter)}`);
    
    if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
    }
    
    return this.request(endpoint);
  }

  async getPost(id) {
    return this.request(`posts/${id}`);
  }

  async createPost(title, content, coverImage = '', tags = '') {
    return this.request('posts', {
      method: 'POST',
      body: JSON.stringify({ title, content, coverImage, tags })
    });
  }

  async updatePost(id, title, content, coverImage = '', tags = '') {
    return this.request(`posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, content, coverImage, tags })
    });
  }

  async deletePost(id) {
    return this.request(`posts/${id}`, {
      method: 'DELETE'
    });
  }

  // Comments Operations
  async addComment(postId, content) {
    return this.request(`comments/post/${postId}`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  async deleteComment(id) {
    return this.request(`comments/${id}`, {
      method: 'DELETE'
    });
  }
}

export const api = new ApiClient();
export default api;
