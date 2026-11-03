<?php
$usersFile = __DIR__ . "/../data/users.json";
$token = $_GET["token"] ?? "";

$users = file_exists($usersFile)
    ? json_decode(file_get_contents($usersFile), true)
    : [];

if (!is_array($users)) {
    $users = [];
}

$found = false;

foreach ($users as &$user) {
    if (!empty($user["token"]) && hash_equals($user["token"], $token)) {
        $user["verified"] = true;
        $user["token"] = "";
        $found = true;
        break;
    }
}

if ($found) {
    file_put_contents(
        $usersFile,
        json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );
    echo "E-Mail bestätigt. Du kannst dich jetzt anmelden.";
} else {
    http_response_code(400);
    echo "Der Bestätigungslink ist ungültig oder wurde bereits verwendet.";
}