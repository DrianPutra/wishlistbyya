const params =
    new URLSearchParams(
        window.location.search
    );

const noteID =
    params.get(
        "id"
    );


let activeNote = null;

let noteMembers = [];


/* NOTE REALTIME START */

let noteSocket =
    null;

let noteReconnectTimer =
    null;

let realtimeReconnectEnabled =
    true;

/* NOTE REALTIME STATE END */


/* NOTE AUTOSAVE START */

let autosaveTimer =
    null;

let saveInProgress =
    false;

let saveQueued =
    false;

const AUTOSAVE_DELAY =
    800;

/* NOTE AUTOSAVE STATE END */


const titleInput =
    document.getElementById(
        "noteTitle"
    );

const contentInput =
    document.getElementById(
        "noteContent"
    );

const roleElement =
    document.getElementById(
        "noteRole"
    );

const saveStatus =
    document.getElementById(
        "saveStatus"
    );

const saveButton =
    document.getElementById(
        "saveNoteButton"
    );

const deleteButton =
    document.getElementById(
        "deleteNoteButton"
    );

const readonlyMessage =
    document.getElementById(
        "readonlyMessage"
    );

const membersElement =
    document.getElementById(
        "noteMembers"
    );

const shareButton =
    document.getElementById(
        "shareNoteButton"
    );

const shareModal =
    document.getElementById(
        "shareNoteModal"
    );

const shareEmail =
    document.getElementById(
        "shareEmail"
    );

const shareRole =
    document.getElementById(
        "shareRole"
    );

const shareSubmit =
    document.getElementById(
        "shareSubmitButton"
    );

const shareCancel =
    document.getElementById(
        "shareCancelButton"
    );


/* ==========================================
   VALIDATE NOTE ID
========================================== */

if (
    !noteID ||
    !/^\d+$/.test(noteID)
) {

    window.location.replace(
        "notes.html"
    );
}


/* ==========================================
   UTILITIES
========================================== */

function escapeHTML(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function initials(username) {

    if (!username) {
        return "--";
    }


    return username
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function(part) {

            return part
                .charAt(0)
                .toUpperCase();
        })
        .join("");
}


/* ==========================================
   LOAD NOTE
========================================== */

async function loadNote() {

    try {

        const response =
            await window.apiRequest(
                `/notes/${noteID}`,
                {
                    method:
                        "GET"
                }
            );


        activeNote =
            response.note;


        renderNote();


        await loadMembers();

        connectNoteRealtime();


    } catch (error) {

        alert(
            error.message
        );

        window.location.replace(
            "notes.html"
        );
    }
}


/* ==========================================
   RENDER NOTE
========================================== */

function renderNote() {

    if (!activeNote) {
        return;
    }


    document.title =
        `${activeNote.title} - Note`;


    titleInput.value =
        activeNote.title ||
        "";

    contentInput.value =
        activeNote.content ||
        "";


    roleElement.textContent =
        activeNote.role ||
        "";


    const readonly =
        activeNote.role ===
        "viewer";


    titleInput.readOnly =
        readonly;

    contentInput.readOnly =
        readonly;


    saveButton.style.display =
        readonly
            ? "none"
            : "";


    if (readonly) {

        readonlyMessage
            .classList
            .add(
                "visible"
            );

    } else {

        readonlyMessage
            .classList
            .remove(
                "visible"
            );
    }


    deleteButton.style.display =
        activeNote.role ===
        "owner"
            ? ""
            : "none";


    if (
        activeNote.role ===
        "owner"
    ) {

        shareButton
            .classList
            .add(
                "visible"
            );

    } else {

        shareButton
            .classList
            .remove(
                "visible"
            );
    }


    saveStatus.textContent =
        readonly
            ? "Read only"
            : "Semua perubahan tersimpan terakhir kali saat tombol Simpan ditekan.";
}


/* ==========================================
   MEMBERS
========================================== */

async function loadMembers() {

    try {

        const response =
            await window.apiRequest(
                `/notes/${noteID}/members`,
                {
                    method:
                        "GET"
                }
            );


        noteMembers =
            response.members ||
            [];


        renderMembers();


    } catch (error) {

        console.error(
            "Gagal mengambil anggota note:",
            error
        );
    }
}


function renderMembers() {

    if (!membersElement) {
        return;
    }


    if (!noteMembers.length) {

        membersElement.innerHTML =
            `
                <span class="members-label">
                    Anggota
                </span>

                <span class="member-role">
                    Belum ada anggota.
                </span>
            `;

        return;
    }


    const owner =
        activeNote &&
        activeNote.role === "owner";


    const chips =
        noteMembers
            .map(function(member) {

                const canRemove =
                    owner &&
                    member.role !==
                    "owner";


                return `
                    <div class="member-chip">

                        <span class="member-avatar">
                            ${escapeHTML(
                                initials(
                                    member.username
                                )
                            )}
                        </span>

                        <span class="member-name">
                            ${escapeHTML(
                                member.username
                            )}
                        </span>

                        <span class="member-role">
                            ${escapeHTML(
                                member.role
                            )}
                        </span>

                        ${
                            canRemove
                                ? `
                                    <button
                                        class="member-remove"
                                        type="button"
                                        title="Hapus anggota"
                                        onclick="removeMember(${Number(
                                            member.id
                                        )}, '${escapeHTML(
                                            member.username
                                        )}')"
                                    >
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                `
                                : ""
                        }

                    </div>
                `;

            })
            .join("");


    membersElement.innerHTML =
        `
            <span class="members-label">
                Anggota
            </span>

            ${chips}
        `;
}


/* ==========================================
   SAVE NOTE
========================================== */

async function saveNote(
    showError = true
) {

    if (
        !activeNote ||
        activeNote.role ===
        "viewer"
    ) {
        return true;
    }


    if (autosaveTimer) {

        clearTimeout(
            autosaveTimer
        );

        autosaveTimer =
            null;
    }


    /*
       Kalau request sebelumnya masih berjalan,
       jangan kirim request bersamaan.
    */

    if (saveInProgress) {

        saveQueued =
            true;

        return false;
    }


    const title =
        titleInput
            .value
            .trim();

    const content =
        contentInput.value;


    if (!title) {

        saveStatus.textContent =
            "Judul belum diisi";

        if (showError) {

            alert(
                "Judul note wajib diisi."
            );

            titleInput.focus();
        }

        return false;
    }


    /*
       Tidak perlu request kalau isi belum berubah.
    */

    if (
        activeNote.title ===
            title &&
        activeNote.content ===
            content
    ) {

        saveStatus.textContent =
            "Tersimpan ✓";

        return true;
    }


    const savingTitle =
        title;

    const savingContent =
        content;


    saveInProgress =
        true;

    saveQueued =
        false;


    saveButton.disabled =
        true;

    saveButton.textContent =
        "Menyimpan...";

    saveStatus.textContent =
        "Menyimpan...";


    try {

        const response =
            await window.apiRequest(
                `/notes/${noteID}`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({
                            title:
                                savingTitle,

                            content:
                                savingContent
                        })
                }
            );


        activeNote =
            response.note;


        document.title =
            `${activeNote.title} - Note`;


        /*
           Periksa apakah user mengetik lagi
           ketika request tadi masih berjalan.
        */

        const currentTitle =
            titleInput
                .value
                .trim();

        const currentContent =
            contentInput.value;


        if (
            currentTitle ===
                savingTitle &&
            currentContent ===
                savingContent
        ) {

            saveStatus.textContent =
                "Tersimpan ✓";

        } else {

            saveQueued =
                true;

            saveStatus.textContent =
                "Belum disimpan";
        }


        return true;


    } catch (error) {

        saveStatus.textContent =
            "Gagal menyimpan";


        if (showError) {

            alert(
                error.message
            );
        } else {

            console.error(
                "Autosave gagal:",
                error
            );
        }


        return false;


    } finally {

        saveInProgress =
            false;

        saveButton.disabled =
            false;

        saveButton.textContent =
            "Simpan";


        /*
           Kalau ada perubahan baru ketika
           request sebelumnya berjalan,
           simpan lagi.
        */

        if (saveQueued) {

            saveQueued =
                false;


            autosaveTimer =
                setTimeout(
                    function() {

                        saveNote(
                            false
                        );
                    },
                    150
                );
        }
    }
}


/* ==========================================
   AUTOSAVE
========================================== */

function scheduleAutosave() {

    if (
        !activeNote ||
        activeNote.role ===
        "viewer"
    ) {
        return;
    }


    saveStatus.textContent =
        "Belum disimpan";


    if (autosaveTimer) {

        clearTimeout(
            autosaveTimer
        );
    }


    autosaveTimer =
        setTimeout(
            function() {

                saveNote(
                    false
                );

            },
            AUTOSAVE_DELAY
        );
}


titleInput
    .addEventListener(
        "input",
        scheduleAutosave
    );


contentInput
    .addEventListener(
        "input",
        scheduleAutosave
    );


/* NOTE AUTOSAVE END */


/* ==========================================
   DELETE NOTE
========================================== */

async function deleteNote() {

    if (
        !activeNote ||
        activeNote.role !==
        "owner"
    ) {
        return;
    }


    const confirmed =
        window.confirm(
            `Hapus note "${activeNote.title}"?`
        );


    if (!confirmed) {
        return;
    }


    deleteButton.disabled =
        true;


    try {

        await window.apiRequest(
            `/notes/${noteID}`,
            {
                method:
                    "DELETE"
            }
        );


        window.location.replace(
            "notes.html"
        );


    } catch (error) {

        deleteButton.disabled =
            false;

        alert(
            error.message
        );
    }
}


/* ==========================================
   SHARE MODAL
========================================== */

function openShareModal() {

    if (
        !activeNote ||
        activeNote.role !==
        "owner"
    ) {
        return;
    }


    shareEmail.value =
        "";

    shareRole.value =
        "editor";


    shareModal
        .classList
        .add(
            "active"
        );


    setTimeout(
        function() {

            shareEmail.focus();
        },
        50
    );
}


function closeShareModal() {

    shareModal
        .classList
        .remove(
            "active"
        );
}


/* ==========================================
   SHARE NOTE
========================================== */

async function shareNote() {

    const email =
        shareEmail
            .value
            .trim();

    const role =
        shareRole.value;


    if (!email) {

        alert(
            "Email wajib diisi."
        );

        shareEmail.focus();

        return;
    }


    shareSubmit.disabled =
        true;

    shareSubmit.textContent =
        "Membagikan...";


    try {

        await window.apiRequest(
            `/notes/${noteID}/members`,
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        email,
                        role
                    })
            }
        );


        closeShareModal();


        await loadMembers();


    } catch (error) {

        alert(
            error.message
        );


    } finally {

        shareSubmit.disabled =
            false;

        shareSubmit.textContent =
            "Bagikan";
    }
}


/* ==========================================
   REMOVE MEMBER
========================================== */

async function removeMember(
    memberID,
    username
) {

    if (
        !activeNote ||
        activeNote.role !==
        "owner"
    ) {
        return;
    }


    const confirmed =
        window.confirm(
            `Hapus akses ${username} dari note ini?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await window.apiRequest(
            `/notes/${noteID}/members/${memberID}`,
            {
                method:
                    "DELETE"
            }
        );


        await loadMembers();


    } catch (error) {

        alert(
            error.message
        );
    }
}


/* ==========================================
   NOTE REALTIME
========================================== */

function getNoteSocketURL() {

    const token =
        localStorage.getItem(
            "wishlist_token"
        );


    if (
        !token ||
        !noteID
    ) {
        return null;
    }


    return (
        `wss://wishlistbyya-api-production.up.railway.app/ws/notes/${encodeURIComponent(noteID)}` +
        `?token=${encodeURIComponent(token)}`
    );
}


function connectNoteRealtime() {

    if (
        !activeNote ||
        !realtimeReconnectEnabled
    ) {
        return;
    }


    if (
        noteSocket &&
        (
            noteSocket.readyState ===
                WebSocket.OPEN ||
            noteSocket.readyState ===
                WebSocket.CONNECTING
        )
    ) {
        return;
    }


    const socketURL =
        getNoteSocketURL();


    if (!socketURL) {
        return;
    }


    noteSocket =
        new WebSocket(
            socketURL
        );


    noteSocket.addEventListener(
        "open",
        function() {

            console.log(
                "Note realtime terhubung."
            );


            if (noteReconnectTimer) {

                clearTimeout(
                    noteReconnectTimer
                );

                noteReconnectTimer =
                    null;
            }
        }
    );


    noteSocket.addEventListener(
        "message",
        function(event) {

            let message;


            try {

                message =
                    JSON.parse(
                        event.data
                    );

            } catch (error) {

                console.error(
                    "Pesan Note realtime tidak valid:",
                    error
                );

                return;
            }


            handleNoteRealtimeMessage(
                message
            );
        }
    );


    noteSocket.addEventListener(
        "close",
        function() {

            noteSocket =
                null;


            if (
                !realtimeReconnectEnabled
            ) {
                return;
            }


            if (noteReconnectTimer) {

                clearTimeout(
                    noteReconnectTimer
                );
            }


            noteReconnectTimer =
                setTimeout(
                    connectNoteRealtime,
                    2000
                );
        }
    );


    noteSocket.addEventListener(
        "error",
        function(error) {

            console.error(
                "Note WebSocket error:",
                error
            );
        }
    );
}


function handleNoteRealtimeMessage(
    message
) {

    if (!message) {
        return;
    }


    if (
        message.type ===
        "note_updated"
    ) {

        if (
            String(
                message.note_id
            ) !==
            String(
                noteID
            )
        ) {
            return;
        }


        /*
           Jangan timpa perubahan lokal
           yang belum selesai disimpan.
        */

        if (
            saveInProgress ||
            autosaveTimer
        ) {
            return;
        }


        const incomingTitle =
            String(
                message.title || ""
            );

        const incomingContent =
            String(
                message.content || ""
            );


        let changed =
            false;


        if (
            titleInput.value !==
            incomingTitle
        ) {

            titleInput.value =
                incomingTitle;

            changed =
                true;
        }


        if (
            contentInput.value !==
            incomingContent
        ) {

            contentInput.value =
                incomingContent;

            changed =
                true;
        }


        if (activeNote) {

            activeNote.title =
                incomingTitle;

            activeNote.content =
                incomingContent;

            activeNote.updated_at =
                message.updated_at;
        }


        if (changed) {

            document.title =
                `${incomingTitle} - Note`;

            saveStatus.textContent =
                "Diperbarui realtime ✓";
        }


        return;
    }


    if (
        message.type ===
        "note_members_changed"
    ) {

        loadMembers();

        return;
    }
}


/* ==========================================
   CLOSE REALTIME
========================================== */

window.addEventListener(
    "beforeunload",
    function() {

        realtimeReconnectEnabled =
            false;


        if (noteReconnectTimer) {

            clearTimeout(
                noteReconnectTimer
            );

            noteReconnectTimer =
                null;
        }


        if (noteSocket) {

            noteSocket.close();

            noteSocket =
                null;
        }
    }
);


/* NOTE REALTIME END */

/* ==========================================
   EVENTS
========================================== */

saveButton
    .addEventListener(
        "click",
        function() {

            saveNote(
                true
            );
        }
    );


deleteButton
    .addEventListener(
        "click",
        deleteNote
    );


shareButton
    .addEventListener(
        "click",
        openShareModal
    );


shareCancel
    .addEventListener(
        "click",
        closeShareModal
    );


shareSubmit
    .addEventListener(
        "click",
        shareNote
    );


shareEmail
    .addEventListener(
        "keydown",
        function(event) {

            if (
                event.key ===
                "Enter"
            ) {

                shareNote();
            }
        }
    );


shareModal
    .addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                shareModal
            ) {

                closeShareModal();
            }
        }
    );


document
    .addEventListener(
        "keydown",
        function(event) {

            if (
                event.key ===
                "Escape"
            ) {

                closeShareModal();
            }
        }
    );


window.addEventListener(
    "auth:ready",
    function() {

        loadNote();
    }
);




/* ==========================================
   CTRL + S / CMD + S
========================================== */

document
    .addEventListener(
        "keydown",
        function(event) {

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key.toLowerCase() ===
                    "s"
            ) {

                event.preventDefault();


                if (
                    activeNote &&
                    activeNote.role !==
                        "viewer"
                ) {

                    saveNote(
                        true
                    );
                }
            }
        }
    );
window.removeMember =
    removeMember;