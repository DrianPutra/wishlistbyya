const registerForm =
    document.getElementById(
        "registerForm"
    );

const emailInput =
    document.getElementById(
        "email"
    );

const usernameInput =
    document.getElementById(
        "username"
    );

const passwordInput =
    document.getElementById(
        "password"
    );

const confirmPasswordInput =
    document.getElementById(
        "confirmPassword"
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
        input.type === "password"
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
   REGISTER
========================================== */

registerForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const email =
            emailInput
                .value
                .trim();

        const username =
            usernameInput
                .value
                .trim();

        const password =
            passwordInput.value;

        const confirmPassword =
            confirmPasswordInput.value;


        let isValid =
            true;


        /* EMAIL */

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


        /* USERNAME */

        if (
            username.length < 4
        ) {
            showError(
                "usernameError"
            );

            isValid =
                false;

        } else {

            hideError(
                "usernameError"
            );
        }


        /* PASSWORD */

        if (
            password.length < 6
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


        /* CONFIRM */

        if (
            confirmPassword === "" ||
            password !==
            confirmPassword
        ) {
            showError(
                "confirmError"
            );

            isValid =
                false;

        } else {

            hideError(
                "confirmError"
            );
        }


        if (!isValid) {
            return;
        }


        const button =
            registerForm
                .querySelector(
                    'button[type="submit"]'
                );

        const oldText =
            button.textContent;


        button.disabled =
            true;

        button.textContent =
            "Mendaftarkan...";


        try {

            await window.apiRequest(
                "/auth/register",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            email,
                            username,
                            password
                        })
                }
            );


            alert(
                "Akun berhasil dibuat. Silakan masuk."
            );


            window.location.href =
                "login.html";


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
