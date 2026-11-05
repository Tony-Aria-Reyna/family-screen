# Family Screen

Our family calendar, to-do list and shopping list: on a tablet on the fridge and on our phones, kept in sync live.

- **index.html** is built from `src/` by `build.js` (`npm run build`). Don't edit it by hand.
- Family data lives in a private Firebase (Firestore) database. Only Google accounts listed as members of the family can read or change it — see `firestore.rules`.
- `firebase-config.json` holds the project's public web config (not a secret).
- Open with `?demo` to try it with sample data saved only on that device.
