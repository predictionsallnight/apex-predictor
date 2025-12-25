# How to Add Your Firebase Config to the Script

## Quick Steps

### 1. Get Config from Firebase

1. Firebase Console → Click **⚙️ gear icon** (top left)
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click **Web icon** (`</>`)
5. If you see "Register app" → Click it → Name it → Register
6. You'll see code that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

7. **COPY ALL OF IT** (select all, Ctrl+C / Cmd+C)

### 2. Paste Into Script

1. Open `bloxscript.js` in your editor
2. Find line ~20 that says:

```javascript
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY_HERE",
    ...
};
```

3. **Delete** all the placeholder text (`YOUR_API_KEY_HERE`, etc.)
4. **Paste** what you copied from Firebase
5. **Change** `firebaseConfig` to `FIREBASE_CONFIG` (if needed)
6. Save the file

### 3. Done!

Your script now has your Firebase connection! ✅

---

## What Each Value Means (You Don't Need to Know, But...)

- **apiKey**: Your project's API key
- **authDomain**: Where authentication happens
- **projectId**: Your project's ID
- **storageBucket**: Where files are stored (we don't use this)
- **messagingSenderId**: For push notifications (we don't use this)
- **appId**: Your app's unique ID

**Just copy and paste - you don't need to understand what they do!**

---

## Troubleshooting

### "Failed to initialize" Error
- Check that you pasted ALL the values
- Make sure there are no typos
- Make sure it says `FIREBASE_CONFIG` (all caps)

### Can't Find the Config
- Make sure you registered a Web app first
- Look in Project Settings → Your apps → Web section

### Script Still Not Working
- Double-check you saved the file
- Make sure you're using the script with the updated config
- Check browser console (F12) for errors

