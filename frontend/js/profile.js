let currentProfile = null;
let selectedAvatarFile = null;


/* ==========================================
   ELEMENTS
========================================== */

const profileAvatar =
    document.getElementById("profileAvatar");

const heroUsername =
    document.getElementById("heroUsername");

const heroEmail =
    document.getElementById("heroEmail");

const usernameInput =
    document.getElementById("username");

const emailInput =
    document.getElementById("email");

const avatarInput =
    document.getElementById("avatarInput");

const chooseAvatarButton =
    document.getElementById("chooseAvatarButton");

const uploadAvatarButton =
    document.getElementById("uploadAvatarButton");

const deleteAvatarButton =
    document.getElementById("deleteAvatarButton");

const profileForm =
    document.getElementById("profileForm");

const passwordForm =
    document.getElementById("passwordForm");

const pageMessage =
    document.getElementById("pageMessage");


/* ==========================================
   MESSAGE
========================================== */

function showMessage(
    message,
    type = "success"
) {
    pageMessage.textContent =
        message;

    pageMessage.className =
        `message ${type}`;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function clearMessage() {
    pageMessage.textContent = "";
    pageMessage.className = "message";
}


/* ==========================================
   PROFILE
========================================== */

function getInitials(username) {
    const value =
        String(username || "")
            .trim();

    if (!value) {
        return "--";
    }

    return value
        .substring(0, 2)
        .toUpperCase();
}


function renderAvatar(
    user,
    previewURL = ""
) {
    profileAvatar.innerHTML = "";

    const imageURL =
        previewURL ||
        user?.avatar_url ||
        "";

    if (!imageURL) {
        profileAvatar.textContent =
            getInitials(
                user?.username
            );

        return;
    }

    const image =
        document.createElement("img");

    image.src = imageURL;
    image.alt = "Foto profile";

    image.onerror =
        function () {
            profileAvatar.innerHTML =
                "";

            profileAvatar.textContent =
                getInitials(
                    user?.username
                );
        };

    profileAvatar.appendChild(image);
}


function renderProfile(user) {
    if (!user) {
        return;
    }

    currentProfile = user;

    heroUsername.textContent =
        user.username || "-";

    heroEmail.textContent =
        user.email || "-";

    usernameInput.value =
        user.username || "";

    emailInput.value =
        user.email || "";

    renderAvatar(user);

    deleteAvatarButton.style.display =
        user.avatar_url
            ? "inline-block"
            : "none";

    localStorage.setItem(
        "wishlist_user",
        JSON.stringify(user)
    );
}


/* ==========================================
   LOAD PROFILE
========================================== */

function loadCachedProfile() {
    const raw =
        localStorage.getItem(
            "wishlist_user"
        );

    if (!raw) {
        return;
    }

    try {
        renderProfile(
            JSON.parse(raw)
        );
    } catch (error) {
        console.error(
            "Cache profile tidak valid:",
            error
        );
    }
}


async function loadProfile() {
    try {
        const response =
            await window.apiRequest(
                "/users/me",
                {
                    method: "GET"
                }
            );

        renderProfile(
            response.user
        );

    } catch (error) {
        if (error.status !== 401) {
            showMessage(
                error.message,
                "error"
            );
        }
    }
}


/* ==========================================
   UPDATE PROFILE
========================================== */

profileForm.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        clearMessage();

        const username =
            usernameInput.value
                .trim();

        const email =
            emailInput.value
                .trim()
                .toLowerCase();

        if (username.length < 2) {
            showMessage(
                "Username minimal 2 karakter.",
                "error"
            );

            return;
        }

        const button =
            document.getElementById(
                "saveProfileButton"
            );

        const originalText =
            button.textContent;

        button.disabled = true;
        button.textContent =
            "Menyimpan...";

        try {
            const response =
                await window.apiRequest(
                    "/users/me",
                    {
                        method: "PATCH",

                        body:
                            JSON.stringify({
                                username,
                                email
                            })
                    }
                );

            renderProfile(
                response.user
            );

            showMessage(
                response.message ||
                "Profile berhasil diperbarui."
            );

        } catch (error) {
            showMessage(
                error.message,
                "error"
            );

        } finally {
            button.disabled = false;
            button.textContent =
                originalText;
        }
    }
);


/* ==========================================
   AVATAR SELECT
========================================== */

chooseAvatarButton.addEventListener(
    "click",
    function () {
        avatarInput.click();
    }
);


avatarInput.addEventListener(
    "change",
    function () {
        clearMessage();

        const file =
            avatarInput.files?.[0];

        if (!file) {
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (
            !allowedTypes.includes(
                file.type
            )
        ) {
            avatarInput.value = "";

            showMessage(
                "Format foto harus JPG, PNG, atau WEBP.",
                "error"
            );

            return;
        }

        if (
            file.size >
            5 * 1024 * 1024
        ) {
            avatarInput.value = "";

            showMessage(
                "Ukuran foto maksimal 5 MB.",
                "error"
            );

            return;
        }

        selectedAvatarFile =
            file;

        uploadAvatarButton.disabled =
            false;

        const previewURL =
            URL.createObjectURL(file);

        renderAvatar(
            currentProfile,
            previewURL
        );
    }
);


/* ==========================================
   AVATAR UPLOAD
========================================== */

uploadAvatarButton.addEventListener(
    "click",
    async function () {
        clearMessage();

        if (!selectedAvatarFile) {
            showMessage(
                "Pilih foto terlebih dahulu.",
                "error"
            );

            return;
        }

        const originalText =
            uploadAvatarButton.textContent;

        uploadAvatarButton.disabled =
            true;

        uploadAvatarButton.textContent =
            "Mengupload...";

        try {
            const formData =
                new FormData();

            formData.append(
                "avatar",
                selectedAvatarFile
            );

            const response =
                await window.apiRequest(
                    "/users/me/avatar",
                    {
                        method: "POST",
                        body: formData
                    }
                );

            selectedAvatarFile =
                null;

            avatarInput.value = "";

            renderProfile(
                response.user
            );

            showMessage(
                response.message ||
                "Foto profile berhasil diperbarui."
            );

        } catch (error) {
            renderAvatar(
                currentProfile
            );

            showMessage(
                error.message,
                "error"
            );

        } finally {
            uploadAvatarButton.disabled =
                selectedAvatarFile === null;

            uploadAvatarButton.textContent =
                originalText;
        }
    }
);


/* ==========================================
   DELETE AVATAR
========================================== */

deleteAvatarButton.addEventListener(
    "click",
    async function () {
        if (
            !currentProfile?.avatar_url
        ) {
            return;
        }

        const confirmed =
            confirm(
                "Hapus foto profile?"
            );

        if (!confirmed) {
            return;
        }

        clearMessage();

        const originalText =
            deleteAvatarButton.textContent;

        deleteAvatarButton.disabled =
            true;

        deleteAvatarButton.textContent =
            "Menghapus...";

        try {
            const response =
                await window.apiRequest(
                    "/users/me/avatar",
                    {
                        method: "DELETE"
                    }
                );

            renderProfile(
                response.user
            );

            showMessage(
                response.message ||
                "Foto profile berhasil dihapus."
            );

        } catch (error) {
            showMessage(
                error.message,
                "error"
            );

        } finally {
            deleteAvatarButton.disabled =
                false;

            deleteAvatarButton.textContent =
                originalText;
        }
    }
);


/* ==========================================
   PASSWORD
========================================== */

passwordForm.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        clearMessage();

        const currentPassword =
            document
                .getElementById(
                    "currentPassword"
                )
                .value;

        const newPassword =
            document
                .getElementById(
                    "newPassword"
                )
                .value;

        const confirmPassword =
            document
                .getElementById(
                    "confirmPassword"
                )
                .value;

        if (newPassword.length < 8) {
            showMessage(
                "Password baru minimal 8 karakter.",
                "error"
            );

            return;
        }

        if (
            newPassword !==
            confirmPassword
        ) {
            showMessage(
                "Konfirmasi password baru tidak sama.",
                "error"
            );

            return;
        }

        const button =
            document.getElementById(
                "changePasswordButton"
            );

        const originalText =
            button.textContent;

        button.disabled = true;
        button.textContent =
            "Mengubah...";

        try {
            const response =
                await window.apiRequest(
                    "/users/me/password",
                    {
                        method: "PATCH",

                        body:
                            JSON.stringify({
                                current_password:
                                    currentPassword,

                                new_password:
                                    newPassword
                            })
                    }
                );

            passwordForm.reset();

            showMessage(
                response.message ||
                "Password berhasil diperbarui."
            );

        } catch (error) {
            showMessage(
                error.message,
                "error"
            );

        } finally {
            button.disabled = false;
            button.textContent =
                originalText;
        }
    }
);


/* ==========================================
   AUTH READY
========================================== */

window.addEventListener(
    "auth:ready",
    function (event) {
        renderProfile(
            event.detail
        );
    }
);


/* ==========================================
   START
========================================== */

loadCachedProfile();
loadProfile();