/* =========================================
   STATE
========================================= */

const activeFolderId =
    Number(
        localStorage.getItem(
            "activeWishlistFolder"
        )
    );

let activeFolder = null;
let wishlistItems = [];
let editingId = null;


/* =========================================
   ELEMENTS
========================================= */

const modal =
    document.getElementById(
        "modalOverlay"
    );

const grid =
    document.getElementById(
        "wishlistGrid"
    );

const emptyState =
    document.getElementById(
        "emptyState"
    );


/* =========================================
   CHECK ACTIVE FOLDER
========================================= */

if (!activeFolderId) {
    window.location.replace(
        "folders.html"
    );
}


/* =========================================
   UTILITIES
========================================= */

function escapeHTML(text) {
    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(text ?? "");

    return div.innerHTML;
}


function formatPrice(price) {
    const value =
        Number(price);

    if (
        !value ||
        value <= 0
    ) {
        return "Rp -";
    }

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    )
        .format(value)
        .replace(/\s/g, " ");
}


/*
   Input boleh:
   1500000
   1.500.000
   Rp 1.500.000
*/
function parsePrice(value) {
    const cleaned =
        String(value)
            .replace(/[^\d]/g, "");

    if (!cleaned) {
        return 0;
    }

    const number =
        Number(cleaned);

    if (
        !Number.isSafeInteger(number) ||
        number < 0
    ) {
        return null;
    }

    return number;
}


/* =========================================
   LOAD PAGE
========================================= */

async function loadPage() {
    try {
        const [
            folderResponse,
            itemResponse
        ] =
            await Promise.all([
                window.apiRequest(
                    `/folders/${activeFolderId}`,
                    {
                        method: "GET"
                    }
                ),

                window.apiRequest(
                    `/folders/${activeFolderId}/items`,
                    {
                        method: "GET"
                    }
                )
            ]);


        activeFolder =
            folderResponse.folder;


        if (
            activeFolder.type !==
            "private"
        ) {
            alert(
                "Folder ini bukan folder pribadi."
            );

            window.location.replace(
                "folders.html"
            );

            return;
        }


        wishlistItems =
            itemResponse.items || [];


        renderWishlist();


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


/* =========================================
   RELOAD ITEMS
========================================= */

async function loadItems() {
    const response =
        await window.apiRequest(
            `/folders/${activeFolderId}/items`,
            {
                method: "GET"
            }
        );

    wishlistItems =
        response.items || [];

    renderWishlist();
}


/* =========================================
   RENDER
========================================= */

function renderWishlist() {
    grid.innerHTML =
        "";


    if (
        wishlistItems.length === 0
    ) {
        emptyState.style.display =
            "block";

        return;
    }


    emptyState.style.display =
        "none";


    wishlistItems.forEach(
        item => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "wish-card";


            if (item.completed) {
                card.classList.add(
                    "completed"
                );
            }


            const tag =
                item.tag ||
                "Wishlist ✨";


            card.innerHTML = `
                <span class="wish-tag">
                    ${escapeHTML(tag)}
                </span>


                <div class="wish-content">

                    <div class="wish-name">
                        ${escapeHTML(item.name)}
                    </div>

                    <div class="wish-price">
                        ${escapeHTML(
                            formatPrice(
                                item.price
                            )
                        )}
                    </div>

                </div>


                <div class="wish-actions">

                    <button
                        class="btn-action btn-check"
                        onclick="toggleComplete(${item.id})"
                    >

                        ${
                            item.completed
                                ? `
                                    <i class="fa-solid fa-circle-check"></i>
                                    Terwujud ✨
                                  `
                                : `
                                    <i class="fa-regular fa-circle-check"></i>
                                    Terwujud
                                  `
                        }

                    </button>


                    <button
                        class="wish-menu-btn"
                        onclick="
                            toggleMenu(
                                event,
                                ${item.id}
                            )
                        "
                    >
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>

                </div>


                <div
                    class="wish-menu"
                    id="menu-${item.id}"
                >

                    <button
                        class="wish-menu-item"
                        onclick="editWishlist(${item.id})"
                    >
                        <i class="fa-regular fa-pen-to-square"></i>
                        Edit
                    </button>


                    <button
                        class="wish-menu-item delete"
                        onclick="deleteItem(${item.id})"
                    >
                        <i class="fa-regular fa-trash-can"></i>
                        Hapus
                    </button>

                </div>
            `;


            grid.appendChild(
                card
            );
        }
    );
}


/* =========================================
   OPEN MODAL
========================================= */

function openModal() {
    editingId =
        null;


    document
        .getElementById(
            "modalTitle"
        )
        .textContent =
        "Tambah Wishlist 𖹭 ֶָ֢";


    document
        .getElementById(
            "itemName"
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
            "itemTag"
        )
        .value =
        "";


    modal.classList.add(
        "active"
    );


    document
        .getElementById(
            "itemName"
        )
        .focus();
}


/* =========================================
   EDIT
========================================= */

function editWishlist(id) {
    const item =
        wishlistItems.find(
            item =>
                Number(item.id) ===
                Number(id)
        );


    if (!item) {
        return;
    }


    editingId =
        item.id;


    document
        .getElementById(
            "modalTitle"
        )
        .textContent =
        "Edit Wishlist 𖹭 ֶָ֢";


    document
        .getElementById(
            "itemName"
        )
        .value =
        item.name || "";


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
            "itemTag"
        )
        .value =
        item.tag || "";


    closeAllMenus();


    modal.classList.add(
        "active"
    );


    document
        .getElementById(
            "itemName"
        )
        .focus();
}


/* =========================================
   CLOSE MODAL
========================================= */

function closeModal() {
    modal.classList.remove(
        "active"
    );

    editingId =
        null;


    document
        .getElementById(
            "itemName"
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
            "itemTag"
        )
        .value =
        "";
}


/* =========================================
   SAVE ITEM
========================================= */

async function saveWishlistItem() {
    const name =
        document
            .getElementById(
                "itemName"
            )
            .value
            .trim();


    const priceInput =
        document
            .getElementById(
                "itemPrice"
            )
            .value
            .trim();


    const tag =
        document
            .getElementById(
                "itemTag"
            )
            .value
            .trim();


    if (!name) {
        alert(
            "Silakan isi nama barang impianmu!"
        );

        return;
    }


    const price =
        parsePrice(
            priceInput
        );


    if (price === null) {
        alert(
            "Harga tidak valid."
        );

        return;
    }


    const button =
        document.querySelector(
            "#modalOverlay .btn-save"
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
            editingId === null
        ) {

            await window.apiRequest(
                `/folders/${activeFolderId}/items`,
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            name,
                            description: "",
                            price,
                            tag:
                                tag ||
                                "Wishlist ✨",
                            image_url: ""
                        })
                }
            );

        } else {

            await window.apiRequest(
                `/folders/${activeFolderId}/items/${editingId}`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({
                            name,
                            price,
                            tag:
                                tag ||
                                "Wishlist ✨"
                        })
                }
            );
        }


        closeModal();

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


/* =========================================
   TOGGLE COMPLETE
========================================= */

async function toggleComplete(id) {
    const item =
        wishlistItems.find(
            item =>
                Number(item.id) ===
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


/* =========================================
   DELETE
========================================= */

async function deleteItem(id) {
    const item =
        wishlistItems.find(
            item =>
                Number(item.id) ===
                Number(id)
        );


    if (!item) {
        return;
    }


    const confirmed =
        confirm(
            `Hapus "${item.name}" dari wishlist?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await window.apiRequest(
            `/folders/${activeFolderId}/items/${id}`,
            {
                method:
                    "DELETE"
            }
        );


        await loadItems();


    } catch (error) {

        alert(
            error.message
        );
    }
}


/* =========================================
   MENU
========================================= */

function toggleMenu(
    event,
    id
) {
    event.stopPropagation();


    const targetMenu =
        document.getElementById(
            `menu-${id}`
        );


    if (!targetMenu) {
        return;
    }


    const targetCard =
        targetMenu.closest(
            ".wish-card"
        );


    const willOpen =
        !targetMenu.classList.contains(
            "active"
        );


    closeAllMenus();


    if (willOpen) {

        targetMenu.classList.add(
            "active"
        );

        targetCard?.classList.add(
            "menu-open"
        );
    }
}


function closeAllMenus() {
    document
        .querySelectorAll(
            ".wish-menu"
        )
        .forEach(
            menu =>
                menu.classList.remove(
                    "active"
                )
        );


    document
        .querySelectorAll(
            ".wish-card"
        )
        .forEach(
            card =>
                card.classList.remove(
                    "menu-open"
                )
        );
}


/* =========================================
   EVENTS
========================================= */

document.addEventListener(
    "click",
    function() {
        closeAllMenus();
    }
);


modal.addEventListener(
    "click",
    function(event) {

        if (
            event.target ===
            modal
        ) {
            closeModal();
        }
    }
);


/* =========================================
   START
========================================= */

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
