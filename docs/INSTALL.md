# Install Guide

This guide is for hosts running PHP 8+ with file upload access (FTP or File Manager).

## What You Upload

- `index.html`
- `assets/`
- `api.php`
- `setup.php`
- `config.sample.json`

All of these files live together in the same folder on your server.

## Install Steps

1. Upload the files to a new folder (example: `/pool`).
2. Visit `setup.php` in your browser.
3. Fill out the installer form and save.
4. Confirm your pool loads at `index.html`.
5. Delete `setup.php`.

## File Permissions

If you see errors during setup, your host likely needs write access.

- The folder must be writable so it can create:
  - `config.json`
  - `catpool.db`
- Typical permissions:
  - Folder: 755 (or 777 on stricter shared hosts)

## Updating Later

- Update settings by editing `config.json`.
- Do not delete `catpool.db` unless you want to reset the pool.

## Admin Access

- Click "Admin" in the top navigation.
- Use the password you set in `setup.php`.
