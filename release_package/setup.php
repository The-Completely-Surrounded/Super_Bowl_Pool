<?php
// setup.php - Installer that generates config.json and checks permissions.

ini_set('display_errors', 1);
error_reporting(E_ALL);

$configFile = __DIR__ . '/config.json';
$dbFile = __DIR__ . '/catpool.db';
$currentDir = __DIR__;

function isWritablePath($path) {
    return is_writable($path);
}

$dirWritable = isWritablePath($currentDir);
$dbWritable = file_exists($dbFile) ? isWritablePath($dbFile) : $dirWritable;
$configWritable = file_exists($configFile) ? isWritablePath($configFile) : $dirWritable;

$permissionError = (!$dirWritable || !$dbWritable || !$configWritable);

$message = "";
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$permissionError) {
    $paymentLinks = [];
    if (!empty($_POST['venmo_link'])) {
        $paymentLinks[] = ['label' => 'Venmo', 'url' => $_POST['venmo_link'], 'style' => 'venmo'];
    }
    if (!empty($_POST['paypal_link'])) {
        $paymentLinks[] = ['label' => 'PayPal', 'url' => $_POST['paypal_link'], 'style' => 'paypal'];
    }
    if (!empty($_POST['cashapp_link'])) {
        $paymentLinks[] = ['label' => 'Cash App', 'url' => $_POST['cashapp_link'], 'style' => 'cashapp'];
    }
    if (!empty($_POST['zelle_link'])) {
        $paymentLinks[] = ['label' => 'Zelle', 'url' => $_POST['zelle_link'], 'style' => 'zelle'];
    }
    if (!empty($_POST['other_label']) && !empty($_POST['other_link'])) {
        $paymentLinks[] = ['label' => $_POST['other_label'], 'url' => $_POST['other_link'], 'style' => 'other'];
    }

    $beneficiary = $_POST['beneficiary_name'] ?: 'The Fundraiser';
    $newConfig = [
        'admin_password' => $_POST['admin_password'] ?: 'admin123',
        'site_title' => $_POST['site_title'] ?: 'Super Bowl Pool',
        'price_per_square' => $_POST['price_per_square'] ?: '20',
        'currency_symbol' => $_POST['currency_symbol'] ?: '$',
        'beneficiary_name' => $beneficiary,
        'contact_email' => $_POST['contact_email'] ?: '',
        'rules' => [
            'draw' => $_POST['rule_draw'] ?: 'We will lock the pool on the Saturday before the Super Bowl (or when sold out). Once locked, numbers are assigned randomly to the rows and columns.',
            'randomness' => $_POST['rule_randomness'] ?: 'Numbers are generated with a secure random shuffle at lock time.',
            'pot' => $_POST['rule_pot'] ?: 'The Total Pot is calculated based on the number of squares sold.',
            'fundSplit' => [
                $_POST['fund_split_1'] ?: "50% goes directly to $beneficiary.",
                $_POST['fund_split_2'] ?: '50% goes into the Prize Pool for the winners.'
            ],
            'payoutIntro' => $_POST['payout_intro'] ?: 'The Prize Pool is split across the four quarters. If your numbers match the score:',
            'payouts' => [
                'q1' => $_POST['payout_q1'] ?: '12.5% of Prize Pool',
                'half' => $_POST['payout_half'] ?: '25% of Prize Pool',
                'q3' => $_POST['payout_q3'] ?: '12.5% of Prize Pool',
                'final' => $_POST['payout_final'] ?: '50% of Prize Pool'
            ],
            'deadSquareTitle' => $_POST['dead_square_title'] ?: 'The "Dead Square" Rule',
            'deadSquareText' => $_POST['dead_square_text'] ?: "If the winning square for a quarter was not purchased, that prize money will be donated to $beneficiary."
        ],
        'teams' => [
            'nfc' => $_POST['nfc_team'] ?: 'NFC',
            'afc' => $_POST['afc_team'] ?: 'AFC'
        ],
        'payments' => [
            'links' => $paymentLinks,
            'notes' => $_POST['payment_notes'] ?: ''
        ]
    ];

    if (file_put_contents($configFile, json_encode($newConfig, JSON_PRETTY_PRINT))) {
        try {
            $db = new SQLite3($dbFile);
            $db->enableExceptions(true);
            $db->exec("CREATE TABLE IF NOT EXISTS squares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                row_index INTEGER NOT NULL,
                col_index INTEGER NOT NULL,
                status TEXT DEFAULT 'available',
                display_name TEXT,
                contact_info TEXT,
                emoji TEXT,
                ip_address TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(row_index, col_index)
            )");
            $db->exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");

            $count = $db->querySingle("SELECT count(*) FROM squares");
            if ($count == 0) {
                $db->exec("BEGIN");
                $stmt = $db->prepare("INSERT INTO squares (row_index, col_index) VALUES (:r, :c)");
                for ($r = 0; $r < 10; $r++) {
                    for ($c = 0; $c < 10; $c++) {
                        $stmt->bindValue(':r', $r, SQLITE3_INTEGER);
                        $stmt->bindValue(':c', $c, SQLITE3_INTEGER);
                        $stmt->execute();
                    }
                }
                $db->exec("COMMIT");
            }

            $message = "SUCCESS";
        } catch (Exception $e) {
            $message = "Error initializing database: " . $e->getMessage();
        }
    } else {
        $message = "Error writing config.json. Check permissions.";
    }
}

$finalConfig = [];
if (file_exists($configFile)) {
    $finalConfig = json_decode(file_get_contents($configFile), true);
}

function cfg($path, $default = '') {
    global $finalConfig;
    $value = $finalConfig;
    foreach (explode('.', $path) as $segment) {
        if (!is_array($value) || !array_key_exists($segment, $value)) {
            return $default;
        }
        $value = $value[$segment];
    }
    return $value;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pool Installer</title>
    <style>
        body { font-family: Arial, Helvetica, sans-serif; background: #f0f2f5; display: flex; justify-content: center; padding: 20px; color: #333; }
        .container { background: white; max-width: 680px; width: 100%; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        h1 { margin-top: 0; color: #1a202c; border-bottom: 2px solid #edf2f7; padding-bottom: 20px; font-size: 24px; }
        .group { margin-bottom: 20px; }
        label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #4a5568; }
        input[type="text"], input[type="password"], textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box; font-size: 16px; transition: border-color 0.2s; }
        input:focus, textarea:focus { border-color: #3182ce; outline: none; }
        .help { font-size: 12px; color: #718096; margin-top: 4px; }
        .btn { display: block; width: 100%; background: #3182ce; color: white; border: none; padding: 14px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
        .btn:hover { background: #2c5282; }
        .alert { padding: 15px; border-radius: 6px; margin-bottom: 20px; font-weight: bold; }
        .alert.error { background: #fed7d7; color: #c53030; }
        .alert.success { background: #c6f6d5; color: #2f855a; text-align: center; }
        .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #a0aec0; font-weight: bold; margin: 30px 0 15px; border-bottom: 1px solid #edf2f7; padding-bottom: 5px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    </style>
</head>
<body>

<div class="container">
    <h1>Pool Installer</h1>

    <?php if ($message === 'SUCCESS'): ?>
        <div class="alert success">
            <h2>Installation Complete</h2>
            <p>Your config.json has been created and the database is ready.</p>
            <p style="margin-top:20px;">
                <a href="index.html" class="btn">Go to Your Pool</a>
            </p>
            <p style="font-size:12px; color:#666; font-weight:normal; margin-top:20px;">
                Security note: delete setup.php from your server now.
            </p>
        </div>
    <?php else: ?>

        <?php if ($permissionError): ?>
            <div class="alert error">
                File permission error
                <ul style="font-size:14px; font-weight:normal;">
                    <?php if (!$dirWritable) echo "<li>The folder <code>$currentDir</code> is not writable.</li>"; ?>
                    <?php if (file_exists($dbFile) && !$dbWritable) echo "<li>The database file <code>$dbFile</code> is not writable.</li>"; ?>
                    <?php if (file_exists($configFile) && !$configWritable) echo "<li>The config file <code>$configFile</code> is not writable.</li>"; ?>
                </ul>
                <p style="font-size:14px; font-weight:normal;">Use your FTP client or File Manager to set permissions to 755 or 777 for this folder.</p>
            </div>
        <?php endif; ?>

        <?php if ($message && $message !== 'SUCCESS'): ?>
             <div class="alert error"><?php echo htmlspecialchars($message); ?></div>
        <?php endif; ?>

        <form method="POST">

            <div class="section-title">Security and Basic Info</div>

            <div class="group">
                <label>Admin Password</label>
                <input type="text" name="admin_password" value="<?php echo htmlspecialchars(cfg('admin_password', 'ChangeMe123')); ?>" required>
                <div class="help">Used for the Admin page.</div>
            </div>

            <div class="group">
                <label>Site Title</label>
                <input type="text" name="site_title" value="<?php echo htmlspecialchars(cfg('site_title', 'Super Bowl Pool')); ?>">
            </div>

            <div class="group">
                <label>Contact Email</label>
                <input type="text" name="contact_email" value="<?php echo htmlspecialchars(cfg('contact_email', '')); ?>" placeholder="you@gmail.com">
                <div class="help">Shown in the Questions footer.</div>
            </div>

            <div class="section-title">Money and Payments</div>

            <div class="grid">
                <div class="group">
                    <label>Cost</label>
                    <input type="text" name="price_per_square" value="<?php echo htmlspecialchars(cfg('price_per_square', '20')); ?>">
                </div>
                <div class="group">
                    <label>Currency</label>
                    <input type="text" name="currency_symbol" value="<?php echo htmlspecialchars(cfg('currency_symbol', '$')); ?>">
                </div>
            </div>

            <div class="group">
                <label>Beneficiary Name</label>
                <input type="text" name="beneficiary_name" value="<?php echo htmlspecialchars(cfg('beneficiary_name', 'Local Charity')); ?>">
                <div class="help">Who does the money go to?</div>
            </div>

            <div class="grid">
                <div class="group">
                    <label>Venmo Link (optional)</label>
                    <input type="text" name="venmo_link" value="" placeholder="https://venmo.com/YourName">
                </div>
                <div class="group">
                    <label>PayPal Link (optional)</label>
                    <input type="text" name="paypal_link" value="" placeholder="https://paypal.me/YourName">
                </div>
                <div class="group">
                    <label>Cash App Link (optional)</label>
                    <input type="text" name="cashapp_link" value="" placeholder="https://cash.app/$YourTag">
                </div>
                <div class="group">
                    <label>Zelle Link (optional)</label>
                    <input type="text" name="zelle_link" value="" placeholder="mailto:you@example.com?subject=Pool%20Payment">
                </div>
            </div>

            <div class="grid">
                <div class="group">
                    <label>Other Payment Label (optional)</label>
                    <input type="text" name="other_label" value="" placeholder="Check, Square, etc.">
                </div>
                <div class="group">
                    <label>Other Payment Link (optional)</label>
                    <input type="text" name="other_link" value="" placeholder="https://example.com">
                </div>
            </div>

            <div class="group">
                <label>Payment Notes (optional)</label>
                <textarea name="payment_notes" rows="3"><?php echo htmlspecialchars(cfg('payments.notes', '')); ?></textarea>
            </div>

            <div class="section-title">Rules</div>

            <div class="group">
                <label>The Draw</label>
                <textarea name="rule_draw" rows="2"><?php echo htmlspecialchars(cfg('rules.draw', 'We will lock the pool before the Super Bowl (or when sold out). Once locked, numbers are assigned randomly to the rows and columns.')); ?></textarea>
            </div>
            <div class="group">
                <label>Randomness</label>
                <textarea name="rule_randomness" rows="2"><?php echo htmlspecialchars(cfg('rules.randomness', 'Numbers are generated with a secure random shuffle at lock time.')); ?></textarea>
            </div>
            <div class="group">
                <label>The Pot</label>
                <textarea name="rule_pot" rows="2"><?php echo htmlspecialchars(cfg('rules.pot', 'The total pot is calculated based on the number of squares sold.')); ?></textarea>
            </div>
            <div class="group">
                <label>Fund Split Line 1</label>
                <textarea name="fund_split_1" rows="2"><?php echo htmlspecialchars(cfg('rules.fundSplit.0', '50% goes directly to the fundraiser.')); ?></textarea>
            </div>
            <div class="group">
                <label>Fund Split Line 2</label>
                <textarea name="fund_split_2" rows="2"><?php echo htmlspecialchars(cfg('rules.fundSplit.1', '50% goes into the Prize Pool for the winners.')); ?></textarea>
            </div>
            <div class="group">
                <label>Payout Intro</label>
                <textarea name="payout_intro" rows="2"><?php echo htmlspecialchars(cfg('rules.payoutIntro', 'The Prize Pool is split across the four quarters. If your numbers match the score:')); ?></textarea>
            </div>
            <div class="grid">
                <div class="group">
                    <label>Q1 Payout</label>
                    <input type="text" name="payout_q1" value="<?php echo htmlspecialchars(cfg('rules.payouts.q1', '12.5% of Prize Pool')); ?>">
                </div>
                <div class="group">
                    <label>Halftime Payout</label>
                    <input type="text" name="payout_half" value="<?php echo htmlspecialchars(cfg('rules.payouts.half', '25% of Prize Pool')); ?>">
                </div>
                <div class="group">
                    <label>Q3 Payout</label>
                    <input type="text" name="payout_q3" value="<?php echo htmlspecialchars(cfg('rules.payouts.q3', '12.5% of Prize Pool')); ?>">
                </div>
                <div class="group">
                    <label>Final Payout</label>
                    <input type="text" name="payout_final" value="<?php echo htmlspecialchars(cfg('rules.payouts.final', '50% of Prize Pool')); ?>">
                </div>
            </div>
            <div class="group">
                <label>Dead Square Title</label>
                <input type="text" name="dead_square_title" value="<?php echo htmlspecialchars(cfg('rules.deadSquareTitle', 'The "Dead Square" Rule')); ?>">
            </div>
            <div class="group">
                <label>Dead Square Text</label>
                <textarea name="dead_square_text" rows="2"><?php echo htmlspecialchars(cfg('rules.deadSquareText', 'If the winning square for a quarter was not purchased, that prize money will be donated to the fundraiser.')); ?></textarea>
            </div>

            <div class="section-title">Teams</div>
            <div class="grid">
                <div class="group">
                    <label>NFC Team Name</label>
                    <input type="text" name="nfc_team" value="<?php echo htmlspecialchars(cfg('teams.nfc', 'NFC')); ?>">
                </div>
                <div class="group">
                    <label>AFC Team Name</label>
                    <input type="text" name="afc_team" value="<?php echo htmlspecialchars(cfg('teams.afc', 'AFC')); ?>">
                </div>
            </div>

            <button type="submit" class="btn" <?php if ($permissionError) echo 'disabled style="opacity:0.5"'; ?>>Save Configuration</button>
        </form>
    <?php endif; ?>
</div>

</body>
</html>
