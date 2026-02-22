# Atharva Zaveri - Modern Portfolio Website

A stunning, professional portfolio website featuring a modern light theme design, integrated AI tech stack, and a full-featured admin dashboard for management.

Website: azaveri.dev

## 🎨 Features

### Portfolio Website (`index.html`)

- **Premium Cyber-Nature Theme**: Sophisticated light theme featuring a unique light-to-dark forest green gradient palette (Mint, Emerald, and Deep Forest Green).
- **Subtle Sage Background**: Custom-tinted background replacing sterile white for a more organic, high-end feel.
- **Glassmorphism UI**: Beautiful frosted-glass navigation and project cards.
- **Responsive Layout**: Fully optimized for mobile, tablet, and desktop viewing.
- **Centered Navigation**: Desktop navbar with perfectly centered links and dynamic active-state underlines.
- **Dynamic Projects**: 2x2 grid layout that pulls projects directly from the backend API.
- **Interactive Animations**:
  - Floating hero particles.
  - Smooth scroll-reveal effects.
  - Multi-stage typewriter effect for the hero tagline.
  - **Scroll-spy integration** that highlights the current section in the navigation bar.
  - **Refined Hero Content**: Including a prominent "Software Developer" title and a personalized greeting.
  - Advanced hover states with 3D scaling and brightness filters.

### Admin Dashboard (`admin.html`)

- **Secure Management**: Protected area for the portfolio owner to manage content.
- **Project CRUD Operations**:
  - **Create**: Add new projects with custom tech tags and links.
  - **Read**: View all live projects in an organized dashboard.
  - **Update**: Edit existing project titles, descriptions, and technologies.
  - **Delete**: Remove outdated projects instantly.
- **Resume Management**: Drag-and-drop PDF upload that automatically updates all resume links across the site.
- **Contact Monitoring**: Backend integration for receiving and routing contact form messages.

## 🛠️ Technical Stack

- **Frontend**:
  - HTML5 (Semantic Structure)
  - CSS3 (Custom Properties, Grid, Flexbox, Glassmorphism)
  - Vanilla JavaScript (Async/Await, Intersection Observer, Canvas API)
- **Backend**:
  - **FastAPI** (Python 3.10+)
  - **Uvicorn** (ASGI Server)
  - **Resend SDK** (Email notifications)
- **Data & Assets**:
  - JSON-based file persistence for projects and resume metadata.
  - Custom assets for high-end AI tool visualization (FAISS, Ollama, Claude, Gemini API, etc.) with uniform card styling.

## 🚀 Getting Started

### Prerequisites

- Python 3.10 or higher
- Pip (Python package manager)
- A [Resend](https://resend.com/) API key for contact form functionality.

### Installation & Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/AtharvaZ/Portfolio_website.git
   cd Portfolio_website
   ```

2. **Set up a virtual environment**:

   ```bash
   python3 -m venv venv
   source venv/bin/activate  # Mac/Linux
   # or
   .\venv\Scripts\activate   # Windows
   ```

3. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Create a `.env` file in the root directory:

   ```env
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_secure_password
   EMAIL_SECRET_KEY=re_your_resend_api_key
   RECIPIENT_EMAIL=your_email@example.com
   RESEND_FROM_EMAIL=onboarding@resend.dev
   ```

5. **Run the application**:
   ```bash
   python3 backend.py
   ```
   The site will be available at `http://localhost:8000`.

## 📁 Project Structure

```
Personal_website/
├── assets/             # Custom tech icons and images
├── data/               # Persistent JSON storage
├── index.html          # Main portfolio
├── admin.html          # Dashboard interface
├── styles.css          # Design system and layout
├── script.js           # Portfolio logic & API integration
├── admin.js            # Dashboard CRUD logic
├── backend.py          # FastAPI server & Email handling
└── requirements.txt    # Python dependencies
```

## � Deployment & Cache Management

When deploying updates to production, browsers like Brave may aggressively cache static files. The application includes built-in cache-busting mechanisms:

### Cache Control Headers

- HTML files: `no-cache, no-store, must-revalidate` (always check for updates)
- CSS/JS files: `no-cache, must-revalidate` (revalidate on each request)
- Images: `public, max-age=86400` (cache for 24 hours)

### Version Parameters

CSS and JS files include version query parameters (e.g., `styles.css?v=1.0.1`).

**After making changes to CSS or JS files:**

1. Update the version number in both `index.html` and `admin.html`
2. Change `?v=1.0.1` to `?v=1.0.2` (or any new value)
3. Deploy the updated files

**Force browser refresh for users:**

- Users can clear cache: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Hard reload in Brave: Settings → Privacy & Security → Clear browsing data → Cached images and files

## �🔐 Security Note

The admin dashboard uses token-based session management. For a production environment, ensure the `.env` file is never committed to version control and consider implementing HTTPS and more robust JWT-based authentication.

---

**Designed & Built by Atharva Zaveri**
