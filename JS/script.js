
const API = "php/api.php";

// ==========================================
// 1. API-Verbindung zum PHP-Server
// ==========================================

async function api(action, data = {}) {
    let response;

    try {
        response = await fetch(
            `${API}?action=${encodeURIComponent(action)}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(data)
            }
        );
    } catch (error) {
        throw new Error(
            "Keine Verbindung zum Server. Bitte versuche es erneut."
        );
    }

    const raw = await response.text();

    let result;

    try {
        result = JSON.parse(raw);
    } catch (error) {
        console.error("Ungültige Serverantwort:", raw);

        throw new Error(
            "Der Server hat keine gültige Antwort geliefert. Bitte PHP-Fehlerprotokoll prüfen."
        );
    }

    if (!response.ok || !result.ok) {
        throw new Error(
            result.message || `Serverfehler (${response.status}).`
        );
    }

    return result;
}


// ==========================================
// 2. Nachrichten anzeigen
// ==========================================

function showMessage(element, text, error = false) {
    if (!element) return;

    element.textContent = text;
    element.classList.toggle("error", error);
}


// ==========================================
// 3. Anmeldung und Registrierung
// ==========================================

const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");

if (loginForm && registerForm) {

    const message = document.querySelector("#message");

    // Tabs wechseln
    document.querySelectorAll(".tab").forEach(button => {

        button.addEventListener("click", () => {

            const registering =
                button.dataset.tab === "register";

            loginForm.classList.toggle(
                "hidden",
                registering
            );

            registerForm.classList.toggle(
                "hidden",
                !registering
            );

            document.querySelectorAll(".tab").forEach(tab => {
                tab.classList.toggle(
                    "active",
                    tab === button
                );
            });

            showMessage(message, "");
        });
    });


    // --------------------------------------
    // ANMELDUNG
    // --------------------------------------

    loginForm.addEventListener("submit", async event => {

        event.preventDefault();

        const submitButton =
            loginForm.querySelector('button[type="submit"]');

        const form = new FormData(loginForm);

        submitButton.disabled = true;
        showMessage(message, "Anmeldung wird überprüft ...");

        try {

            await api(
                "login",
                Object.fromEntries(form)
            );

            showMessage(message, "Anmeldung erfolgreich!");

            location.href = "ideen.html";

        } catch (error) {

            showMessage(
                message,
                error.message,
                true
            );

        } finally {

            submitButton.disabled = false;

        }
    });


    // --------------------------------------
    // REGISTRIERUNG
    // --------------------------------------

    registerForm.addEventListener("submit", async event => {

        event.preventDefault();

        const submitButton =
            registerForm.querySelector('button[type="submit"]');

        const form = new FormData(registerForm);

        const password = form.get("password");
        const confirmPassword = form.get("confirm_password");

        // Passwörter vergleichen
        if (password !== confirmPassword) {

            showMessage(
                message,
                "Die Passwörter stimmen nicht überein.",
                true
            );

            return;
        }

        if (password.length < 8) {

            showMessage(
                message,
                "Das Passwort muss mindestens 8 Zeichen haben.",
                true
            );

            return;
        }

        // Bestätigung nicht an PHP senden
        form.delete("confirm_password");

        submitButton.disabled = true;

        showMessage(
            message,
            "Dein Konto wird erstellt ..."
        );

        try {

            const result = await api(
                "register",
                Object.fromEntries(form)
            );

            showMessage(
                message,
                result.message
            );

            registerForm.reset();

        } catch (error) {

            showMessage(
                message,
                error.message,
                true
            );

        } finally {

            submitButton.disabled = false;

        }
    });
}


// ==========================================
// 4. IDEEN-SEITE
// ==========================================

const ideasList = document.querySelector("#ideas-list");

if (ideasList) {

    const ideaForm =
        document.querySelector("#idea-form");

    const ideaMessage =
        document.querySelector("#idea-message");

    const ideasMessage =
        document.querySelector("#ideas-message");

    const adminSection =
        document.querySelector("#admin-section");

    const pendingList =
        document.querySelector("#pending-list");

    let ideas = [];


    // --------------------------------------
    // IDEEN LADEN
    // --------------------------------------

    async function loadIdeas() {

        try {

            const result = await api("ideas");

            ideas = result.ideas;

            if (adminSection) {
                adminSection.classList.toggle(
                    "hidden",
                    !result.admin
                );
            }

            renderIdeas();

            if (result.admin) {
                renderPending();
            }

        } catch (error) {

            console.error(error);

            location.href = "index.html";

        }
    }


    // --------------------------------------
    // FREIGEGEBENE IDEEN ANZEIGEN
    // --------------------------------------

    function renderIdeas() {

        let shown = ideas.filter(
            idea => idea.status === "approved"
        );

        const category =
            document.querySelector("#filter-category").value;

        const sort =
            document.querySelector("#sort-ideas").value;


        // Kategorie filtern
        if (category) {

            shown = shown.filter(
                idea => idea.category === category
            );

        }


        // Sortieren
        shown.sort((a, b) => {

            if (sort === "votes") {
                return b.votes - a.votes;
            }

            return b.id.localeCompare(a.id);

        });


        ideasList.replaceChildren();


        if (!shown.length) {

            ideasList.textContent =
                "Noch keine passenden Ideen vorhanden.";

            return;
        }


        shown.forEach(idea => {

            const card = document.createElement("article");

            card.className = "idea-card";


            const title = document.createElement("h3");

            title.textContent = idea.title;


            const description = document.createElement("p");

            description.textContent = idea.description;


            const details = document.createElement("p");

            details.className = "idea-details";

            details.textContent =
                `${idea.category} · von ${idea.nickname} · ${idea.votes} Stimmen`;


            const voteButton = document.createElement("button");

            voteButton.textContent = idea.voted
                ? "Bereits abgestimmt"
                : "Abstimmen";

            voteButton.disabled = idea.voted;


            // Abstimmen
            voteButton.addEventListener("click", async () => {

                voteButton.disabled = true;

                try {

                    await api("vote", {
                        id: idea.id
                    });

                    await loadIdeas();

                } catch (error) {

                    voteButton.disabled = idea.voted;

                    showMessage(
                        ideasMessage,
                        error.message,
                        true
                    );

                }
            });


            card.append(
                title,
                description,
                details,
                voteButton
            );

            ideasList.append(card);

        });
    }


    // --------------------------------------
    // ADMIN: OFFENE IDEEN ANZEIGEN
    // --------------------------------------

    function renderPending() {

        if (!pendingList) return;

        pendingList.replaceChildren();

        const pendingIdeas = ideas.filter(
            idea => idea.status === "pending"
        );


        pendingIdeas.forEach(idea => {

            const card = document.createElement("article");

            card.className = "idea-card";


            const title = document.createElement("h3");

            title.textContent = idea.title;


            const description = document.createElement("p");

            description.textContent =
                `${idea.description} (${idea.category})`;


            card.append(title, description);


            // Admin-Aktionen
            const operations = [
                ["Freigeben", "approved"],
                ["Ablehnen", "rejected"],
                ["Löschen", "delete"]
            ];


            operations.forEach(([label, operation]) => {

                const button = document.createElement("button");

                button.textContent = label;

                button.className = "small-button";


                button.addEventListener("click", async () => {

                    button.disabled = true;

                    try {

                        await api("moderate", {
                            id: idea.id,
                            operation: operation
                        });

                        await loadIdeas();

                    } catch (error) {

                        button.disabled = false;

                        showMessage(
                            ideasMessage,
                            error.message,
                            true
                        );

                    }
                });


                card.append(button);

            });


            pendingList.append(card);

        });


        if (!pendingList.children.length) {

            pendingList.textContent =
                "Keine offenen Ideen.";

        }
    }


    // --------------------------------------
    // NEUE IDEE EINREICHEN
    // --------------------------------------

    if (ideaForm) {

        ideaForm.addEventListener("submit", async event => {

            event.preventDefault();

            const submitButton =
                ideaForm.querySelector('button[type="submit"]');

            const form = new FormData(ideaForm);

            submitButton.disabled = true;

            showMessage(
                ideaMessage,
                "Deine Idee wird eingereicht ..."
            );


            try {

                const result = await api(
                    "add-idea",
                    Object.fromEntries(form)
                );

                showMessage(
                    ideaMessage,
                    result.message
                );

                ideaForm.reset();

            } catch (error) {

                showMessage(
                    ideaMessage,
                    error.message,
                    true
                );

            } finally {

                submitButton.disabled = false;

            }
        });
    }


    // --------------------------------------
    // KATEGORIE-FILTER
    // --------------------------------------

    document
        .querySelector("#filter-category")
        .addEventListener("change", renderIdeas);


    // --------------------------------------
    // SORTIERUNG
    // --------------------------------------

    document
        .querySelector("#sort-ideas")
        .addEventListener("change", renderIdeas);


    // --------------------------------------
    // ABMELDEN
    // --------------------------------------

    const logoutButton =
        document.querySelector("#logout-button");

    if (logoutButton) {

        logoutButton.addEventListener("click", async () => {

            logoutButton.disabled = true;

            try {

                await api("logout");

                location.href = "index.html";

            } catch (error) {

                showMessage(
                    ideasMessage,
                    error.message,
                    true
                );

                logoutButton.disabled = false;

            }
        });
    }


    // --------------------------------------
    // START
    // --------------------------------------

    loadIdeas();

}
