# Modern Portfolio Website with Admin Dashboard

A stunning, modern portfolio website featuring a light theme design with a full-featured admin dashboard for managing projects and resume uploads.

## 🎨 Features

### Portfolio Website (`index.html`)
- **Modern Light Theme**: Clean, professional design with a unique color palette
- **Responsive Layout**: Fully responsive across all devices
- **Smooth Animations**: Scroll-reveal animations and particle effects
- **Hero Section**: Eye-catching hero with typewriter effect
- **About Section**: Showcase your background and expertise
- **Projects Grid**: 2x2 grid layout displaying your featured projects
- **Skills Section**: Display your tech stack with interactive hover effects
- **Contact Form**: Professional contact form with social media links

### Admin Dashboard (`admin.html`)
- **Secure Login**: Protected admin area with username/password authentication
- **Project Management**: Full CRUD operations for portfolio projects
  - ✅ Create new projects
  - ✅ Read/View existing projects
  - ✅ Update project details
  - ✅ Delete projects
- **Resume Upload**: Drag-and-drop PDF resume upload functionality
- **Real-time Updates**: Changes reflect immediately on the portfolio

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (Python, Node.js, or any HTTP server)

### Installation

1. **Clone or download** this repository to your local machine

2. **Start a local web server** in the project directory:

   **Using Python 3:**
   ```bash
   python3 -m http.server 8000
   ```

   **Using Node.js (http-server):**
   ```bash
   npx http-server -p 8000
   ```

3. **Open your browser** and navigate to:
   - Portfolio: `http://localhost:8000/index.html`
   - Admin Dashboard: `http://localhost:8000/admin.html`

## 🔐 Admin Access

**Default Login Credentials:**
- Username: `admin`
- Password: `password123`

> ⚠️ **Security Note**: For production use, implement proper backend authentication and change these default credentials!

## 📁 Project Structure

```
Personal_website/
├── index.html          # Main portfolio page
├── admin.html          # Admin dashboard
├── styles.css          # Main stylesheet (light theme)
├── admin.css           # Admin-specific styles
├── script.js           # Portfolio functionality
├── admin.js            # Admin dashboard logic
└── README.md           # This file
```

## 🎯 Customization Guide

### 1. Update Personal Information

**In `index.html`:**
- Line 49: Replace `"Your Name"` with your actual name
- Line 66: Update `[Your Background]` with your background
- Lines 110-113: Add your social media links

### 2. Customize Colors

**In `styles.css` (lines 6-18):**
```css
:root {
    --accent-primary: #3B82F6;    /* Primary color */
    --accent-secondary: #F97316;  /* Secondary color */
    --accent-tertiary: #1F2937;   /* Tertiary color */
}
```

### 3. Add/Edit Projects

**Option A: Using Admin Dashboard (Recommended)**
1. Navigate to `admin.html`
2. Login with credentials
3. Use the "Add New Project" form
4. Fill in project details and submit

**Option B: Manually in Code**

Edit the `defaultProjects` array in both `script.js` (line 153) and `admin.js` (line 6):

```javascript
{
    id: 1,
    title: "Your Project Title",
    desc: "Project description",
    tech: ["React", "Node.js", "MongoDB"],
    links: { 
        github: "https://github.com/yourusername/project",
        demo: "https://yourproject.com"
    }
}
```

### 4. Update Skills

**In `script.js` (lines 239-242):**
```javascript
const skills = [
    "HTML5", "CSS3", "JavaScript", "React.js", 
    "Node.js", "Your", "Custom", "Skills"
];
```

## 💾 Data Storage

The website uses **localStorage** to persist data:
- `portfolio_projects`: Stores all project data
- `portfolio_resume_data`: Stores uploaded resume (base64 encoded)
- `portfolio_admin_auth`: Session authentication token

> 📝 **Note**: Data is stored locally in the browser. Clearing browser data will reset everything to defaults.

## 🎨 Design Philosophy

This portfolio follows modern web design principles:
- **Clean & Minimal**: Focus on content, not clutter
- **Professional**: Suitable for job applications and client presentations
- **Interactive**: Engaging hover effects and smooth animations
- **Accessible**: Semantic HTML and proper contrast ratios
- **Performance**: Optimized for fast loading

## 🔧 Technical Stack

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **Vanilla JavaScript**: No frameworks, pure JS
- **LocalStorage API**: Client-side data persistence
- **Canvas API**: Particle animation effects
- **Intersection Observer API**: Scroll-reveal animations

## 📱 Browser Support

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

## 🚀 Deployment

### GitHub Pages
1. Push your code to a GitHub repository
2. Go to Settings → Pages
3. Select your branch and save
4. Your site will be live at `https://yourusername.github.io/repository-name`

### Netlify
1. Drag and drop your project folder to [Netlify Drop](https://app.netlify.com/drop)
2. Your site will be live instantly with a custom URL

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your project directory
3. Follow the prompts

## 🎓 Learning Resources

This project demonstrates:
- Modern CSS techniques (Grid, Flexbox, Custom Properties)
- JavaScript DOM manipulation
- LocalStorage API usage
- Form handling and validation
- File upload with FileReader API
- Responsive design patterns
- Animation and transitions

## 📄 License

This project is open source and available for personal and commercial use.

## 🤝 Contributing

Feel free to fork this project and customize it for your own use!

## 📧 Support

If you encounter any issues or have questions, please open an issue in the repository.

---

**Made with ❤️ for developers who want to showcase their work beautifully**
