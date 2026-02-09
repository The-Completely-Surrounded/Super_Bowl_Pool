# Configuration Reference

The app reads all settings from `config.json`.

## Example

```
{
  "admin_password": "ChangeMe123",
  "site_title": "Super Bowl Pool",
  "price_per_square": "20",
  "currency_symbol": "$",
  "beneficiary_name": "Local Charity",
  "contact_email": "you@example.com",
  "rules": {
    "The Draw": "We lock the pool before the game. Numbers are random.",
    "The Payouts": "Q1: 12.5%, Half: 25%, Q3: 12.5%, Final: 50%"
  },
  "teams": {
    "nfc": "NFC",
    "afc": "AFC"
  },
  "payments": {
    "links": [
      { "label": "Venmo", "url": "https://venmo.com/YourName", "style": "venmo" },
      { "label": "PayPal", "url": "https://paypal.me/YourName", "style": "paypal" },
      { "label": "Cash App", "url": "https://cash.app/$YourTag", "style": "cashapp" },
      { "label": "Zelle", "url": "mailto:you@example.com?subject=Pool%20Payment", "style": "zelle" }
    ],
    "notes": "If you pay by cash or check, please contact the organizer."
  }
}
```

## Notes

- `admin_password`: used for Admin login.
- `price_per_square`: text shown to users (can be 20, 20.00, or "$20").
- `payments.links`: if empty, no payment buttons show.
- `payments.notes`: optional text under payment buttons.
