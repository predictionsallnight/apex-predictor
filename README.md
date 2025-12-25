# ApexPredictor - Elite Pro Edition 2025

Premium prediction system for bloxgame.us with Firebase authentication and advanced pattern-based predictions.

## 🎮 Supported Games

- **Mines** - 6 unique prediction algorithms with data collection
- **Crash** - Advanced pattern-based predictions with round tracking

## 🚀 Quick Start

### For Users

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click the Tampermonkey icon → "Create a new script"
3. Replace the code with the contents of `bloxscript.js`
4. Save the script (Ctrl+S or Cmd+S)
5. Visit [bloxgame.us](https://bloxgame.us) and navigate to a supported game
6. The script will auto-update when new versions are released!

### For Developers

1. Clone this repository
2. Make your changes to `bloxscript.js`
3. Update the `@version` number in the script header
4. Commit and push to GitHub
5. Users will automatically receive the update!

## 📋 Setup Instructions

### GitHub Hosting

1. Create a new GitHub repository
2. Upload `bloxscript.js` to the repository
3. Get the raw file URL:
   - Go to your file on GitHub
   - Click the "Raw" button
   - Copy the URL (e.g., `https://raw.githubusercontent.com/username/repo/main/bloxscript.js`)
4. Update the script header in `bloxscript.js`:
   ```javascript
   // @updateURL    https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/bloxscript.js
   // @downloadURL https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/bloxscript.js
   ```
5. Replace `YOUR_USERNAME` and `YOUR_REPO` with your actual GitHub username and repository name
6. Commit and push the changes

### Firebase Setup

The script requires Firebase configuration. Make sure you have:

1. Firebase project created
2. Firestore database set up with these collections:
   - `whitelist_codes` - Stores activation codes
   - `whitelist` - Stores whitelisted user UIDs
   - `users` - Stores user account information
   - `payment_sessions` - Tracks payment sessions
3. Firestore security rules configured (see `FIRESTORE_RULES_FIX.md`)
4. Firebase config added to the script (already included)

### Vercel Setup (For Payment Flow)

1. Deploy the `vercel-website` folder to Vercel
2. Set up environment variables:
   - `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON
3. Configure Stripe payment link
4. Update success redirect URL in Stripe

## 🔐 Security

- All verification is server-side (Firebase)
- Whitelist codes are generated server-side
- UID verification checks Firebase database
- Even if code is public, users cannot bypass authentication

## 📝 Version History

### v4.0.0 - Christmas Update
- ✅ Mines game support with 6 prediction algorithms
- ✅ Crash game support with pattern-based predictions
- ✅ New modern UI design
- ✅ Secure UID-based verification process
- ✅ Welcome screen for non-game pages
- ✅ Auto-update system via GitHub

### Next Update (Coming Soon)
- 🎨 Better UI improvements
- 🧠 Enhanced prediction methods
- 📊 Improved data collection
- 🏗️ Towers game support

## 🛠️ Development

### Making Updates

1. Edit `bloxscript.js`
2. **Important**: Update the `@version` number (e.g., `4.0.0` → `4.0.1`)
3. Test your changes locally
4. Commit and push to GitHub
5. Users will receive the update automatically within a few hours

### Version Numbering

- `MAJOR.MINOR.PATCH` format
- Increment PATCH for bug fixes (4.0.0 → 4.0.1)
- Increment MINOR for new features (4.0.0 → 4.1.0)
- Increment MAJOR for breaking changes (4.0.0 → 5.0.0)

## 📄 License

Private - All rights reserved

## ⚠️ Important Notes

- The script requires a valid whitelist code to function
- Users must complete the payment flow to receive a code
- UID verification is required for full access
- The script only works on bloxgame.us domains

## 🐛 Troubleshooting

### Script not updating?
- Check that the version number changed
- Users can manually check: Tampermonkey → Dashboard → Check for userscript updates

### Verification not working?
- Ensure Firebase is properly configured
- Check Firestore security rules
- Verify whitelist code exists in database

### Game not detected?
- Make sure you're on the actual game page (not profile/settings)
- Check browser console for errors

## 📞 Support

For issues or questions, please contact the developer.

