<?php
// api.php - PHP 8.4 Backend for Super Bowl Pool
// No more CGI-BIN madness. Just PHP.

// Enable Error Reporting for debugging (Remove in production if desired, but good for now)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// CONFIGURATION
$configFile = __DIR__ . '/config.json';
$configData = [];
if (file_exists($configFile)) {
    $rawConfig = file_get_contents($configFile);
    $decoded = json_decode($rawConfig, true);
    if (is_array($decoded)) {
        $configData = $decoded;
    }
}

// Defaults if config.json is missing or invalid
$ADMIN_PASSWORD = $configData['admin_password'] ?? 'ChangeMe123';
$SITE_TITLE = $configData['site_title'] ?? 'Super Bowl Pool';
$SQUARE_COST = $configData['price_per_square'] ?? '20';
$CURRENCY_SYMBOL = $configData['currency_symbol'] ?? '$';
$BENEFICIARY = $configData['beneficiary_name'] ?? 'Charity';
$CONTACT_EMAIL = $configData['contact_email'] ?? '';
$DEFAULT_NFC_TEAM = $configData['teams']['nfc'] ?? 'NFC';
$DEFAULT_AFC_TEAM = $configData['teams']['afc'] ?? 'AFC';
$RULES_TEXT = $configData['rules'] ?? [];
$PAYMENTS = $configData['payments'] ?? [];
$DB_FILE = __DIR__ . '/catpool.db'; // Create DB in same folder

// Debug Logger
function debugLog($msg) {
    // Disabled for production to prevent I/O lock
    // try {
    //     file_put_contents(__DIR__ . '/php_debug.log', date('[Y-m-d H:i:s] ') . $msg . "\n", FILE_APPEND);
    // } catch (Exception $e) {}
}

debugLog("Request: " . $_SERVER['REQUEST_URI']);

// --- Database Connection ---
try {
    // Attempt to open/create database
    $db = new SQLite3($DB_FILE);
    $db->enableExceptions(true);
    // Set timeout to avoid locks
    $db->busyTimeout(5000); 
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database Error: " . $e->getMessage()]);
    exit();
}

// --- Initialization ---
function initDb($db) {
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

    $db->exec("CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )");
    
    // Check if seeded
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
        
        // Settings Defaults
        $defaults = [
            'row_labels' => json_encode(array_fill(0, 10, '?')),
            'col_labels' => json_encode(array_fill(0, 10, '?')),
            'nfc_name' => $GLOBALS['DEFAULT_NFC_TEAM'] ?? 'NFC',
            'afc_name' => $GLOBALS['DEFAULT_AFC_TEAM'] ?? 'AFC',
            'locked' => 'false'
        ];
        foreach ($defaults as $k => $v) {
            $stmt = $db->prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (:k, :v)");
            $stmt->bindValue(':k', $k);
            $stmt->bindValue(':v', $v);
            $stmt->execute();
        }
    }
}

initDb($db);

// --- Helpers ---
function getJsonInput() {
    $input = file_get_contents("php://input");
    return json_decode($input, true) ?: [];
}

function getSetting($db, $key, $default = null) {
    $stmt = $db->prepare("SELECT value FROM settings WHERE key = :key");
    $stmt->bindValue(':key', $key);
    $res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
    return $res ? $res['value'] : $default;
}

function setSetting($db, $key, $val) {
    $stmt = $db->prepare("INSERT INTO settings (key, value) VALUES (:key, :val) ON CONFLICT(key) DO UPDATE SET value = :val");
    $stmt->bindValue(':key', $key);
    $stmt->bindValue(':val', $val);
    $stmt->execute();
}

function getJsonSetting($db, $key, $default = null) {
    $raw = getSetting($db, $key);
    if ($raw === null || $raw === '') {
        return $default;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $default;
}

function secureShuffle($array) {
    $count = count($array);
    for ($i = $count - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        $tmp = $array[$i];
        $array[$i] = $array[$j];
        $array[$j] = $tmp;
    }
    return $array;
}

function checkAuth() {
    global $ADMIN_PASSWORD;
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    
    // Bearer token
    if (strpos($auth, 'Bearer ') === 0) {
        $token = substr($auth, 7);
        if ($token === $ADMIN_PASSWORD) return true;
    }
    return false;
}

if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

// --- Routing ---
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// GET ?action=config
if ($action === 'config') {
    global $SITE_TITLE, $SQUARE_COST, $CURRENCY_SYMBOL, $BENEFICIARY, $RULES_TEXT, $PAYMENTS, $CONTACT_EMAIL;
    $rulesFromSettings = getJsonSetting($db, 'rules_json', null);
    $rulesPayload = $rulesFromSettings ?? ($RULES_TEXT ?? []);
    echo json_encode([
        'title' => $SITE_TITLE ?? 'Super Bowl Pool',
        'cost' => $SQUARE_COST ?? '20',
        'currency' => $CURRENCY_SYMBOL ?? '$',
        'beneficiary' => $BENEFICIARY ?? 'Charity',
        'rules' => $rulesPayload,
        'payments' => $PAYMENTS ?? [],
        'contactEmail' => $CONTACT_EMAIL ?? ''
    ]);
    exit();
}

// GET ?action=grid
if ($action === 'grid') {
    $res = $db->query("SELECT id, row_index, col_index, status, display_name, emoji FROM squares");
    $squares = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) { $squares[] = $row; }
    $rowLabels = json_decode(getSetting($db, 'row_labels') ?: '[]');
    $colLabels = json_decode(getSetting($db, 'col_labels') ?: '[]');
    if (!is_array($rowLabels) || count($rowLabels) !== 10) $rowLabels = array_fill(0, 10, '?');
    if (!is_array($colLabels) || count($colLabels) !== 10) $colLabels = array_fill(0, 10, '?');

    echo json_encode([
        'squares' => $squares,
        'axis' => [
            'rowLabels' => $rowLabels,
            'colLabels' => $colLabels
        ],
        'teams' => [
            'nfc' => getSetting($db, 'nfc_name') ?: 'NFC',
            'afc' => getSetting($db, 'afc_name') ?: 'AFC'
        ],
        'winners' => [
            'q1' => getSetting($db, 'winner_q1'),
            'half' => getSetting($db, 'winner_half'),
            'q3' => getSetting($db, 'winner_q3'),
            'final' => getSetting($db, 'winner_final')
        ],
        'locked' => json_decode(getSetting($db, 'locked') ?: 'false')
    ]);
    exit();
}

// POST ?action=reserve
if ($action === 'reserve' && $method === 'POST') {
    $data = getJsonInput();
    
    // Check Lock
    if (json_decode(getSetting($db, 'locked') ?: 'false')) {
        http_response_code(403); 
        echo json_encode(["error" => "Pool Locked"]); 
        exit();
    }
    
    // Check Rate Limit (IP)
    $ip = $_SERVER['REMOTE_ADDR'];
    $stmt = $db->prepare("SELECT count(*) as cnt FROM squares WHERE status = 'pending' AND ip_address = :ip");
    $stmt->bindValue(':ip', $ip);
    $res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
    if ($res['cnt'] >= 4) {
        http_response_code(429);
        echo json_encode(["error" => "Limit of 4 pending squares reached."]);
        exit();
    }
    
    $stmt = $db->prepare("UPDATE squares SET status = 'pending', display_name = :name, contact_info = :info, emoji = :emoji, ip_address = :ip, updated_at = CURRENT_TIMESTAMP WHERE row_index = :r AND col_index = :c AND status = 'available'");
    $stmt->bindValue(':name', $data['displayName']);
    $stmt->bindValue(':info', $data['contactInfo']);
    $stmt->bindValue(':emoji', $data['emoji'] ?? '');
    $stmt->bindValue(':ip', $ip);
    $stmt->bindValue(':r', $data['rowIndex']);
    $stmt->bindValue(':c', $data['colIndex']);
    
    $stmt->execute();
    if ($db->changes() == 0) {
        http_response_code(409);
        echo json_encode(["error" => "Square taken"]);
    } else {
        echo json_encode(["success" => true]);
    }
    exit();
}

// POST ?action=admin/login
if ($action === 'admin/login' && $method === 'POST') {
    $data = getJsonInput();
    if (($data['password'] ?? '') === $ADMIN_PASSWORD) {
        echo json_encode(["token" => $ADMIN_PASSWORD]);
    } else {
        http_response_code(401);
        echo json_encode(["error" => "Invalid"]);
    }
    exit();
}

// --- Auth Protected Routes ---
if (strpos($action, 'admin/') === 0) {
    if (!checkAuth()) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized"]);
        exit();
    }
}

// POST ?action=admin/data
if ($action === 'admin/data') {
    $res = $db->query("SELECT * FROM squares");
    $squares = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) { $squares[] = $row; }
    
    echo json_encode([
        'squares' => $squares,
        'settings' => [
            'nfcName' => getSetting($db, 'nfc_name'),
            'afcName' => getSetting($db, 'afc_name'),
            'locked' => json_decode(getSetting($db, 'locked') ?: 'false'),
            'allowedTeams' => getJsonSetting($db, 'allowed_teams', []),
            'rules' => getJsonSetting($db, 'rules_json', $RULES_TEXT ?? []),
            'winners' => [
                'q1' => getSetting($db, 'winner_q1'),
                'half' => getSetting($db, 'winner_half'),
                'q3' => getSetting($db, 'winner_q3'),
                'final' => getSetting($db, 'winner_final')
            ]
        ]
    ]);
    exit();
}

// POST ?action=admin/toggle-lock
if ($action === 'admin/toggle-lock' && $method === 'POST') {
    $data = getJsonInput();
    $lock = $data['locked']; // boolean
    if ($lock) {
        setSetting($db, 'locked', 'true');
        $rng = range(0, 9);
        $colLabels = secureShuffle($rng);
        $rowLabels = secureShuffle($rng);
        setSetting($db, 'col_labels', json_encode($colLabels)); // NFC
        setSetting($db, 'row_labels', json_encode($rowLabels)); // AFC
    } else {
        setSetting($db, 'locked', 'false');
        setSetting($db, 'col_labels', json_encode(array_fill(0,10,'?')));
        setSetting($db, 'row_labels', json_encode(array_fill(0,10,'?')));
    }
    echo json_encode(["success" => true]);
    exit();
}

// POST ?action=admin/edit-square
if ($action === 'admin/edit-square' && $method === 'POST') {
    $data = getJsonInput();
    $id = $data['id'];
    $name = $data['display_name'];
    $emoji = $data['emoji'];
    
    $stmt = $db->prepare("UPDATE squares SET display_name = :name, emoji = :emoji WHERE id = :id");
    $stmt->bindValue(':name', $name);
    $stmt->bindValue(':emoji', $emoji);
    $stmt->bindValue(':id', $id);
    $stmt->execute();
    echo json_encode(["success" => true]);
    exit();
}

// POST ?action=admin/update-status
if ($action === 'admin/update-status' && $method === 'POST') {
    $data = getJsonInput();
    $id = $data['id'] ?? ($_POST['id'] ?? null);
    $status = $data['status'] ?? ($_POST['status'] ?? null);
    $rowIndex = $data['row_index'] ?? ($_POST['row_index'] ?? null);
    $colIndex = $data['col_index'] ?? ($_POST['col_index'] ?? null);

    if ($id === null || $status === null) {
        http_response_code(400);
        echo json_encode(["error" => "Missing id or status"]);
        exit();
    }

    try {
        $useRowCol = is_numeric($rowIndex) && is_numeric($colIndex) && $rowIndex >= 0 && $rowIndex <= 9 && $colIndex >= 0 && $colIndex <= 9;
        if ($useRowCol) {
            if ($status === 'confirmed') {
                $stmt = $db->prepare("UPDATE squares SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE row_index = :r AND col_index = :c");
            } else {
                $stmt = $db->prepare("UPDATE squares SET status = 'available', display_name = NULL, contact_info = NULL, emoji = NULL, updated_at = CURRENT_TIMESTAMP WHERE row_index = :r AND col_index = :c");
            }
            $stmt->bindValue(':r', (int)$rowIndex, SQLITE3_INTEGER);
            $stmt->bindValue(':c', (int)$colIndex, SQLITE3_INTEGER);
        } else {
            if ($status === 'confirmed') {
                $stmt = $db->prepare("UPDATE squares SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            } else {
                $stmt = $db->prepare("UPDATE squares SET status = 'available', display_name = NULL, contact_info = NULL, emoji = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            }
            $stmt->bindValue(':id', (int)$id, SQLITE3_INTEGER);
        }
        $stmt->execute();
        if ($db->changes() === 0) {
            http_response_code(409);
            echo json_encode([
                "error" => "No rows updated (id not found or unchanged)",
                "debug" => [
                    "id" => $id,
                    "status" => $status,
                    "row_index" => $rowIndex,
                    "col_index" => $colIndex,
                    "use_row_col" => $useRowCol
                ]
            ]);
            exit();
        }
        echo json_encode(["success" => true]);
        exit();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => "Update failed: " . $e->getMessage()]);
        exit();
    }
}

// POST ?action=admin/reset
if ($action === 'admin/reset' && $method === 'POST') {
    $db->exec("UPDATE squares SET status='available', display_name=NULL, contact_info=NULL, emoji=NULL");
    setSetting($db, 'locked', 'false');
    setSetting($db, 'col_labels', json_encode(array_fill(0,10,'?')));
    setSetting($db, 'row_labels', json_encode(array_fill(0,10,'?')));
    $db->exec("DELETE FROM settings WHERE key LIKE 'winner_%'");
    echo json_encode(["success" => true]);
    exit();
}

// POST ?action=admin/clear-pending
if ($action === 'admin/clear-pending' && $method === 'POST') {
    $db->exec("UPDATE squares SET status='available', display_name=NULL, emoji=NULL, contact_info=NULL WHERE status = 'pending'");
    echo json_encode(["success" => true]);
    exit();
}

// POST ?action=admin/settings
if ($action === 'admin/settings' && $method === 'POST') {
    $data = getJsonInput();
    if (isset($data['nfcName'])) setSetting($db, 'nfc_name', $data['nfcName']);
    if (isset($data['afcName'])) setSetting($db, 'afc_name', $data['afcName']);
    if (isset($data['allowedTeams'])) setSetting($db, 'allowed_teams', json_encode(array_values($data['allowedTeams'])));
    if (isset($data['rules'])) setSetting($db, 'rules_json', json_encode($data['rules']));
    echo json_encode(["success" => true]);
    exit();
}

// POST ?action=admin/calculate-winner
if ($action === 'admin/calculate-winner' && $method === 'POST') {
    $data = getJsonInput();
    $q = $data['quarter'];
    $n_score = (int)$data['nfcScore'];
    $a_score = (int)$data['afcScore'];
    
    $n_digit = $n_score % 10;
    $a_digit = $a_score % 10;
    
    $rl = json_decode(getSetting($db, 'row_labels') ?: '[]', true); // AFC
    $cl = json_decode(getSetting($db, 'col_labels') ?: '[]', true); // NFC
    
    $r_idx = array_search((string)$a_digit, array_map('strval', $rl));
    $c_idx = array_search((string)$n_digit, array_map('strval', $cl));
    
    if ($r_idx === false || $c_idx === false) {
        http_response_code(400);
        echo json_encode(["error" => "Labels not set or mismatch"]);
        exit();
    }
    
    $stmt = $db->prepare("SELECT display_name FROM squares WHERE row_index = :r AND col_index = :c");
    $stmt->bindValue(':r', $r_idx);
    $stmt->bindValue(':c', $c_idx);
    $winner = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
    $name = $winner ? $winner['display_name'] : "Unsold";
    
    setSetting($db, 'winner_' . $q, $name);
    echo json_encode(["success" => true, "winner" => $name]);
    exit();
}

http_response_code(404);
echo json_encode(["error" => "Action not found"]);
?>
