# FAQ

## Do I need a database?
No. The app uses a local SQLite database file (`catpool.db`) created automatically.

## Can I run this without coding?
Yes. Use `setup.php` to create `config.json` with a simple form.

## Where do I set payment links?
In `setup.php` or by editing `config.json` under `payments.links`.
If a link is blank, it will not show on the site.

## Can I disable Venmo or PayPal?
Yes. Just leave the fields empty or remove those items from `config.json`.

## Can I use Cash App, Zelle, or other options?
Yes. The installer includes Cash App and Zelle fields, plus a custom "Other" option.

## What if setup says permission error?
Your server folder is not writable. Set permissions to 755 (or 777 on some hosts).

## Can I reset the pool?
Yes. In the Admin panel, use the "Reset" option. This clears all squares.

## Can I change team names?
Yes. Set defaults in `config.json`, or change them in the Admin panel later.
