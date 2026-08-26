/* ==========================================
   STATE
========================================== */

const activeFolderId =
    Number(
        localStorage.getItem(
            "activeSharedWishlistFolder"
        )
    );

let activeFolder = null;
let members = [];
let wishlists = [];
let activities = [];

let editingWishlistId = null;
let deletingWishlistId = null;


/* ==========================================
   ELEMENTS
========================================== */

const folderNameElement =
    document.getElementById(
        "folderName"
    );

const folderDescriptionElement =
    document.getElementById(
        "folderDescription"
    );

const membersList =
    document.getElementById(
        "membersList"
    );

const wishlistGrid =
    document.getElementById(
        "wishlistGrid"
    );

const emptyWishlist =
    document.getElementById(
        "emptyWishlist"
    );

const wishlistCountElement =
    document.getElementById(
        "wishlistCount"
    );

const totalWishlistElement =
    document.getElementById(
        "totalWishlist"
    );

const completedWishlistElement =
    document.getElementById(
        "completedWishlist"
    );

const totalMembersElement =
    document.getElementById(
        "totalMembers"
    );



const activityList =
    document.getElementById(
        "activityList"
    );

const activityCountElement =
    document.getElementById(
        "activityCount"
    );

/* ==========================================
   CHECK ACTIVE FOLDER
========================================== */

if (!activeFolderId) {
    window.location.replace(
        "folders.html"
    );
}


/* ==========================================
   UTILS
========================================== */

function escapeHTML(text) {
    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(text ?? "");

    return div.innerHTML;
}


function escapeAttribute(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}


function formatPrice(price) {
    const number =
        Number(price);

    if (
        !number ||
        number <= 0
    ) {
        return "";
    }

    return new Intl.NumberFormat(
        "id-ID",
        {
            style:
                "currency",

            currency:
                "IDR",

            maximumFractionDigits:
                0
        }
    ).format(
        number
    );
}


/* ==========================================
   HIDE OLD ADDED BY FIELD
========================================== */

function hideAddedByField() {
    const input =
        document.getElementById(
            "itemAddedBy"
        );

    const group =
        input?.closest(
            ".input-group"
        );

    if (group) {
        group.style.display =
            "none";
    }
}


/* ==========================================
   LOAD PAGE
========================================== */

async function loadPage() {
    try {
        const [
            folderResponse,
            memberResponse,
            itemResponse
        ] =
            await Promise.all([
                window.apiRequest(
                    `/folders/${activeFolderId}`,
                    {
                        method:
                            "GET"
                    }
                ),

                window.apiRequest(
                    `/folders/${activeFolderId}/members`,
                    {
                        method:
                            "GET"
                    }
                ),

                window.apiRequest(
                    `/folders/${activeFolderId}/items`,
                    {
                        method:
                            "GET"
                    }
                )
            ]);


        activeFolder =
            folderResponse.folder;


        if (
            activeFolder.type !==
            "shared"
        ) {
            alert(
                "Folder ini bukan shared folder."
            );

            window.location.replace(
                "folders.html"
            );

            return;
        }


        members =
            memberResponse.members || [];


        wishlists =
            itemResponse.items || [];

        const activityResponse =
            await window.apiRequest(
                `/folders/${activeFolderId}/activities`,
                {
                    method:
                        "GET"
                }
            );

        activities =
            activityResponse.activities || [];


        renderPage();


    } catch (error) {

        if (
            error.status === 401
        ) {
            return;
        }


        alert(
            error.message
        );


        if (
            error.status === 403 ||
            error.status === 404
        ) {
            window.location.replace(
                "folders.html"
            );
        }
    }
}


/* ==========================================
   RELOAD ITEMS ONLY
========================================== */

async function loadItems() {
    const response =
        await window.apiRequest(
            `/folders/${activeFolderId}/items`,
            {
                method:
                    "GET"
            }
        );

    wishlists =
        response.items || [];

    renderWishlists();
    updateStatistics();
}


/* ==========================================
   RENDER PAGE
========================================== */

function renderPage() {
    renderFolderInfo();
    renderMembers();
    renderWishlists();
    updateStatistics();
    renderActivities();

}


/* ==========================================
   FOLDER INFO
========================================== */

function renderFolderInfo() {
    folderNameElement.textContent =
        activeFolder.name;

    folderDescriptionElement.textContent =
        activeFolder.description ||
        "Wishlist yang dibagikan bersama kamu";
}


/* ==========================================
   MEMBERS
========================================== */

function renderMembers() {
    membersList.innerHTML =
        "";

    totalMembersElement.textContent =
        members.length;


    if (
        members.length === 0
    ) {
        membersList.innerHTML = `
            <div class="member-pill">

                <div class="member-pill-avatar">
                    ?
                </div>

                Belum ada anggota

            </div>
        `;

        return;
    }


    members.forEach(
        member => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "member-pill";


            const displayName =
                member.username ||
                member.email;


            const initials =
                displayName
                    .substring(0, 2)
                    .toUpperCase();


            const roleText =
                member.role ===
                "owner"
                    ? " (Pemilik)"
                    : "";


            item.innerHTML = `
                <div class="member-pill-avatar">

                    ${escapeHTML(initials)}

                </div>

                ${escapeHTML(displayName)}
                ${escapeHTML(roleText)}
            `;


            membersList.appendChild(
                item
            );
        }
    );
}



/* ==========================================
   ACTIVITY LOG
========================================== */

function formatActivityTime(value) {
    if (!value) {
        return "";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return new Intl.DateTimeFormat(
        "id-ID",
        {
            day:
                "2-digit",

            month:
                "short",

            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    ).format(date);
}


function getActivityDescription(
    activity
) {
    const itemName =
        escapeHTML(
            activity.item_name ||
            "wishlist"
        );

    switch (
        activity.action
    ) {
        case "wishlist_created":
            return `
                menambahkan
                <strong>${itemName}</strong>
            `;

        case "wishlist_updated":
            return `
                mengubah
                <strong>${itemName}</strong>
            `;

        case "wishlist_completed":
            return `
                menandai
                <strong>${itemName}</strong>
                sebagai sudah dibeli
            `;

        case "wishlist_uncompleted":
            return `
                menandai
                <strong>${itemName}</strong>
                sebagai belum dibeli
            `;

        case "wishlist_deleted":
            return `
                menghapus
                <strong>${itemName}</strong>
            `;

        default:
            return `
                melakukan perubahan pada
                <strong>${itemName}</strong>
            `;
    }
}


function renderActivities() {
    if (
        !activityList ||
        !activityCountElement
    ) {
        return;
    }

    activityList.innerHTML =
        "";

    activityCountElement.textContent =
        `${activities.length} aktivitas`;

    if (
        activities.length === 0
    ) {
        activityList.innerHTML = `
            <div class="activity-empty">
                Belum ada aktivitas.
            </div>
        `;

        return;
    }

    activities.forEach(
        activity => {

            const displayName =
                activity.actor_username ||
                activity.actor_email ||
                "Unknown";

            const initials =
                displayName
                    .substring(0, 2)
                    .toUpperCase();

            const description =
                getActivityDescription(
                    activity
                );

            const time =
                formatActivityTime(
                    activity.created_at
                );

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "activity-item";

            item.innerHTML = `
                <div class="activity-avatar">
                    ${escapeHTML(initials)}
                </div>

                <div class="activity-content">

                    <div class="activity-text">

                        <strong>
                            ${escapeHTML(displayName)}
                        </strong>

                        ${description}

                    </div>

                    <div class="activity-time">
                        ${escapeHTML(time)}
                    </div>

                </div>
            `;

            activityList.appendChild(
                item
            );
        }
    );
}


function applyRealtimeActivity(
    activity
) {
    if (!activity) {
        return;
    }

    const exists =
        activities.some(
            item =>
                Number(item.id) ===
                Number(activity.id)
        );

    if (exists) {
        return;
    }

    activities.unshift(
        activity
    );

    if (
        activities.length > 50
    ) {
        activities =
            activities.slice(
                0,
                50
            );
    }

    renderActivities();
}

/* ==========================================
   WISHLISTS
========================================== */

function renderWishlists() {
    wishlistGrid.innerHTML =
        "";


    wishlistCountElement.textContent =
        `${wishlists.length} item`;


    if (
        wishlists.length === 0
    ) {
        emptyWishlist.style.display =
            "block";

        return;
    }


    emptyWishlist.style.display =
        "none";


    wishlists.forEach(
        item => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "wishlist-card";


            if (item.completed) {
                card.classList.add(
                    "completed"
                );
            }


            const price =
                formatPrice(
                    item.price
                );


            const imageHTML =
                item.image_url
                    ? `
                        <img
                            src="${escapeAttribute(item.image_url)}"
                            alt="${escapeAttribute(item.name)}"
                            onerror="
                                this.style.display='none';
                                this.nextElementSibling.style.display='block';
                            "
                        >

                        <div
                            class="no-image"
                            style="display:none;"
                        >
                            <i class="fa-regular fa-image"></i>
                            Gambar tidak tersedia
                        </div>
                      `
                    : `
                        <div class="no-image">
                            <i class="fa-regular fa-image"></i>
                            Belum ada gambar
                        </div>
                      `;


            card.innerHTML = `
                <div class="wishlist-image">

                    ${imageHTML}

                    ${
                        item.completed
                            ? `
                                <div class="status-badge completed">

                                    <i class="fa-solid fa-check"></i>
                                    Sudah Dibeli

                                </div>
                              `
                            : ""
                    }

                </div>


                <div class="wishlist-content">

                    <div class="wishlist-name">

                        ${escapeHTML(item.name)}

                    </div>


                    <div class="wishlist-description">

                        ${escapeHTML(
                            item.description ||
                            "Belum ada deskripsi"
                        )}

                    </div>


                    <div class="wishlist-bottom">

                        ${
                            price
                                ? `
                                    <div class="wishlist-price">
                                        ${price}
                                    </div>
                                  `
                                : `
                                    <div class="wishlist-price empty">
                                        Harga belum ditentukan
                                    </div>
                                  `
                        }


                        <div class="added-by">

                            oleh

                            <strong>
                                ${escapeHTML(
                                    item.added_by ||
                                    "Unknown"
                                )}
                            </strong>

                        </div>

                    </div>


                    <div class="card-actions">

                        <button
                            class="action-btn"
                            onclick="toggleCompleted(${item.id})"
                        >

                            ${
                                item.completed
                                    ? `
                                        <i class="fa-solid fa-rotate-left"></i>
                                        Belum Dibeli
                                      `
                                    : `
                                        <i class="fa-solid fa-check"></i>
                                        Sudah Dibeli
                                      `
                            }

                        </button>


                        <button
                            class="action-btn"
                            onclick="editWishlist(${item.id})"
                        >

                            <i class="fa-regular fa-pen-to-square"></i>
                            Edit

                        </button>


                        <button
                            class="action-btn delete"
                            onclick="deleteWishlist(${item.id})"
                        >

                            <i class="fa-regular fa-trash-can"></i>

                        </button>

                    </div>

                </div>
            `;


            wishlistGrid.appendChild(
                card
            );
        }
    );
}


/* ==========================================
   STATISTICS
========================================== */

function updateStatistics() {
    totalWishlistElement.textContent =
        wishlists.length;


    const completed =
        wishlists.filter(
            item =>
                item.completed
        ).length;


    completedWishlistElement.textContent =
        completed;


    totalMembersElement.textContent =
        members.length;
}


/* ==========================================
   OPEN MODAL
========================================== */

function openWishlistModal() {
    editingWishlistId =
        null;


    document
        .getElementById(
            "modalTitle"
        )
        .textContent =
        "Tambah Wishlist";


    document
        .getElementById(
            "itemName"
        )
        .value =
        "";


    document
        .getElementById(
            "itemDescription"
        )
        .value =
        "";


    document
        .getElementById(
            "itemPrice"
        )
        .value =
        "";


    document
        .getElementById(
            "itemImage"
        )
        .value =
        "";


    document
        .getElementById(
            "wishlistModal"
        )
        .classList.add(
            "active"
        );


    setTimeout(
        () => {

            document
                .getElementById(
                    "itemName"
                )
                .focus();

        },
        100
    );
}


/* ==========================================
   CLOSE MODAL
========================================== */

function closeWishlistModal() {
    document
        .getElementById(
            "wishlistModal"
        )
        .classList.remove(
            "active"
        );

    editingWishlistId =
        null;
}


/* ==========================================
   SAVE WISHLIST
========================================== */

async function saveWishlist() {
    const name =
        document
            .getElementById(
                "itemName"
            )
            .value
            .trim();


    const description =
        document
            .getElementById(
                "itemDescription"
            )
            .value
            .trim();


    const priceValue =
        document
            .getElementById(
                "itemPrice"
            )
            .value;


    const imageURL =
        document
            .getElementById(
                "itemImage"
            )
            .value
            .trim();


    if (!name) {
        alert(
            "Nama barang harus diisi."
        );

        return;
    }


    const price =
        parsePriceInput(
            priceValue
        );


    if (
        !Number.isFinite(price) ||
        price < 0
    ) {
        alert(
            "Harga tidak valid."
        );

        return;
    }


    const button =
        document.querySelector(
            "#wishlistModal .btn-save"
        );


    const oldText =
        button
            ? button.textContent
            : "Simpan";


    if (button) {
        button.disabled =
            true;

        button.textContent =
            "Menyimpan...";
    }


    try {

        if (
            editingWishlistId === null
        ) {

            await window.apiRequest(
                `/folders/${activeFolderId}/items`,
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            name,
                            description,
                            price,
                            tag: "",
                            image_url:
                                imageURL
                        })
                }
            );

        } else {

            await window.apiRequest(
                `/folders/${activeFolderId}/items/${editingWishlistId}`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({
                            name,
                            description,
                            price,
                            image_url:
                                imageURL
                        })
                }
            );
        }


        closeWishlistModal();

        await loadItems();


    } catch (error) {

        alert(
            error.message
        );


    } finally {

        if (button) {
            button.disabled =
                false;

            button.textContent =
                oldText;
        }
    }
}


/* ==========================================
   EDIT WISHLIST
========================================== */

function editWishlist(id) {
    const item =
        wishlists.find(
            wishlist =>
                Number(wishlist.id) ===
                Number(id)
        );


    if (!item) {
        return;
    }


    editingWishlistId =
        item.id;


    document
        .getElementById(
            "modalTitle"
        )
        .textContent =
        "Edit Wishlist";


    document
        .getElementById(
            "itemName"
        )
        .value =
        item.name || "";


    document
        .getElementById(
            "itemDescription"
        )
        .value =
        item.description || "";


    document
        .getElementById(
            "itemPrice"
        )
        .value =
        item.price > 0
            ? formatPriceInput(item.price)
            : "";


    document
        .getElementById(
            "itemImage"
        )
        .value =
        item.image_url || "";


    document
        .getElementById(
            "wishlistModal"
        )
        .classList.add(
            "active"
        );
}


/* ==========================================
   TOGGLE COMPLETED
========================================== */

async function toggleCompleted(id) {
    const item =
        wishlists.find(
            wishlist =>
                Number(wishlist.id) ===
                Number(id)
        );


    if (!item) {
        return;
    }


    try {

        await window.apiRequest(
            `/folders/${activeFolderId}/items/${id}`,
            {
                method:
                    "PATCH",

                body:
                    JSON.stringify({
                        completed:
                            !item.completed
                    })
            }
        );


        await loadItems();


    } catch (error) {

        alert(
            error.message
        );
    }
}


/* ==========================================
   DELETE
========================================== */

function deleteWishlist(id) {
    const item =
        wishlists.find(
            wishlist =>
                Number(wishlist.id) ===
                Number(id)
        );


    if (!item) {
        return;
    }


    deletingWishlistId =
        item.id;


    document
        .getElementById(
            "deleteItemName"
        )
        .textContent =
        `"${item.name}"`;


    document
        .getElementById(
            "deleteModal"
        )
        .classList.add(
            "active"
        );
}


async function confirmDelete() {
    if (
        deletingWishlistId === null
    ) {
        return;
    }


    try {

        await window.apiRequest(
            `/folders/${activeFolderId}/items/${deletingWishlistId}`,
            {
                method:
                    "DELETE"
            }
        );


        closeDeleteModal();

        deletingWishlistId =
            null;


        await loadItems();


    } catch (error) {

        alert(
            error.message
        );
    }
}


function closeDeleteModal() {
    document
        .getElementById(
            "deleteModal"
        )
        .classList.remove(
            "active"
        );
}


/* ==========================================
   BACK
========================================== */

function goBack() {
    window.location.href =
        "folders.html";
}


/* ==========================================
   MODAL OUTSIDE CLICK
========================================== */

document
    .getElementById(
        "wishlistModal"
    )
    ?.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                this
            ) {
                closeWishlistModal();
            }
        }
    );


document
    .getElementById(
        "deleteModal"
    )
    ?.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                this
            ) {
                closeDeleteModal();
            }
        }
    );


/* ==========================================
   START
========================================== */

hideAddedByField();

loadPage();

/* PRICE INPUT FORMAT START */

function formatPriceInput(value) {
    const digits =
        String(value ?? "")
            .replace(/\D/g, "");

    if (!digits) {
        return "";
    }

    return digits.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        "."
    );
}


function parsePriceInput(value) {
    const digits =
        String(value ?? "")
            .replace(/\D/g, "");

    if (!digits) {
        return 0;
    }

    const number =
        Number(digits);

    if (
        !Number.isSafeInteger(number) ||
        number < 0
    ) {
        return null;
    }

    return number;
}


function handlePriceTyping(event) {
    const input =
        event.target;

    const oldValue =
        input.value;

    const oldCursor =
        input.selectionStart ??
        oldValue.length;

    const digitsBeforeCursor =
        oldValue
            .slice(0, oldCursor)
            .replace(/\D/g, "")
            .length;


    const formatted =
        formatPriceInput(
            oldValue
        );

    input.value =
        formatted;


    let newCursor = 0;
    let digitCount = 0;

    while (
        newCursor < formatted.length &&
        digitCount < digitsBeforeCursor
    ) {
        if (
            /\d/.test(
                formatted[newCursor]
            )
        ) {
            digitCount++;
        }

        newCursor++;
    }


    input.setSelectionRange(
        newCursor,
        newCursor
    );
}


document
    .getElementById(
        "itemPrice"
    )
    ?.addEventListener(
        "input",
        handlePriceTyping
    );

/* PRICE INPUT FORMAT END */


/* REALTIME DIRECT UPDATE START */

function applyRealtimeWishlistChange(message) {
    if (message.action === "created" && message.item) {

        const exists =
            wishlists.some(
                item =>
                    Number(item.id) ===
                    Number(message.item.id)
            );

        if (!exists) {
            wishlists.unshift(
                message.item
            );
        }

        renderWishlists();
        updateStatistics();

        return;
    }


    if (message.action === "updated" && message.item) {

        const index =
            wishlists.findIndex(
                item =>
                    Number(item.id) ===
                    Number(message.item.id)
            );

        if (index !== -1) {
            wishlists[index] =
                message.item;
        } else {
            wishlists.unshift(
                message.item
            );
        }

        renderWishlists();
        updateStatistics();

        return;
    }


    if (message.action === "deleted") {

        wishlists =
            wishlists.filter(
                item =>
                    Number(item.id) !==
                    Number(message.item_id)
            );

        renderWishlists();
        updateStatistics();

        return;
    }


    loadItems().catch(
        error => {
            console.error(
                "Gagal sinkronisasi wishlist:",
                error
            );
        }
    );
}

/* REALTIME DIRECT UPDATE END */

/* REALTIME WEBSOCKET START */

let wishlistSocket = null;
let realtimeReloadTimer = null;
let realtimeReconnectTimer = null;
let allowRealtimeReconnect = true;

function scheduleRealtimeReload() {
    clearTimeout(realtimeReloadTimer);

    realtimeReloadTimer = setTimeout(
        async function() {
            try {
                await loadItems();
            } catch (error) {
                console.error(
                    "Gagal mengambil update realtime:",
                    error
                );
            }
        },
        120
    );
}

function connectRealtime() {
    const token =
        localStorage.getItem(
            "wishlist_token"
        );

    if (!token || !activeFolderId) {
        return;
    }

    if (
        wishlistSocket &&
        (
            wishlistSocket.readyState === WebSocket.OPEN ||
            wishlistSocket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    const socketURL =
        `wss://wishlistbyya-api-production.up.railway.app/ws/folders/${activeFolderId}` +
        `?token=${encodeURIComponent(token)}`;

    wishlistSocket =
        new WebSocket(socketURL);

    wishlistSocket.addEventListener(
        "open",
        function() {
            console.log(
                "Realtime wishlist terhubung."
            );
        }
    );

    wishlistSocket.addEventListener(
        "message",
        function(event) {
            let message;

            try {
                message =
                    JSON.parse(event.data);
            } catch (error) {
                console.error(
                    "Pesan realtime tidak valid:",
                    error
                );

                return;
            }

            console.log(
                "Realtime message:",
                message
            );

            if (
                message.type ===
                "wishlist_changed"
            ) {
                applyRealtimeWishlistChange(
                    message
                );
            }

            if (
                message.type ===
                "activity_created" &&
                message.activity
            ) {
                applyRealtimeActivity(
                    message.activity
                );
            }
        }
    );

    wishlistSocket.addEventListener(
        "close",
        function() {
            console.log(
                "Realtime wishlist terputus."
            );

            wishlistSocket = null;

            if (!allowRealtimeReconnect) {
                return;
            }

            clearTimeout(
                realtimeReconnectTimer
            );

            realtimeReconnectTimer =
                setTimeout(
                    connectRealtime,
                    2000
                );
        }
    );

    wishlistSocket.addEventListener(
        "error",
        function(error) {
            console.error(
                "WebSocket error:",
                error
            );
        }
    );
}

window.addEventListener(
    "beforeunload",
    function() {
        allowRealtimeReconnect = false;

        clearTimeout(
            realtimeReconnectTimer
        );

        if (wishlistSocket) {
            wishlistSocket.close();
        }
    }
);

connectRealtime();

/* REALTIME WEBSOCKET END */