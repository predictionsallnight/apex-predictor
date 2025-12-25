# Enable Auto-Whitelisting (Optional)

## What is Auto-Whitelisting?

Instead of manually adding users to the whitelist, the script can automatically create whitelist entries when users sign up.

## How to Enable

### Option 1: Enable for All Users

1. Open `bloxscript.js`
2. Find this line (around line 35):
   ```javascript
   const AUTO_WHITELIST_NEW_USERS = false;
   ```
3. Change it to:
   ```javascript
   const AUTO_WHITELIST_NEW_USERS = true;
   ```
4. Save the file

**Now every user who signs up will be automatically whitelisted!**

### Option 2: Auto-Whitelist Only Admin Emails

1. Open `bloxscript.js`
2. Find this line (around line 38):
   ```javascript
   const ADMIN_EMAILS = []; // Add your email here
   ```
3. Add your email:
   ```javascript
   const ADMIN_EMAILS = ['your-email@example.com'];
   ```
4. Keep `AUTO_WHITELIST_NEW_USERS = false` (or set to true for everyone)
5. Save the file

**Now only your email will be auto-whitelisted on first signup!**

## Update Firestore Security Rules

**IMPORTANT:** If you enable auto-whitelisting, you need to update Firestore security rules to allow writes.

1. Go to Firebase Console → Firestore Database → Rules
2. Replace the rules with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /whitelist/{userId} {
      // Allow users to read their own entry
      allow read: if request.auth != null && request.auth.uid == userId;
      // Allow users to create their own entry (for auto-whitelisting)
      allow create: if request.auth != null && request.auth.uid == userId;
      // Only you can update/delete via console
      allow update, delete: if false;
    }
  }
}
```

3. Click **"Publish"**

## Security Considerations

- **Auto-whitelisting for everyone:** Anyone can sign up and get access
- **Auto-whitelisting for admins only:** Only specified emails get auto-whitelisted
- **Manual whitelisting (default):** You control who gets access

## Recommendation

For a paid product, **keep auto-whitelisting disabled** and manually add users. This gives you:
- Full control over who has access
- Ability to track who you've given access to
- Can set different tiers/expiration dates
- Better security

Only enable auto-whitelisting if you want open access or for testing.

