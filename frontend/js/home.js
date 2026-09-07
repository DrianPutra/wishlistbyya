function getHomeInitials(username) {

    if (!username) {
        return "--";
    }

    return username
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function(part) {
            return part
                .charAt(0)
                .toUpperCase();
        })
        .join("");
}


function renderHomeUser(user) {

    if (!user) {
        return;
    }


    const username =
        document.getElementById(
            "homeUsername"
        );

    const menuName =
        document.getElementById(
            "homeMenuName"
        );

    const menuEmail =
        document.getElementById(
            "homeMenuEmail"
        );

    const menuAvatar =
        document.getElementById(
            "homeMenuAvatar"
        );


    const displayName =
        user.username ||
        user.email ||
        "User";


    if (username) {

        username.textContent =
            displayName;
    }


    if (menuName) {

        menuName.textContent =
            displayName;
    }


    if (menuEmail) {

        menuEmail.textContent =
            user.email ||
            "";
    }


    if (menuAvatar) {

        if (user.avatar_url) {

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                user.avatar_url;

            image.alt =
                "Profile";

            image.addEventListener(
                "error",
                function() {

                    menuAvatar.innerHTML =
                        "";

                    menuAvatar.textContent =
                        getHomeInitials(
                            displayName
                        );
                }
            );


            menuAvatar.innerHTML =
                "";

            menuAvatar.appendChild(
                image
            );

        } else {

            menuAvatar.innerHTML =
                "";

            menuAvatar.textContent =
                getHomeInitials(
                    displayName
                );
        }
    }
}


function loadStoredUser() {

    try {

        const storedUser =
            localStorage.getItem(
                "wishlist_user"
            );

        if (!storedUser) {
            return;
        }


        renderHomeUser(
            JSON.parse(
                storedUser
            )
        );

    } catch (error) {

        console.error(
            "Gagal membaca user:",
            error
        );
    }
}


function openFolders() {

    window.location.href =
        "folders.html";
}


function openNotes() {

    window.location.href =
        "notes.html";
}


function openProfile() {

    window.location.href =
        "profile.html";
}


function toggleAccountMenu() {

    const menu =
        document.getElementById(
            "homeAccountMenu"
        );

    const button =
        document.getElementById(
            "homeMenuToggle"
        );

    if (
        !menu ||
        !button
    ) {
        return;
    }


    const isActive =
        menu.classList.toggle(
            "active"
        );


    button.setAttribute(
        "aria-expanded",
        String(
            isActive
        )
    );
}


function closeAccountMenu() {

    const menu =
        document.getElementById(
            "homeAccountMenu"
        );

    const button =
        document.getElementById(
            "homeMenuToggle"
        );


    if (menu) {

        menu.classList.remove(
            "active"
        );
    }


    if (button) {

        button.setAttribute(
            "aria-expanded",
            "false"
        );
    }
}


function logout() {

    window.clearAuthToken();

    localStorage.removeItem(
        "wishlist_user"
    );

    window.location.replace(
        "login.html"
    );
}


window.addEventListener(
    "auth:ready",
    function(event) {

        renderHomeUser(
            event.detail
        );
    }
);


document.addEventListener(
    "DOMContentLoaded",
    function() {

        const button =
            document.getElementById(
                "homeMenuToggle"
            );


        if (button) {

            button.addEventListener(
                "click",
                function(event) {

                    event.stopPropagation();

                    toggleAccountMenu();
                }
            );
        }
    }
);


document.addEventListener(
    "click",
    function(event) {

        const menuContainer =
            document.querySelector(
                ".home-user-menu"
            );


        if (
            menuContainer &&
            !menuContainer.contains(
                event.target
            )
        ) {

            closeAccountMenu();
        }
    }
);


document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "Escape"
        ) {

            closeAccountMenu();
        }
    }
);


loadStoredUser();


window.openFolders =
    openFolders;

window.openNotes =
    openNotes;

window.openProfile =
    openProfile;

window.logout =
    logout;