(async function redirectLoggedInUser() {

    const token =
        window.getAuthToken();

    if (!token) {
        return;
    }

    try {

        const response =
            await window.apiRequest(
                "/users/me",
                {
                    method: "GET"
                }
            );

        localStorage.setItem(
            "wishlist_user",
            JSON.stringify(
                response.user
            )
        );

        window.location.replace(
            "home.html"
        );

    } catch (error) {

        if (
            error.status === 401
        ) {

            window.clearAuthToken();

            localStorage.removeItem(
                "wishlist_user"
            );

            return;
        }

        console.error(
            "Gagal memeriksa session:",
            error
        );
    }

})();