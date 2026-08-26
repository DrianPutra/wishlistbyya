const loginForm =
    document.getElementById(
        "loginForm"
    );

const emailInput =
    document.getElementById(
        "email"
    );

const passwordInput =
    document.getElementById(
        "password"
    );


/* ==========================================
   PASSWORD VISIBILITY
========================================== */

function toggleVisibility(
    inputId,
    icon
) {
    const input =
        document.getElementById(
            inputId
        );

    if (
        input.type ===
        "password"
    ) {
        input.type =
            "text";

        icon.classList.remove(
            "fa-eye"
        );

        icon.classList.add(
            "fa-eye-slash"
        );

    } else {

        input.type =
            "password";

        icon.classList.remove(
            "fa-eye-slash"
        );

        icon.classList.add(
            "fa-eye"
        );
    }
}


function showError(errorId) {
    document
        .getElementById(errorId)
        .style.display =
        "block";
}


function hideError(errorId) {
    document
        .getElementById(errorId)
        .style.display =
        "none";
}


function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}


/* ==========================================
   LOGIN
========================================== */

loginForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const email =
            emailInput
                .value
                .trim();

        const password =
            passwordInput.value;


        let isValid =
            true;


        if (
            !isValidEmail(email)
        ) {
            showError(
                "emailError"
            );

            isValid =
                false;

        } else {

            hideError(
                "emailError"
            );
        }


        if (
            password.length === 0
        ) {
            showError(
                "passwordError"
            );

            isValid =
                false;

        } else {

            hideError(
                "passwordError"
            );
        }


        if (!isValid) {
            return;
        }


        const button =
            loginForm
                .querySelector(
                    'button[type="submit"]'
                );


        const oldText =
            button.textContent;


        button.disabled =
            true;

        button.textContent =
            "Masuk...";


        try {

            const response =
                await window.apiRequest(
                    "/auth/login",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                email,
                                password
                            })
                    }
                );


            window.saveAuthToken(
                response.token
            );


            localStorage.setItem(
                "wishlist_user",
                JSON.stringify(
                    response.user
                )
            );


            window.location.href =
                "folders.html";


        } catch (error) {

            alert(
                error.message
            );


        } finally {

            button.disabled =
                false;

            button.textContent =
                oldText;
        }
    }
);


window.toggleVisibility =
    toggleVisibility;
