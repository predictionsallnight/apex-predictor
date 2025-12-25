# How to Push Updates to GitHub

Follow these steps to push your script updates to GitHub:

## Prerequisites

1. **Install Git** (if not already installed):
   - Mac: `brew install git` or download from [git-scm.com](https://git-scm.com)
   - Windows: Download from [git-scm.com](https://git-scm.com)
   - Linux: `sudo apt install git`

2. **Create GitHub Repository** (if you haven't already):
   - Go to [github.com](https://github.com)
   - Click "+" → "New repository"
   - Name it (e.g., `apex-predictor`)
   - Make it **Public**
   - Click "Create repository"
   - **Don't** initialize with README (we already have one)

## First-Time Setup (One Time Only)

Open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
# Navigate to your project folder
cd /Users/caysonbrown/tampermonkeyss

# Initialize Git repository
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit - ApexPredictor v4.0.0"

# Add your GitHub repository as remote (replace with YOUR username and repo name)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note**: Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

## Pushing Updates (Every Time You Make Changes)

After you edit `bloxscript.js` and want to push updates:

```bash
# Navigate to your project folder
cd /Users/caysonbrown/tampermonkeyss

# Check what files changed
git status

# Add the changed file(s)
git add bloxscript.js

# Or add all changes
git add .

# Commit with a message describing the change
git commit -m "Update to v4.0.1 - Fixed profile detection bug"

# Push to GitHub
git push
```

## Quick Reference Commands

```bash
# See what changed
git status

# Add specific file
git add bloxscript.js

# Add all changes
git add .

# Commit changes
git commit -m "Your commit message here"

# Push to GitHub
git push

# See commit history
git log
```

## Example Workflow

Let's say you fixed a bug and updated the version:

1. **Edit the file**: Update `bloxscript.js` and change version to `4.0.1`
2. **Add changes**: `git add bloxscript.js`
3. **Commit**: `git commit -m "Update to v4.0.1 - Fixed mines prediction bug"`
4. **Push**: `git push`

That's it! Users will get the update automatically.

## Authentication

If Git asks for credentials:

**Option 1: Personal Access Token (Recommended)**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` permissions
3. Use token as password when Git asks

**Option 2: GitHub CLI**
```bash
# Install GitHub CLI
brew install gh  # Mac
# or download from github.com/cli/cli

# Authenticate
gh auth login
```

## Troubleshooting

**"fatal: not a git repository"**
- Run `git init` first

**"remote origin already exists"**
- Your remote is already set up, just use `git push`

**"Permission denied"**
- Check your GitHub credentials
- Use Personal Access Token instead of password

**"Updates rejected"**
- Someone else pushed changes? Run `git pull` first, then `git push`

## Pro Tips

1. **Always update version number** before pushing
2. **Write clear commit messages** describing what changed
3. **Test locally** before pushing
4. **Push frequently** - don't wait too long between updates

## Need Help?

- Git documentation: [git-scm.com/doc](https://git-scm.com/doc)
- GitHub guides: [guides.github.com](https://guides.github.com)

