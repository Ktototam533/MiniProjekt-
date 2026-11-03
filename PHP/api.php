<?php
session_start();
header("Content-Type: application/json; charset=utf-8");

const ADMIN_EMAIL = "admin@lgs-di.de"; // Hier die echte Admin-Adresse eintragen

$usersFile = __DIR__ . "/../data/users.json";
$ideasFile = __DIR__ . "/../data/ideas.json";

function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function readJson($file) {
    if (!file_exists($file)) {
        file_put_contents($file, "[]");
    }
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

function writeJson($file, $data) {
    file_put_contents(
        $file,
        json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );
}

function inputData() {
    $data = json_decode(file_get_contents("php://input"), true);
    return is_array($data) ? $data : $_POST;
}

function requireLogin() {
    if (empty($_SESSION["user"])) {
        respond(["ok" => false, "message" => "Bitte melde dich zuerst an."], 401);
    }
}

function requireAdmin() {
    requireLogin();
    if (empty($_SESSION["user"]["admin"])) {
        respond(["ok" => false, "message" => "Keine Administratorrechte."], 403);
    }
}

$action = $_GET["action"] ?? "";
$data = inputData();

if ($action === "register") {
    $email = strtolower(trim($data["email"] ?? ""));
    $nickname = trim($data["nickname"] ?? "");
    $password = $data["password"] ?? "";

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) ||
        !str_ends_with($email, "@lgs-di.de")) {
        respond(["ok" => false, "message" => "Bitte eine gültige @lgs-di.de-Adresse verwenden."], 400);
    }

    if (strlen($nickname) < 2 || strlen($nickname) > 30 ||
        strlen($password) < 8) {
        respond(["ok" => false, "message" => "Nickname oder Passwort ist ungültig."], 400);
    }

    $users = readJson($usersFile);
    foreach ($users as $user) {
        if ($user["email"] === $email) {
            respond(["ok" => false, "message" => "Diese E-Mail-Adresse ist bereits registriert."], 400);
        }
    }

    $token = bin2hex(random_bytes(24));
    $users[] = [
        "id" => bin2hex(random_bytes(8)),
        "email" => $email,
        "nickname" => $nickname,
        "password" => password_hash($password, PASSWORD_DEFAULT),
        "verified" => false,
        "token" => $token,
        "admin" => ($email === ADMIN_EMAIL)
    ];
    writeJson($usersFile, $users);

    $baseUrl = rtrim(dirname($_SERVER["SCRIPT_NAME"]), "/\\");
    $verifyUrl = "https://" . $_SERVER["HTTP_HOST"] . $baseUrl .
                 "/verify.php?token=" . urlencode($token);
    $subject = "myLGS Ideenmagnet: E-Mail bestätigen";
    $message = "Bitte bestätige deine E-Mail-Adresse über diesen Link:\n\n" . $verifyUrl;
    $headers = "From: noreply@" . $_SERVER["HTTP_HOST"];

    if (!mail($email, $subject, $message, $headers)) {
        respond([
            "ok" => false,
            "message" => "Das Konto wurde angelegt, aber die Bestätigungsmail konnte nicht versendet werden. Bitte den Server-Mailversand prüfen."
        ], 500);
    }

    respond(["ok" => true, "message" => "Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse."]);
}

if ($action === "login") {
    $email = strtolower(trim($data["email"] ?? ""));
    $password = $data["password"] ?? "";
    $users = readJson($usersFile);

    foreach ($users as $user) {
        if ($user["email"] === $email &&
            password_verify($password, $user["password"])) {
            if (!$user["verified"]) {
                respond(["ok" => false, "message" => "Bitte bestätige zuerst deine E-Mail-Adresse."], 403);
            }

            $_SESSION["user"] = [
                "id" => $user["id"],
                "nickname" => $user["nickname"],
                "admin" => $user["admin"]
            ];
            respond(["ok" => true]);
        }
    }

    respond(["ok" => false, "message" => "E-Mail-Adresse oder Passwort ist falsch."], 401);
}

if ($action === "logout") {
    session_destroy();
    respond(["ok" => true]);
}

if ($action === "ideas") {
    requireLogin();
    $ideas = readJson($ideasFile);
    $visible = [];

    foreach ($ideas as $idea) {
        if ($idea["status"] === "approved" ||
            (!empty($_SESSION["user"]["admin"]) && $idea["status"] === "pending")) {
            $visible[] = [
                "id" => $idea["id"],
                "title" => $idea["title"],
                "description" => $idea["description"],
                "category" => $idea["category"],
                "nickname" => $idea["nickname"],
                "votes" => count($idea["voters"]),
                "voted" => in_array($_SESSION["user"]["id"], $idea["voters"], true),
                "status" => $idea["status"]
            ];
        }
    }

    respond([
        "ok" => true,
        "ideas" => $visible,
        "admin" => !empty($_SESSION["user"]["admin"])
    ]);
}

if ($action === "add-idea") {
    requireLogin();

    $title = trim($data["title"] ?? "");
    $description = trim($data["description"] ?? "");
    $category = trim($data["category"] ?? "");
    $categories = ["Unterricht", "Schulgebäude", "Pausen", "Verpflegung", "Sonstiges"];

    if (strlen($title) < 3 || strlen($title) > 100 ||
        strlen($description) < 10 || strlen($description) > 2000 ||
        !in_array($category, $categories, true)) {
        respond(["ok" => false, "message" => "Bitte prüfe Titel, Beschreibung und Kategorie."], 400);
    }

    $ideas = readJson($ideasFile);
    $ideas[] = [
        "id" => bin2hex(random_bytes(8)),
        "title" => $title,
        "description" => $description,
        "category" => $category,
        "nickname" => $_SESSION["user"]["nickname"],
        "status" => "pending",
        "voters" => [],
        "created" => date("c")
    ];
    writeJson($ideasFile, $ideas);

    respond(["ok" => true, "message" => "Danke! Deine Idee wartet auf Freigabe."]);
}

if ($action === "vote") {
    requireLogin();
    $id = $data["id"] ?? "";
    $ideas = readJson($ideasFile);

    foreach ($ideas as &$idea) {
        if ($idea["id"] === $id && $idea["status"] === "approved") {
            if (in_array($_SESSION["user"]["id"], $idea["voters"], true)) {
                respond(["ok" => false, "message" => "Du hast bereits abgestimmt."], 400);
            }
            $idea["voters"][] = $_SESSION["user"]["id"];
            writeJson($ideasFile, $ideas);
            respond(["ok" => true]);
        }
    }

    respond(["ok" => false, "message" => "Idee nicht gefunden."], 404);
}

if ($action === "moderate") {
    requireAdmin();
    $id = $data["id"] ?? "";
    $operation = $data["operation"] ?? "";
    $ideas = readJson($ideasFile);

    foreach ($ideas as $key => $idea) {
        if ($idea["id"] === $id) {
            if ($operation === "delete") {
                array_splice($ideas, $key, 1);
            } elseif (in_array($operation, ["approved", "rejected"], true)) {
                $ideas[$key]["status"] = $operation;
            } else {
                respond(["ok" => false, "message" => "Unbekannte Aktion."], 400);
            }
            writeJson($ideasFile, $ideas);
            respond(["ok" => true]);
        }
    }

    respond(["ok" => false, "message" => "Idee nicht gefunden."], 404);
}

if ($action === "admin-users") {
    requireAdmin();
    $users = readJson($usersFile);
    $result = [];

    foreach ($users as $user) {
        $result[] = [
            "nickname" => $user["nickname"],
            "email" => $user["email"],
            "verified" => $user["verified"]
        ];
    }
    respond(["ok" => true, "users" => $result]);
}

respond(["ok" => false, "message" => "Unbekannte Anfrage."], 404);