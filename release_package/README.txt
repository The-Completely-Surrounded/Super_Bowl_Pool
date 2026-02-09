SUPER BOWL POOL SOFTWARE
========================

Thank you for using this Super Bowl Pool software! It's designed to be simple to install on any standard web host.

REQUIREMENTS
------------
- A web server with PHP 8.0 or higher.
- Write permissions on the folder (so it can create the database file).

INSTALLATION
------------
1. Upload ALL files in this folder to your web server (using FTP or your hosting File Manager).
   -> Tip: Put them in a new folder, like 'pool' (e.g., yoursite.com/pool).
2. Visit setup.php in your browser (example: yoursite.com/pool/setup.php).
3. Fill in the form and click Save Configuration.
4. Delete setup.php from the server after setup (for security).

MANUAL CONFIG (OPTIONAL)
------------------------
If you prefer to edit settings by hand instead of using setup.php:
- Copy config.sample.json to config.json
- Edit config.json in a text editor and update the values

SETUP & USAGE
-------------
1. Visit the URL where you uploaded the files.
2. The system will automatically create the database and an empty 10x10 grid on the first visit.
3. Click "Admin" in the top right to log in using the password you set in setup.
4. In the Admin Panel, you can:
   - "Lock" the pool (which randomly assigns numbers).
   - Reserve squares for people manually (or they can click squares to request them).
   - Set the winners for each quarter.
   - Enter your "NFC" and "AFC" team names if you specified defaults in config.

TROUBLESHOOTING
---------------
- If setup fails, make sure the folder on the server is "writable" (Permissions 755 or 777).
- If changes don't show up, try refreshing your browser/clearing cache.

Enjoy the game!
