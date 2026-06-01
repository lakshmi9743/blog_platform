const db = require('./db');
const bcrypt = require('bcryptjs');

const seed = async () => {
  console.log('Seeding database with expanded premium content (Clean rebuild)...');
  
  // Wait for database initialization
  let checks = 0;
  while (!db.isReady && checks < 20) {
    await new Promise(r => setTimeout(r, 100));
    checks++;
  }

  // Clear existing records by dropping tables inside SQLite/JSON
  console.log('Rebuilding database schemas...');
  try {
    if (db.isJson) {
      // For JSON database, we can clear the memory lists
      const fs = require('fs');
      const path = require('path');
      const JSON_DB_PATH = path.join(__dirname, 'data', 'database.json');
      if (fs.existsSync(JSON_DB_PATH)) {
        fs.writeFileSync(JSON_DB_PATH, JSON.stringify({ users: [], posts: [], comments: [] }, null, 2), 'utf8');
        console.log('Cleared JSON database.');
      }
    } else {
      // For SQLite database, let's connect and drop tables to rebuild fresh
      const sqlite3 = require('sqlite3');
      const path = require('path');
      const SQLITE_DB_PATH = path.join(__dirname, 'data', 'blog.db');
      
      const clearDb = new sqlite3.Database(SQLITE_DB_PATH);
      await new Promise((resolve, reject) => {
        clearDb.serialize(() => {
          clearDb.run('DROP TABLE IF EXISTS comments');
          clearDb.run('DROP TABLE IF EXISTS posts');
          clearDb.run('DROP TABLE IF EXISTS users', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
      clearDb.close();
      console.log('Dropped SQLite tables successfully.');
    }
  } catch (err) {
    console.warn('Warning during schema cleanup, continuing:', err);
  }

  // Wait a moment for tables to clear and adapters to re-initialize
  await new Promise(r => setTimeout(r, 1000));

  // Re-initialize main DB instances if using SQLite
  if (!db.isJson) {
    try {
      // Re-trigger the setup inside db.js by reloading schemas
      const path = require('path');
      const fs = require('fs');
      const sqlite3 = require('sqlite3');
      const SQLITE_DB_PATH = path.join(__dirname, 'data', 'blog.db');
      const initDb = new sqlite3.Database(SQLITE_DB_PATH);
      
      await new Promise((resolve, reject) => {
        initDb.serialize(() => {
          initDb.run(`
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE NOT NULL,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              avatar_color TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          initDb.run(`
            CREATE TABLE IF NOT EXISTS posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              content TEXT NOT NULL,
              cover_image TEXT,
              author_id INTEGER NOT NULL,
              author_name TEXT NOT NULL,
              tags TEXT,
              read_time INTEGER DEFAULT 5,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(author_id) REFERENCES users(id)
            )
          `);
          initDb.run(`
            CREATE TABLE IF NOT EXISTS comments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              post_id INTEGER NOT NULL,
              author_id INTEGER NOT NULL,
              author_name TEXT NOT NULL,
              content TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
              FOREIGN KEY(author_id) REFERENCES users(id)
            )
          `, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
      initDb.close();
      console.log('Re-created SQLite tables successfully.');
    } catch (err) {
      console.error('Recreating SQLite tables failed:', err);
    }
  }

  // Check database adapters are active
  let reChecks = 0;
  while (!db.isReady && reChecks < 20) {
    await new Promise(r => setTimeout(r, 100));
    reChecks++;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 1. Create Pioneer user
  const pioneer = await db.users.create(
    'aether_pioneer', 
    'pioneer@aether.space', 
    passwordHash, 
    'linear-gradient(135deg, #7F00FF 0%, #E100FF 100%)' // Premium Neon Violet
  );
  console.log('User created: aether_pioneer');

  // 2. Create Design Explorer user
  const explorer = await db.users.create(
    'design_explorer', 
    'explorer@design.io', 
    passwordHash, 
    'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' // Electric Cyan
  );
  console.log('User created: design_explorer');

  // 3. Post 1: Glassmorphism (by pioneer)
  const post1 = await db.posts.create(
    'The Alchemy of Glassmorphism: Designing Interfaces for the Next Era',
    `# The Alchemy of Glassmorphism

User interfaces are evolving from static flat layers to multi-dimensional physical materials. Among these, **Glassmorphism** has emerged as the premier style for high-fidelity, high-end digital workspaces. By simulating translucent, frosted surfaces, glassmorphic interfaces introduce depth, hierarchy, and visual harmony.

Here is a look at the core principles that make glassmorphism look and feel incredibly premium:

## 1. Multi-layered Depth with Backdrop Filter
Standard transparency simply blends background colors. Glassmorphism relies on the CSS \`backdrop-filter: blur()\` property, which applies real-time Gaussian blurring to elements behind the glass. This helps isolate foreground text while maintaining ambient context:
\`\`\`css
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
\`\`\`

## 2. Harmonious HSL Lighting
Avoid generic grey or white borders. Premium designs employ thin translucent borders colored using **HSL (Hue, Saturation, Lightness)** values that match the ambient background hues. This anchors the card visually and makes it look like it's glowing.

> "A design feels premium not because of its complexity, but because of its absolute attention to micro-details like borders, shadows, and subtle lighting transitions."

## 3. Dynamic Glow Spheres
To maximize the glass effect, place animated neon light nodes (spheres) deep behind the layout. As these spheres float and pulse, their colors diffuse beautifully through the blurred frosted glass panels, giving the entire interface a living, breathing aura.

---

### Best Practices Checklist:
- Keep borders thin (e.g. 1px) and translucent.
- Establish hierarchy using different blur strengths (e.g. 10px to 30px).
- Pair with high-quality, high-contrast sans-serif typography like *Outfit* or *Inter*.

Try applying these styles in your next project to create experiences that leave a lasting impression!`,
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    pioneer.id,
    pioneer.username,
    ['design', 'css', 'aether', 'uiux'],
    4
  );
  console.log('Created Post 1: Glassmorphism');

  // 4. Post 2: Decoupled Architecture (by pioneer)
  const post2 = await db.posts.create(
    'Decoupled Architectures: Building Ultra-Responsive Single Page Apps',
    `# Decoupled Architectures

As the web continues to mature, users expect applications that respond instantly. Traditional multi-page applications suffer from network latency and full-page refreshes. By transitioning to a **decoupled Single Page Application (SPA)** architecture, we achieve exceptional user experiences.

## Why Decoupling Matters
In a decoupled stack, the backend acts solely as an API server, serving RESTful JSON endpoints. The frontend is a static bundle served instantly via CDN or static file servers. 

### The Core Strengths:
1. **Zero Layout Refreshes**: Only dynamic text content is downloaded and swapped into the DOM, making navigation feel local.
2. **Offline Resilience**: Since the page wrapper is cached, network drops don't break the entire page shell.
3. **Decoupled Scaling**: The API backend and frontend asset server can scale completely independently.

## Implementing Client-Side Routing
Using hash changes is one of the most robust, zero-configuration routing mechanisms available:
\`\`\`javascript
window.addEventListener('hashchange', () => {
  const hash = window.location.hash;
  if (hash === '#/dashboard') renderDashboard();
  else renderFeed();
});
\`\`\`
This approach guarantees that bookmarks, page refreshes, and back/forward browser arrows work seamlessly, without requiring server-side fallback rules for arbitrary routes.

---

*Explore this blogging platform to see how fast a pure ES6 decoupled architecture can render interactive comments and rich markdown.*`,
    'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=1200&q=80',
    pioneer.id,
    pioneer.username,
    ['architecture', 'javascript', 'performance'],
    3
  );
  console.log('Created Post 2: Decoupled SPA');

  // 5. Post 3: Rise of HSL (by explorer)
  const post3 = await db.posts.create(
    'The Rise of HSL: Why Hex Codes Are Holding Your Styles Back',
    `# The Rise of HSL in CSS

For decades, web designers have relied on Hexadecimal codes (\`#ff007f\`) or RGB (\`rgb(255, 0, 127)\`) to declare colors. While functional, these systems are fundamentally opaque to humans. If I ask you to make \`#5c3d99\` 20% lighter, it is nearly impossible to do without an external color picker.

Enter **HSL (Hue, Saturation, Lightness)**. HSL represents color in a way that matches human intuition and enables math-based dynamic styling.

## Understanding HSL Parameters
1. **Hue (0 - 360)**: The position on the color wheel. Red is 0, Green is 120, Blue is 240.
2. **Saturation (0% - 100%)**: The intensity of the color. 0% is complete grey, 100% is full color.
3. **Lightness (0% - 100%)**: The brightness. 0% is pure black, 50% is the pure hue, and 100% is pure white.

\`\`\`css
/* Pure Neon Magenta in HSL */
--color-neon: hsl(340, 100%, 50%);
\`\`\`

## The Magic of CSS Variable Math
Because HSL parameters are simple numbers, you can easily calculate variations (like hover states, disabled overlays, and shadow glows) using CSS custom properties:

\`\`\`css
:root {
  --hue: 263; /* Purple */
  --sat: 90%;
  --light: 60%;
  
  --base-color: hsl(var(--hue), var(--sat), var(--light));
  
  /* Instantly calculate a 15% darker color for hover states! */
  --hover-color: hsl(var(--hue), var(--sat), calc(var(--light) - 15%));
  
  /* Calculate a translucent overlay using HSLA! */
  --border-light: hsla(var(--hue), var(--sat), 90%, 0.15);
}
\`\`\`

## Interactive Themes
By changing just the \`--hue\` variable inside a media query or a dynamic JS selector, you can instantly re-theme your entire application from violet to teal, without rewriting a single line of border, text, or background CSS.

---

### Summary:
Hex codes are a relic of computer-first color encoding. HSL is a designer-first toolkit. Once you make the transition to HSL, you will never write a Hex code again!`,
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
    explorer.id,
    explorer.username,
    ['css', 'styling', 'design'],
    5
  );
  console.log('Created Post 3: Rise of HSL');

  // 6. Post 4: Finite State Machines (by pioneer)
  const post4 = await db.posts.create(
    'Finite State Machines: Eradicating Boolean Spaghetti in Modern UI',
    `# Finite State Machines in Frontend Development

We have all written code that starts simple but slowly devolves into spaghetti. You have a button. As the user clicks it, it needs to show a spinner, lock inputs, and fetch some details. 

To solve this, we add booleans:
\`\`\`javascript
let isLoading = false;
let isError = false;
let isSuccess = false;
let isDisabled = false;
\`\`\`

Before you know it, you are managing complex conditional logic: \`if (isLoading && !isError && (isSuccess || isDisabled))\`. This boolean-soup makes applications fragile and nearly impossible to debug.

## The State Machine Paradigm
A **Finite State Machine (FSM)** resolves this by declaring that a component can only exist in **exactly one** of a finite set of predefined states at any given moment. Changes between states are triggered by explicit "Events."

### The Core States of a Button Fetcher:
- \`idle\`: Ready for user interaction.
- \`loading\`: Network request in progress. Inputs locked.
- \`success\`: Completed successfully. Display success overlay.
- \`failure\`: Error caught. Enable retry path.

## Standard Machine Declaration
By declaring transitions in a mapping object, you can prevent illegal transitions (like a double-click event firing while a load is already active!):

\`\`\`javascript
const buttonMachine = {
  initial: 'idle',
  states: {
    idle: {
      on: { CLICK: 'loading' }
    },
    loading: {
      on: { FETCH_SUCCESS: 'success', FETCH_ERROR: 'failure' }
    },
    success: {
      on: { RESET: 'idle' }
    },
    failure: {
      on: { RETRY: 'loading' }
    }
  }
};
\`\`\`

## The Benefits
1. **Absolute Reliability**: It is structurally impossible to fire double submissions because the \`loading\` state does not respond to \`CLICK\` events.
2. **Transparent Testing**: You can map out every single user flow in a diagram and automate unit testing for every state node.
3. **Decoupled Logic**: Your UI rendering simply checks \`state === 'loading'\` to apply disabled styles and spinners.

---

FSMs require a small initial investment in design, but pay massive dividends in reducing production bugs and spaghetti dependencies.`,
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
    pioneer.id,
    pioneer.username,
    ['architecture', 'javascript', 'engineering'],
    4
  );
  console.log('Created Post 4: State Machines');

  // 7. Post 5: Micro-Animations (by explorer)
  const post5 = await db.posts.create(
    'Micro-Animations: Delighting Users with Layout-Morphs and Glows',
    `# The Magic of Micro-Animations

What separates an ordinary utility application from a premium software experience that users rave about? 

Often, it is not a difference in features, but rather the **presence of micro-animations**. These are subtle, brief visual transitions that respond to user actions. They act as feedback mechanisms, confirming inputs while introducing a sense of fluid physical weight.

## 1. Interactive Button Hover Transitions
Instead of sudden background color swaps, premium buttons utilize dual transition properties and subtle scaling lifts:
\`\`\`css
.glow-button {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
              box-shadow 0.3s ease;
}
.glow-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(139, 92, 246, 0.4);
}
\`\`\`
This makes the button feel like it's physical, reacting dynamically to the pointer hover pressure.

## 2. Dynamic Glow Diffusions
By adding glowing ambient containers behind glass elements, we can create depth. Moving your cursor can slightly shift the focal center of the underlying glow, giving the illusion of responsive backlighting.

> "Animation is like seasoning. Too little makes the design flat and clinical; too much makes it chaotic. The sweet spot is a transition that lasts between 150ms to 350ms, using smooth ease-out or cubic-bezier curves."

## 3. Form Input Active Borders
When a user focuses an input, avoid jarring thick borders. Instead, transition the border color from semi-transparent HSL to glowing violet, while adding a very soft, blurry box-shadow glow inside the input box. This guides the user's attention focus elegantly.

---

Micro-animations are the ultimate polish layer in modern web design. They elevate standard layouts into memorable, high-fidelity products that users love interacting with!`,
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    explorer.id,
    explorer.username,
    ['uiux', 'animations', 'frontend'],
    3
  );
  console.log('Created Post 5: Micro-Animations');

  // 8. Add Comments
  await db.comments.create(
    post1.id,
    explorer.id,
    explorer.username,
    'This layout is absolutely stunning! The backdrop-filter blur combined with HSL borders feels so premium. Excellent breakdown on the HSL lighting!'
  );
  await db.comments.create(
    post1.id,
    pioneer.id,
    pioneer.username,
    'Thank you so much! Really glad you liked the HSL breakdown. It makes a huge difference in anchoring translucent elements.'
  );

  await db.comments.create(
    post3.id,
    pioneer.id,
    pioneer.username,
    'Absolutely agree! I transitioned all my hex variables to HSL components last year and it has cut my theme styling sheets in half. Calculating light/dark states is pure magic.'
  );

  await db.comments.create(
    post5.id,
    pioneer.id,
    pioneer.username,
    'Great tips on timing! I see so many sites running 600ms transitions which feels incredibly sluggish. That 150-300ms sweet spot is perfect.'
  );
  
  console.log('Comments seeded successfully.');
  console.log('Database expanded seeding completed successfully! ✨');
  process.exit(0);
};

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
