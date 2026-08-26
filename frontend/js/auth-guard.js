(async function protectPage() {

    const token =
        window.getAuthToken();


    if (!token) {

        window.location.replace(
            "login.html"
        );

        return;
    }


    try {

        const response =
            await window.apiRequest(
                "/users/me",
                {
                    method:
                        "GET"
                }
            );


        localStorage.setItem(
            "wishlist_user",
            JSON.stringify(
                response.user
            )
        );


        window.currentUser =
            response.user;


        window.dispatchEvent(
            new CustomEvent(
                "auth:ready",
                {
                    detail:
                        response.user
                }
            )
        );


    } catch (error) {

        if (
            error.status === 401
        ) {
            window.clearAuthToken();

            window.location.replace(
                "login.html"
            );

            return;
        }


        console.error(
            "Gagal memeriksa login:",
            error
        );
    }

})();
