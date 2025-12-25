# GitHub Setup Guide

Follow these steps to set up your script for GitHub auto-updates:

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Name it (e.g., `apex-predictor`)
4. Choose **Public** (so users can access the raw file)
5. Click "Create repository"

## Step 2: Upload Your Script

1. In your new repository, click "uploading an existing file"
2. Drag and drop `bloxscript.js` into the upload area
3. Add a commit message: "Initial commit - ApexPredictor v4.0.0"
4. Click "Commit changes"

## Step 3: Get Raw File URL

1. Click on `bloxscript.js` in your repository
2. Click the **"Raw"** button (top right of the file view)
3. Copy the URL from your browser (it will look like):
   ```
   https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/bloxscript.js
   ```

## Step 4: Update Script Headers

1. Open `bloxscript.js` in your editor
2. Find these lines (near the top):
   ```javascript
   // @updateURL    https://raw.githubusercontent.com/yourusername/apex-predictor/main/bloxscript.js
   // @downloadURL https://raw.githubusercontent.com/yourusername/apex-predictor/main/bloxscript.js
   ```
3. Replace `yourusername` with your GitHub username
4. Replace `apex-predictor` with your repository name
5. Save the file

## Step 5: Push Updated Script

1. Commit the changes:
   ```bash
   git add bloxscript.js
   git commit -m "Update GitHub URLs"
   git push
   ```
   
   Or use GitHub's web interface:
   - Click "Edit" on the file
   - Make the changes
   - Commit

## Step 6: Test Installation

1. Copy your raw GitHub URL
2. In Tampermonkey, go to Dashboard
3. Click "Utilities" tab
4. Paste URL in "Install from URL"
5. Click "Install"
6. Verify it installed correctly

## Step 7: Future Updates

When you make changes:

1. Edit `bloxscript.js` locally
2. **IMPORTANT**: Update the version number:
   ```javascript
   // @version      4.0.0  →  // @version      4.0.1
   ```
3. Push to GitHub:
   ```bash
   git add bloxscript.js
   git commit -m "Update to v4.0.1 - Fixed profile detection"
   git push
   ```
4. Users will automatically receive the update within a few hours!

## Quick Reference

- **Raw URL Format**: `https://raw.githubusercontent.com/USERNAME/REPO/BRANCH/FILENAME`
- **Version Format**: `MAJOR.MINOR.PATCH` (e.g., `4.0.0`)
- **Update Check**: Tampermonkey checks every few hours automatically
- **Manual Check**: Users can click "Check for userscript updates" in Tampermonkey

## Troubleshooting

**Script not updating?**
- Make sure version number changed
- Wait a few hours (Tampermonkey checks periodically)
- Users can manually check for updates

**URL not working?**
- Make sure repository is **Public**
- Verify the file path is correct
- Check that the file exists in the repository

**Users can't install?**
- Share the raw GitHub URL (not the regular GitHub page URL)
- Make sure repository is public
- Verify the script header is correct

