/* ==========================================================
   NEKOYA GLOBAL THEME
========================================================== */

const GLOBAL_THEME_KEY =
    "nekoya_theme";


function getSavedTheme() {

    const current =
        localStorage.getItem(
            GLOBAL_THEME_KEY
        );


    if (
        current === "dark" ||
        current === "light"
    ) {
        return current;
    }


    /*
       Migrasi setting theme Wishlist lama
       supaya pilihan user tidak hilang.
    */

    const oldWishlistTheme =
        localStorage.getItem(
            "wishlist_theme"
        );


    if (
        oldWishlistTheme === "dark" ||
        oldWishlistTheme === "light"
    ) {

        localStorage.setItem(
            GLOBAL_THEME_KEY,
            oldWishlistTheme
        );


        return oldWishlistTheme;
    }


    return "light";
}


function setGlobalTheme(
    theme
) {

    const normalized =
        theme === "dark"
            ? "dark"
            : "light";


    document.documentElement
        .dataset
        .theme =
        normalized;


    localStorage.setItem(
        GLOBAL_THEME_KEY,
        normalized
    );


    updateGlobalThemeButton();
}


function updateGlobalThemeButton() {

    const button =
        document.getElementById(
            "globalThemeToggle"
        );


    if (!button) {
        return;
    }


    const dark =
        document.documentElement
            .dataset
            .theme ===
        "dark";


    button.innerHTML =
        dark
            ? '<i class="fa-solid fa-sun"></i>'
            : '<i class="fa-solid fa-moon"></i>';


    button.title =
        dark
            ? "Light mode"
            : "Dark mode";


    button.setAttribute(
        "aria-label",
        dark
            ? "Aktifkan light mode"
            : "Aktifkan dark mode"
    );
}


function toggleGlobalTheme() {

    const current =
        document.documentElement
            .dataset
            .theme;


    setGlobalTheme(
        current === "dark"
            ? "light"
            : "dark"
    );
}


function createGlobalThemeButton() {

    if (
        document.getElementById(
            "globalThemeToggle"
        )
    ) {
        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.id =
        "globalThemeToggle";


    button.className =
        "global-theme-toggle";


    button.type =
        "button";


    button.addEventListener(
        "click",
        toggleGlobalTheme
    );


    document.body.appendChild(
        button
    );


    updateGlobalThemeButton();
}


function initializeGlobalTheme() {

    document.documentElement
        .dataset
        .theme =
        getSavedTheme();


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            createGlobalThemeButton
        );

    } else {

        createGlobalThemeButton();
    }
}


initializeGlobalTheme();