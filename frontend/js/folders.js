/* ==========================================
   STATE
========================================== */

let folders = [];
let sharedFolders = [];

let editingId = null;
let deletingId = null;

let selectedType =
    "private";

let temporaryMembers = [];
let originalMembers = [];


/* ==========================================
   ELEMENTS
========================================== */

const folderList =
    document.getElementById(
        "myFolderList"
    );

const sharedFolderList =
    document.getElementById(
        "sharedFolderList"
    );

const emptyState =
    document.getElementById(
        "emptyState"
    );

const sharedEmptyState =
    document.getElementById(
        "sharedEmptyState"
    );

const folderCount =
    document.getElementById(
        "myFolderCount"
    );

const sharedFolderCount =
    document.getElementById(
        "sharedFolderCount"
    );


/* ==========================================
   PROFILE
========================================== */

function renderProfile(user) {
    if (!user) {
        return;
    }

    const name =
        document.querySelector(
            ".profile-name"
        );

    const username =
        document.querySelector(
            ".profile-username"
        );

    const avatar =
        document.querySelector(
            ".profile-avatar"
        );

    if (name) {
        name.textContent =
            user.username;
    }

    if (username) {
        username.textContent =
            `@${user.username}`;
    }

    if (avatar) {

        const initials =
            user.username
                .substring(0, 2)
                .toUpperCase();

        avatar.innerHTML = "";

        if (user.avatar_url) {

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                user.avatar_url;

            image.alt =
                user.username;

            image.style.width =
                "100%";

            image.style.height =
                "100%";

            image.style.objectFit =
                "cover";

            image.style.borderRadius =
                "50%";

            image.onerror =
                function () {

                    avatar.innerHTML =
                        "";

                    avatar.textContent =
                        initials;
                };

            avatar.appendChild(
                image
            );

        } else {

            avatar.textContent =
                initials;
        }
    }
}


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
        console.error(error);
    }
}


window.addEventListener(
    "auth:ready",
    event =>
        renderProfile(
            event.detail
        )
);


/* ==========================================
   LOAD FOLDERS
========================================== */

async function loadFolders() {
    try {
        const response =
            await window.apiRequest(
                "/folders",
                {
                    method: "GET"
                }
            );

        const all =
            response.folders || [];

        folders =
            all.filter(
                folder =>
                    folder.type ===
                    "private"
            );

        sharedFolders =
            all.filter(
                folder =>
                    folder.type ===
                    "shared"
            );

        renderAll();

    } catch (error) {
        if (
            error.status === 401
        ) {
            return;
        }

        alert(
            error.message
        );
    }
}


/* ==========================================
   RENDER
========================================== */

function renderAll() {
    renderFolders();
    renderSharedFolders();
}


function renderFolders() {
    folderList.innerHTML =
        "";

    folderCount.textContent =
        `${folders.length} folder`;

    if (
        folders.length === 0
    ) {
        emptyState.style.display =
            "block";

        return;
    }

    emptyState.style.display =
        "none";

    folders.forEach(
        folder => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "folder-card";

            card.innerHTML = `
                <div class="folder-icon">
                    <i class="fa-solid fa-folder"></i>
                </div>

                <div class="folder-info">

                    <div
                        class="folder-name"
                        onclick="openFolder(${folder.id})"
                    >
                        ${escapeHTML(folder.name)}
                    </div>

                    <div class="folder-description">
                        ${escapeHTML(
                            folder.description ||
                            "Belum ada deskripsi"
                        )}
                    </div>

                    <div class="folder-meta">

                        <span>
                            <i class="fa-regular fa-heart"></i>
                            0 wishlist
                        </span>

                        <span>
                            <i class="fa-solid fa-lock"></i>
                            Pribadi
                        </span>

                    </div>
                </div>

                <button
                    class="folder-menu-btn"
                    onclick="toggleMenu(event, 'my-${folder.id}')"
                >
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>

                <div
                    class="folder-menu"
                    id="menu-my-${folder.id}"
                >

                    <button
                        class="menu-item"
                        onclick="openFolder(${folder.id})"
                    >
                        <i class="fa-regular fa-folder-open"></i>
                        Buka Folder
                    </button>

                    <button
                        class="menu-item"
                        onclick="editFolder('private', ${folder.id})"
                    >
                        <i class="fa-regular fa-pen-to-square"></i>
                        Edit
                    </button>

                    <button
                        class="menu-item delete"
                        onclick="deleteFolder('private', ${folder.id})"
                    >
                        <i class="fa-regular fa-trash-can"></i>
                        Hapus
                    </button>

                </div>
            `;

            folderList.appendChild(
                card
            );
        }
    );
}


function renderSharedFolders() {
    sharedFolderList.innerHTML =
        "";

    sharedFolderCount.textContent =
        `${sharedFolders.length} folder`;

    if (
        sharedFolders.length === 0
    ) {
        sharedEmptyState.style.display =
            "block";

        return;
    }

    sharedEmptyState.style.display =
        "none";

    sharedFolders.forEach(
        folder => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "folder-card";

            const ownerActions =
                folder.is_owner
                    ? `
                        <button
                            class="menu-item"
                            onclick="editFolder('shared', ${folder.id})"
                        >
                            <i class="fa-regular fa-pen-to-square"></i>
                            Edit & Anggota
                        </button>

                        <button
                            class="menu-item delete"
                            onclick="deleteFolder('shared', ${folder.id})"
                        >
                            <i class="fa-regular fa-trash-can"></i>
                            Hapus
                        </button>
                      `
                    : "";

            const accessText =
                folder.is_owner
                    ? "Pemilik"
                    : "Anggota";

            card.innerHTML = `
                <div class="folder-icon">
                    <i class="fa-solid fa-user-group"></i>
                </div>

                <div class="folder-info">

                    <div
                        class="folder-name"
                        onclick="openSharedFolder(${folder.id})"
                    >
                        ${escapeHTML(folder.name)}
                    </div>

                    <div class="folder-description">
                        ${escapeHTML(
                            folder.description ||
                            "Belum ada deskripsi"
                        )}
                    </div>

                    <div class="folder-meta">

                        <span>
                            <i class="fa-solid fa-users"></i>
                            ${folder.member_count || 1} anggota
                        </span>

                        <span>
                            <i class="fa-solid fa-user-shield"></i>
                            ${accessText}
                        </span>

                    </div>
                </div>

                <button
                    class="folder-menu-btn"
                    onclick="toggleMenu(event, 'shared-${folder.id}')"
                >
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>

                <div
                    class="folder-menu"
                    id="menu-shared-${folder.id}"
                >

                    <button
                        class="menu-item"
                        onclick="openSharedFolder(${folder.id})"
                    >
                        <i class="fa-regular fa-folder-open"></i>
                        Buka Folder
                    </button>

                    ${ownerActions}

                </div>
            `;

            sharedFolderList.appendChild(
                card
            );
        }
    );
}


/* ==========================================
   MODAL
========================================== */

function openCreateModal(
    type = "private"
) {
    editingId =
        null;

    selectedType =
        type;

    temporaryMembers =
        [];

    originalMembers =
        [];

    document
        .getElementById(
            "modalTitle"
        )
        .textContent =
        type === "shared"
            ? "Buat Shared Folder"
            : "Buat Folder";

    document
        .getElementById(
            "folderName"
        )
        .value =
        "";

    document
        .getElementById(
            "folderDescription"
        )
        .value =
        "";

    const memberEmail =
        document.getElementById(
            "memberEmail"
        );

    if (memberEmail) {
        memberEmail.value =
            "";
    }

    selectType(type);

    renderMembers();

    document
        .getElementById(
            "folderModal"
        )
        .classList.add(
            "active"
        );
}


function closeModal() {
    document
        .getElementById(
            "folderModal"
        )
        .classList.remove(
            "active"
        );

    editingId =
        null;

    temporaryMembers =
        [];

    originalMembers =
        [];
}


/* ==========================================
   SELECT TYPE
========================================== */

function selectType(type) {
    if (
        editingId !== null &&
        type !== selectedType
    ) {
        return;
    }

    selectedType =
        type;

    const privateOption =
        document.getElementById(
            "privateOption"
        );

    const sharedOption =
        document.getElementById(
            "sharedOption"
        );

    const membersGroup =
        document.getElementById(
            "membersGroup"
        );

    privateOption
        ?.classList.remove(
            "active"
        );

    sharedOption
        ?.classList.remove(
            "active"
        );

    if (
        type === "private"
    ) {
        privateOption
            ?.classList.add(
                "active"
            );

        if (membersGroup) {
            membersGroup.style.display =
                "none";
        }

    } else {

        sharedOption
            ?.classList.add(
                "active"
            );

        if (membersGroup) {
            membersGroup.style.display =
                "block";
        }
    }
}


/* ==========================================
   MEMBER INPUT
========================================== */

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}


function addMember() {
    const input =
        document.getElementById(
            "memberEmail"
        );

    const email =
        input.value
            .trim()
            .toLowerCase();

    if (!email) {
        return;
    }

    if (
        !isValidEmail(email)
    ) {
        alert(
            "Masukkan alamat email yang valid."
        );

        return;
    }

    const currentUserRaw =
        localStorage.getItem(
            "wishlist_user"
        );

    if (currentUserRaw) {
        try {
            const currentUser =
                JSON.parse(
                    currentUserRaw
                );

            if (
                currentUser.email
                    .toLowerCase() ===
                email
            ) {
                alert(
                    "Tidak perlu menambahkan email akunmu sendiri."
                );

                return;
            }
        } catch {
        }
    }

    const exists =
        temporaryMembers.some(
            member =>
                member.email ===
                email
        );

    if (exists) {
        alert(
            "Email tersebut sudah ditambahkan."
        );

        return;
    }

    temporaryMembers.push({
        id: null,
        email: email,
        username: null,
        role: "member"
    });

    input.value =
        "";

    renderMembers();
}


function removeMember(index) {
    temporaryMembers.splice(
        index,
        1
    );

    renderMembers();
}


function handleEmailKey(event) {
    if (
        event.key === "Enter"
    ) {
        event.preventDefault();

        addMember();
    }
}


function renderMembers() {
    const list =
        document.getElementById(
            "memberList"
        );

    if (!list) {
        return;
    }

    list.innerHTML =
        "";

    if (
        temporaryMembers.length === 0
    ) {
        return;
    }

    temporaryMembers.forEach(
        (member, index) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "member-item";

            const initials =
                member.email
                    .substring(0, 2)
                    .toUpperCase();

            item.innerHTML = `
                <div class="member-avatar">
                    ${escapeHTML(initials)}
                </div>

                <div class="member-email">
                    ${escapeHTML(member.email)}
                </div>

                <button
                    class="remove-member"
                    onclick="removeMember(${index})"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;

            list.appendChild(
                item
            );
        }
    );
}


/* ==========================================
   MEMBER API
========================================== */

async function addMembersToFolder(
    folderID,
    members
) {
    const errors = [];

    for (
        const member
        of members
    ) {
        try {
            await window.apiRequest(
                `/folders/${folderID}/members`,
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            email:
                                member.email
                        })
                }
            );

        } catch (error) {

            errors.push(
                `${member.email}: ${error.message}`
            );
        }
    }

    return errors;
}


async function syncMembers(
    folderID
) {
    const errors = [];

    const originalEmails =
        new Set(
            originalMembers.map(
                member =>
                    member.email
            )
        );

    const currentEmails =
        new Set(
            temporaryMembers.map(
                member =>
                    member.email
            )
        );


    /* ADD NEW */

    const additions =
        temporaryMembers.filter(
            member =>
                !originalEmails.has(
                    member.email
                )
        );

    for (
        const member
        of additions
    ) {
        try {
            await window.apiRequest(
                `/folders/${folderID}/members`,
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            email:
                                member.email
                        })
                }
            );

        } catch (error) {

            errors.push(
                `Tambah ${member.email}: ${error.message}`
            );
        }
    }


    /* DELETE REMOVED */

    const removals =
        originalMembers.filter(
            member =>
                !currentEmails.has(
                    member.email
                )
        );

    for (
        const member
        of removals
    ) {
        try {
            await window.apiRequest(
                `/folders/${folderID}/members/${member.id}`,
                {
                    method:
                        "DELETE"
                }
            );

        } catch (error) {

            errors.push(
                `Hapus ${member.email}: ${error.message}`
            );
        }
    }

    return errors;
}


/* ==========================================
   SAVE FOLDER
========================================== */

async function saveFolder() {
    const name =
        document
            .getElementById(
                "folderName"
            )
            .value
            .trim();

    const description =
        document
            .getElementById(
                "folderDescription"
            )
            .value
            .trim();

    if (!name) {
        alert(
            "Nama folder harus diisi."
        );

        return;
    }

    /*
       Jika user sudah mengetik email anggota
       tetapi belum menekan tombol + / Enter,
       masukkan email tersebut sebelum folder disimpan.
    */
    if (selectedType === "shared") {
        const memberInput =
            document.getElementById(
                "memberEmail"
            );

        const pendingEmail =
            memberInput
                ? memberInput.value
                    .trim()
                    .toLowerCase()
                : "";

        if (pendingEmail) {
            if (!isValidEmail(pendingEmail)) {
                alert(
                    "Masukkan alamat email anggota yang valid."
                );

                return;
            }

            const alreadyAdded =
                temporaryMembers.some(
                    member =>
                        member.email ===
                        pendingEmail
                );

            if (!alreadyAdded) {
                temporaryMembers.push({
                    id: null,
                    email: pendingEmail,
                    username: null,
                    role: "member"
                });
            }

            memberInput.value = "";

            renderMembers();
        }
    }

    const button =
        document.querySelector(
            "#folderModal .btn-save"
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
        let memberErrors =
            [];

        if (
            editingId === null
        ) {
            const response =
                await window.apiRequest(
                    "/folders",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                name,
                                description,
                                type:
                                    selectedType
                            })
                    }
                );

            if (
                selectedType ===
                "shared"
            ) {
                memberErrors =
                    await addMembersToFolder(
                        response.folder.id,
                        temporaryMembers
                    );
            }

        } else {

            await window.apiRequest(
                `/folders/${editingId}`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({
                            name,
                            description
                        })
                }
            );

            if (
                selectedType ===
                "shared"
            ) {
                memberErrors =
                    await syncMembers(
                        editingId
                    );
            }
        }

        closeModal();

        await loadFolders();

        if (
            memberErrors.length > 0
        ) {
            alert(
                "Folder tersimpan, tetapi ada masalah anggota:\n\n" +
                memberErrors.join(
                    "\n"
                )
            );
        }

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
   EDIT
========================================== */

async function editFolder(
    type,
    id
) {
    const source =
        type === "shared"
            ? sharedFolders
            : folders;

    const folder =
        source.find(
            item =>
                Number(item.id) ===
                Number(id)
        );

    if (!folder) {
        return;
    }

    if (!folder.is_owner) {
        alert(
            "Hanya pemilik folder yang dapat mengedit folder."
        );

        return;
    }

    editingId =
        folder.id;

    selectedType =
        folder.type;

    document
        .getElementById(
            "modalTitle"
        )
        .textContent =
        folder.type === "shared"
            ? "Edit Shared Folder"
            : "Edit Folder";

    document
        .getElementById(
            "folderName"
        )
        .value =
        folder.name;

    document
        .getElementById(
            "folderDescription"
        )
        .value =
        folder.description || "";

    temporaryMembers =
        [];

    originalMembers =
        [];

    selectType(
        folder.type
    );

    if (
        folder.type ===
        "shared"
    ) {
        try {
            const response =
                await window.apiRequest(
                    `/folders/${folder.id}/members`,
                    {
                        method:
                            "GET"
                    }
                );

            originalMembers =
                (response.members || [])
                    .filter(
                        member =>
                            member.role ===
                            "member"
                    );

            temporaryMembers =
                originalMembers.map(
                    member => ({
                        ...member
                    })
                );

        } catch (error) {

            alert(
                error.message
            );

            return;
        }
    }

    renderMembers();

    document
        .getElementById(
            "folderModal"
        )
        .classList.add(
            "active"
        );
}


function manageMembers(id) {
    editFolder(
        "shared",
        id
    );
}


/* ==========================================
   DELETE FOLDER
========================================== */

function deleteFolder(
    type,
    id
) {
    const source =
        type === "shared"
            ? sharedFolders
            : folders;

    const folder =
        source.find(
            item =>
                Number(item.id) ===
                Number(id)
        );

    if (
        !folder ||
        !folder.is_owner
    ) {
        return;
    }

    deletingId =
        folder.id;

    document
        .getElementById(
            "deleteFolderName"
        )
        .textContent =
        `"${folder.name}"`;

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
        deletingId === null
    ) {
        return;
    }

    try {
        await window.apiRequest(
            `/folders/${deletingId}`,
            {
                method:
                    "DELETE"
            }
        );

        closeDeleteModal();

        deletingId =
            null;

        await loadFolders();

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
   MENU
========================================== */

function toggleMenu(event, menuId) {
    event.stopPropagation();

    const targetMenu =
        document.getElementById(
            `menu-${menuId}`
        );

    if (!targetMenu) {
        return;
    }

    const targetCard =
        targetMenu.closest(
            ".folder-card"
        );

    const willOpen =
        !targetMenu.classList.contains(
            "active"
        );


    /* Tutup semua menu */
    document
        .querySelectorAll(
            ".folder-menu"
        )
        .forEach(menu => {
            menu.classList.remove(
                "active"
            );
        });


    /* Turunkan semua card */
    document
        .querySelectorAll(
            ".folder-card"
        )
        .forEach(card => {
            card.classList.remove(
                "menu-open"
            );
        });


    /* Buka menu yang dipilih */
    if (willOpen) {
        targetMenu.classList.add(
            "active"
        );

        targetCard?.classList.add(
            "menu-open"
        );
    }
}


/* ==========================================
   OPEN
========================================== */

function openFolder(id) {
    localStorage.setItem(
        "activeWishlistFolder",
        id
    );

    window.location.href =
        "wishlist.html";
}


function openSharedFolder(id) {
    localStorage.setItem(
        "activeSharedWishlistFolder",
        id
    );

    window.location.href =
        "wishlistbareng.html";
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


/* ==========================================
   EVENTS
========================================== */

document.addEventListener(
    "click",
    function() {
        document
            .querySelectorAll(
                ".folder-menu"
            )
            .forEach(
                menu =>
                    menu.classList.remove(
                        "active"
                    )
            );

        document
            .querySelectorAll(
                ".folder-card"
            )
            .forEach(
                card =>
                    card.classList.remove(
                        "menu-open"
                    )
            );
    }
);


document
    .getElementById(
        "folderModal"
    )
    ?.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                this
            ) {
                closeModal();
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

loadCachedProfile();

loadFolders();


