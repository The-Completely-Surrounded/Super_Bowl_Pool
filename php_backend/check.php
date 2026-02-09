<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
echo "<h1>System Check</h1>";
echo "PHP Version: " . phpversion() . "<br>";
echo "SQLite3 installed: " . (class_exists('SQLite3') ? 'Yes' : 'No') . "<br>";
$dbFile = __DIR__ . '/catpool.db';
echo "DB File: $dbFile <br>";
if (file_exists($dbFile)) {
    echo "DB exists.<br>";
    echo "DB writable: " . (is_writable($dbFile) ? 'Yes' : 'No') . "<br>";
    echo "Dir writable: " . (is_writable(__DIR__) ? 'Yes' : 'No') . "<br>";
    try {
        $db = new SQLite3($dbFile);
        echo "DB Connection: Success<br>";
        $res = $db->querySingle("SELECT count(*) FROM squares");
        echo "Square count: $res<br>";
    } catch (Exception $e) {
        echo "DB Error: " . $e->getMessage();
    }
} else {
    echo "DB File NOT FOUND (This is expected if you haven't uploaded it yet, but bad if you have).<br>";
}
echo "<br><b>If you see this, PHP is working. If you got a 500 here, PHP is broken.</b>";
?>