# Super Bowl Pool Project

Welcome! If you are setting this up for a school, church, or community group, start here:

- [Quick Start](docs/QUICKSTART.md)
- [Install Guide](docs/INSTALL.md)
- [Configuration Reference](docs/CONFIG.md)
- [FAQ](docs/FAQ.md)
- [Download + Upload](docs/DOWNLOAD_AND_UPLOAD.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Launch Checklist](docs/CHECKLIST.md)
- [Printable Setup Sheet](docs/PRINTABLE_SETUP.md)
- [Share Email Script](docs/SHARE_EMAIL.md)
- [Share Text Message Script](docs/SHARE_TEXT.md)
- [One Page Flyer](docs/ONE_PAGE_FLYER.md)

## Consolidated Structure

This project has been reorganized to clearly separate the active source code from legacy backups.

### 📂 `frontend/`
**The Source Code.**
This is the React/Vite application.
- Edit files here (e.g., `src/components/Grid.jsx`).
- **To Build:** Run `npm run build` inside this folder.
- **Output:** The build will create a `dist/` folder containing `index.html` and `assets/`.

### 📂 `php_backend/`
**The Server Code.**
These are the PHP files that run on the live server.
- `api.php`: The main API logic.
- `check.php`, `test_v2.php`: Utilities.

### 📂 `_archive/`
Old backups, legacy Node.js backend, and previous deployment bundles. 
- `node_backend_legacy/`: The old `server.js` code.
- `live-site-backup/`: The backup provided on Feb 2, 2026.
- `deployment_ready/`: Previous staging folder.

---

## 🚀 How to Deploy

1. **Build the Frontend:**
   ```bash
   cd frontend
   npm run build
   ```
   This creates the `dist` folder.

2. **Prepare Upload:**
   Upload the contents of `frontend/dist/` (the `index.html` and `assets` folder) to your server (e.g., into the `super` folder).

3. **Update Backend:**
   Upload the contents of `php_backend/` (`api.php`, etc.) to the same server folder.

4. **Database:**
   Ensure `catpool.db` is present on the server in the same directory (or `live-site-backup` if restoring). **Do not overwrite the live DB** if you only want to update the code.

---

## ✅ Easy Install (No Code Editing)

For non-technical users, you can upload a ready-to-run package and use the installer script to create a human-readable config file.

1. Upload the release package (built frontend + PHP files) to your web host.
2. Visit `setup.php` in your browser (example: `https://yoursite.com/pool/setup.php`).
3. Fill in the form and save. This creates `config.json` and the SQLite database automatically.
4. **Delete `setup.php`** once setup is complete for security.

### Configuration File
- The app reads all settings from `config.json` (not PHP).
- A template is provided at `php_backend/config.sample.json`.

### File Permissions
- The web server must be able to write to the folder so it can create:
   - `config.json`
   - `catpool.db`
- If setup fails, set folder permissions to **755** (or **777** if your host requires it).

---

## 🔒 Security Notes

- Use a strong Admin password in `setup.php`.
- Delete `setup.php` after setup.
- Keep `config.json` and `catpool.db` in a non-public folder if your host supports it.

---

## 📦 Versioning

See [CHANGELOG.md](CHANGELOG.md) for release notes.
