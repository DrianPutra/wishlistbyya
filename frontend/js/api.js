const API_BASE_URL =
    "https://wishlistbyya-api-production.up.railway.app/api";


/* ==========================================
   TOKEN
========================================== */

function getAuthToken() {
    return localStorage.getItem(
        "wishlist_token"
    );
}


function saveAuthToken(token) {
    localStorage.setItem(
        "wishlist_token",
        token
    );
}


function clearAuthToken() {
    localStorage.removeItem(
        "wishlist_token"
    );

    localStorage.removeItem(
        "wishlist_user"
    );
}


/* ==========================================
   API REQUEST
========================================== */

async function apiRequest(
    endpoint,
    options = {}
) {
    const headers =
        new Headers(
            options.headers || {}
        );


    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
    ) {
        headers.set(
            "Content-Type",
            "application/json"
        );
    }


    const token =
        getAuthToken();


    if (token) {
        headers.set(
            "Authorization",
            `Bearer ${token}`
        );
    }


    let response;

    try {
        response =
            await fetch(
                `${API_BASE_URL}${endpoint}`,
                {
                    ...options,
                    headers
                }
            );

    } catch (error) {

        throw new Error(
            "Tidak dapat terhubung ke server."
        );
    }


    const contentType =
        response.headers.get(
            "content-type"
        ) || "";


    let data = null;


    if (
        contentType.includes(
            "application/json"
        )
    ) {
        data =
            await response.json();

    } else {

        data =
            await response.text();

    }


    if (!response.ok) {

        const error =
            new Error(
                data?.error ||
                `Request gagal (${response.status})`
            );

        error.status =
            response.status;

        error.data =
            data;

        throw error;
    }


    return data;
}


/* ==========================================
   GLOBAL
========================================== */

window.apiRequest =
    apiRequest;

window.getAuthToken =
    getAuthToken;

window.saveAuthToken =
    saveAuthToken;

window.clearAuthToken =
    clearAuthToken;
