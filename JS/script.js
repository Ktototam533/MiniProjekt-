const API = "php/api.php";

async function api(action, data = {}) {
    const response = await fetch(`${API}?action=${encodeURIComponent(action)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
        throw new Error(result.message || "Ein Fehler ist aufgetreten.");
    }
    return result;
}

function showMessage(element, text, error = false) {
    if (!element) return;
    element.textContent = text;
    element.classList.toggle("error", error);
}

// Anmelde- und Registrierungsseite
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");

if (loginForm && registerForm) {
    const message = document.querySelector("#message");

    document.querySelectorAll(".tab").forEach(button => {
        button.addEventListener("click", () => {
            const registering = button.dataset.tab === "register";
            loginForm.classList.toggle("hidden", registering);
            registerForm.classList.toggle("hidden", !registering);
            document.querySelectorAll(".tab").forEach(tab =>
                tab.classList.toggle("active", tab === button)
            );
            showMessage(message, "");
        });
    });

    loginForm.addEventListener("submit", async event => {
        event.preventDefault();
        const form = new FormData(loginForm);
        try {
            await api("login", Object.fromEntries(form));
            location.href = "ideen.html";
        } catch (error) {
            showMessage(message, error.message, true);
        }
    });

    registerForm.addEventListener("submit", async event => {
        event.preventDefault();
        const form = new FormData(registerForm);
        try {
            const result = await api("register", Object.fromEntries(form));
            showMessage(message, result.message);
            registerForm.reset();
        } catch (error) {
            showMessage(message, error.message, true);
        }
    });
}

// Ideen-Seite
const ideasList = document.querySelector("#ideas-list");

if (ideasList) {
    const ideaForm = document.querySelector("#idea-form");
    const ideaMessage = document.querySelector("#idea-message");
    const ideasMessage = document.querySelector("#ideas-message");
    let ideas = [];

    async function loadIdeas() {
        try {
            const result = await api("ideas");
            ideas = result.ideas;
            document.querySelector("#admin-section")
                .classList.toggle("hidden", !result.admin);
            renderIdeas();
            if (result.admin) renderPending();
        } catch {
            location.href = "index.html";
        }
    }

    function renderIdeas() {
        let shown = [...ideas].filter(idea => idea.status === "approved");
        const category = document.querySelector("#filter-category").value;
        const sort = document.querySelector("#sort-ideas").value;

        if (category) shown = shown.filter(idea => idea.category === category);
        shown.sort((a, b) => sort === "votes"
            ? b.votes - a.votes
            : b.id.localeCompare(a.id));

        ideasList.replaceChildren();

        if (!shown.length) {
            ideasList.textContent = "Noch keine passenden Ideen vorhanden.";
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
            voteButton.textContent = idea.voted ? "Bereits abgestimmt" : "Abstimmen";
            voteButton.disabled = idea.voted;
            voteButton.addEventListener("click", async () => {
                try {
                    await api("vote", { id: idea.id });
                    await loadIdeas();
                } catch (error) {
                    showMessage(ideasMessage, error.message, true);
                }
            });

            card.append(title, description, details, voteButton);
            ideasList.append(card);
        });
    }

    function renderPending() {
        const container = document.querySelector("#pending-list");
        container.replaceChildren();

        ideas.filter(idea => idea.status === "pending").forEach(idea => {
            const card = document.createElement("article");
            card.className = "idea-card";

            const title = document.createElement("h3");
            title.textContent = idea.title;

            const description = document.createElement("p");
            description.textContent = `${idea.description} (${idea.category})`;

            card.append(title, description);

            [["Freigeben", "approved"], ["Ablehnen", "rejected"], ["Löschen", "delete"]]
                .forEach(([label, operation]) => {
                    const button = document.createElement("button");
                    button.textContent = label;
                    button.className = "small-button";
                    button.addEventListener("click", async () => {
                        await api("moderate", { id: idea.id, operation });
                        await loadIdeas();
                    });
                    card.append(button);
                });

            container.append(card);
        });

        if (!container.children.length) {
            container.textContent = "Keine offenen Ideen.";
        }
    }

    ideaForm.addEventListener("submit", async event => {
        event.preventDefault();
        const form = new FormData(ideaForm);
        try {
            const result = await api("add-idea", Object.fromEntries(form));
            showMessage(ideaMessage, result.message);
            ideaForm.reset();
        } catch (error) {
            showMessage(ideaMessage, error.message, true);
        }
    });

    document.querySelector("#filter-category").addEventListener("change", renderIdeas);
    document.querySelector("#sort-ideas").addEventListener("change", renderIdeas);

    document.querySelector("#logout-button").addEventListener("click", async () => {
        await api("logout");
        location.href = "index.html";
    });

    loadIdeas();
}