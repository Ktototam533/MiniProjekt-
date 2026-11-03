
<?php

// Prüfen, ob das Formular abgeschickt wurde
if ($_SERVER["REQUEST_METHOD"] === "POST") {

    // Daten aus dem Formular holen
    $email = trim($_POST["email"] ?? "");
    $password = $_POST["password"] ?? "";

    // Überprüfen, ob beide Felder ausgefüllt wurden
    if (empty($email) || empty($password)) {

        echo "Bitte fülle alle Felder aus!";

    } 
    // Überprüfen, ob die E-Mail gültig ist
    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {

        echo "Bitte gib eine gültige E-Mail-Adresse ein!";

    } 
    else {

        echo "Die Eingaben wurden erfolgreich verarbeitet!";

    }

} else {

    echo "Bitte benutze das Loginformular.";

}

?>
