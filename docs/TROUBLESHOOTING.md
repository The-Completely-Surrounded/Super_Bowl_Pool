# Troubleshooting

## I see a "Permission Error" on setup.php

Your server folder is not writable.

Fix:
- Set the folder to **755** (or **777** on some shared hosts)
- Try setup again

## I see a "Database Error"

The app could not create `catpool.db`.

Fix:
- Make sure the folder is writable
- Re-run `setup.php`

## My changes are not showing up

- Hard refresh your browser
- Clear cache
- Make sure you edited `config.json` (not `config.sample.json`)

## The page is blank

- Check that all files are uploaded
- Confirm PHP works on your host
- Try visiting `check.php` (optional) to validate PHP + SQLite

## Admin login not working

- Use the password you set in setup
- Check for typos or extra spaces
- If needed, edit `config.json` and re-save
