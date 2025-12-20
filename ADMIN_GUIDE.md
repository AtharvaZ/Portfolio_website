# Admin Dashboard Quick Reference

## 🔐 Login Credentials
- **Username**: `admin`
- **Password**: `password123`

## 📋 Features Overview

### 1. Resume Management
- **Upload**: Drag and drop a PDF file or click to browse
- **Format**: Only PDF files are accepted
- **Storage**: Resume is stored in browser's localStorage as base64
- **Status**: Green text indicates successful upload

### 2. Project Management

#### Add New Project
1. Fill in the form fields:
   - **Project Title**: Name of your project
   - **Description**: Brief description of the project
   - **Tech Stack**: Comma-separated list (e.g., "React, Node.js, MongoDB")
   - **GitHub Link**: URL to your GitHub repository
   - **Live Demo Link**: URL to the live project
2. Click **"Add Project"** button
3. Project appears in the list below

#### Edit Existing Project
1. Scroll to "Existing Projects" section
2. Click **"Edit"** button on the project you want to modify
3. Form will populate with current project data
4. Make your changes
5. Click **"Update Project"** button
6. Click **"Cancel"** to abort editing

#### Delete Project
1. Find the project in "Existing Projects" section
2. Click **"Delete"** button
3. Confirm the deletion in the popup dialog
4. Project is permanently removed

### 3. Viewing Changes
- Open `index.html` in a new tab to see your changes
- Changes are instant - just refresh the portfolio page
- All changes persist in browser localStorage

## 💡 Tips & Best Practices

### Project Descriptions
- Keep descriptions concise (60-150 words)
- Highlight key features and technologies
- Mention the problem solved or value added

### Tech Stack
- Use comma-separated values
- Be specific (e.g., "React.js" instead of just "React")
- List 3-5 main technologies per project

### Links
- Always use full URLs with `https://`
- Test links before saving
- Use `#` as placeholder if link not available yet

### Resume Upload
- Use a professional, up-to-date PDF
- Keep file size under 5MB for best performance
- Name your file professionally (e.g., "John_Doe_Resume.pdf")

## 🔄 Data Management

### Backup Your Data
To backup your projects and resume:
1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Copy the values of:
   - `portfolio_projects`
   - `portfolio_resume_data`
4. Save to a text file

### Restore Data
1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Paste your saved values back
4. Refresh the page

### Reset to Defaults
To reset everything:
1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Right-click and select "Clear"
4. Refresh the page

## ⚠️ Important Notes

- **Data is stored locally**: Clearing browser data will delete all projects and resume
- **No backend**: This is a client-side only application
- **Security**: Default credentials should be changed for production use
- **Browser specific**: Data doesn't sync across different browsers
- **Private browsing**: Data won't persist in incognito/private mode

## 🐛 Troubleshooting

### Projects not showing on portfolio
- Check browser console for errors (F12)
- Verify localStorage has data (DevTools → Application)
- Hard refresh the portfolio page (Ctrl+Shift+R or Cmd+Shift+R)

### Can't login
- Verify credentials: `admin` / `password123`
- Check browser console for JavaScript errors
- Try clearing session storage and refreshing

### Resume not uploading
- Ensure file is PDF format
- Check file size (should be under 5MB)
- Verify browser supports FileReader API

### Changes not persisting
- Check if you're in private/incognito mode
- Verify localStorage is enabled in browser settings
- Check available storage quota

## 🎯 Workflow Recommendations

### Initial Setup
1. Login to admin dashboard
2. Upload your resume
3. Delete default projects
4. Add your real projects (start with 2-4)
5. Preview on portfolio page
6. Refine descriptions and links

### Regular Updates
1. Add new projects as you complete them
2. Update project descriptions with new features
3. Keep tech stack current
4. Refresh resume periodically

### Before Sharing
1. Verify all links work
2. Check for typos in descriptions
3. Ensure resume is current
4. Test on mobile devices
5. Share the `index.html` URL (not admin.html!)

## 📞 Need Help?

Common questions:
- **Q**: Can I add more than 4 projects?
  - **A**: Yes! The grid will automatically adjust. However, 4-6 projects is recommended for best visual impact.

- **Q**: Can I add images to projects?
  - **A**: Currently, projects show placeholder images. You can modify the code to add actual images.

- **Q**: Is my data secure?
  - **A**: Data is stored locally in your browser. It's as secure as your computer, but not suitable for sensitive information.

- **Q**: Can I use this for a client?
  - **A**: Yes! This is open source and free to use for personal and commercial projects.

---

**Happy portfolio building! 🚀**
