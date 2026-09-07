let myNotes = [];
let sharedNotes = [];


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


function getInitials(username) {

    if (!username) {
        return "--";
    }

    return username
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function(part) {
            return part.charAt(0);
        })
        .join("")
        .toUpperCase();
}


function createPreview(content) {

    const clean =
        String(content || "")
            .replace(/\s+/g, " ")
            .trim();

    if (!clean) {
        return "Belum ada isi catatan.";
    }

    if (clean.length <= 100) {
        return clean;
    }

    return clean.slice(0, 100) + "...";
}


/* ==========================================
   PROFILE
========================================== */

function renderNoteProfile(user) {

    if (!user) {
        return;
    }

    const avatar =
        document.getElementById(
            "noteProfileAvatar"
        );

    const name =
        document.getElementById(
            "noteProfileName"
        );

    const username =
        document.getElementById(
            "noteProfileUsername"
        );


    if (name) {

        name.textContent =
            user.username ||
            "User";
    }


    if (username) {

        username.textContent =
            `@${user.username || "user"}`;
    }


    if (avatar) {

        if (user.avatar_url) {

            avatar.innerHTML =
                "";

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                user.avatar_url;

            image.alt =
                "Profile";

            image.addEventListener(
                "error",
                function() {

                    avatar.innerHTML =
                        "";

                    avatar.textContent =
                        getInitials(
                            user.username
                        );
                }
            );

            avatar.appendChild(
                image
            );

        } else {

            avatar.innerHTML =
                "";

            avatar.textContent =
                getInitials(
                    user.username
                );
        }
    }
}


window.addEventListener(
    "auth:ready",
    function(event) {

        renderNoteProfile(
            event.detail
        );

        loadNotes();
    }
);


try {

    const storedUser =
        localStorage.getItem(
            "wishlist_user"
        );

    if (storedUser) {

        renderNoteProfile(
            JSON.parse(
                storedUser
            )
        );
    }

} catch (error) {

    console.error(
        "Gagal membaca user:",
        error
    );
}


/* ==========================================
   LOAD NOTES
========================================== */

async function loadNotes() {

    try {

        const response =
            await window.apiRequest(
                "/notes",
                {
                    method: "GET"
                }
            );


        myNotes =
            response.my_notes ||
            [];

        sharedNotes =
            response.shared_notes ||
            [];


        renderNotes();

    } catch (error) {

        if (
            error.status === 401
        ) {
            return;
        }

        console.error(
            "Gagal mengambil notes:",
            error
        );

        alert(
            error.message
        );
    }
}


/* ==========================================
   RENDER
========================================== */

function renderNotes() {

    renderNoteGroup(
        document.getElementById(
            "myNotesGrid"
        ),
        myNotes,
        false
    );


    renderNoteGroup(
        document.getElementById(
            "sharedNotesGrid"
        ),
        sharedNotes,
        true
    );


    const myCount =
        document.getElementById(
            "myNoteCount"
        );

    const sharedCount =
        document.getElementById(
            "sharedNoteCount"
        );


    if (myCount) {

        myCount.textContent =
            `${myNotes.length} note`;
    }


    if (sharedCount) {

        sharedCount.textContent =
            `${sharedNotes.length} note`;
    }
}


function renderNoteGroup(
    container,
    notes,
    isShared
) {

    if (!container) {
        return;
    }


    if (!notes.length) {

        container.innerHTML =
            `
                <div class="empty-state">

                    <i class="${
                        isShared
                            ? "fa-solid fa-user-group"
                            : "fa-regular fa-note-sticky"
                    }"></i>

                    ${
                        isShared
                            ? "Belum ada note yang dibagikan denganmu."
                            : "Belum ada note."
                    }

                </div>
            `;

        return;
    }


    container.innerHTML =
        notes
            .map(function(note) {

                const preview =
                    createPreview(
                        note.content
                    );

                const meta =
                    isShared
                        ? `oleh ${escapeHTML(
                            note.owner_username
                        )}`
                        : "Klik untuk membuka";


                return `
                    <button
                        class="note-card"
                        type="button"
                        onclick="openNote(${Number(
                            note.id
                        )})"
                    >

                        <div class="note-title">
                            ${escapeHTML(
                                note.title
                            )}
                        </div>

                        <div class="note-preview">
                            ${escapeHTML(
                                preview
                            )}
                        </div>

                        <div class="note-meta">
                            ${meta}
                        </div>

                    </button>
                `;

            })
            .join("");
}


/* ==========================================
   OPEN NOTE
========================================== */

function openNote(noteID) {

    window.location.href =
        `note.html?id=${encodeURIComponent(
            noteID
        )}`;
}


/* ==========================================
   CREATE MODAL
========================================== */

function openCreateNoteModal() {

    const modal =
        document.getElementById(
            "createNoteModal"
        );

    const title =
        document.getElementById(
            "newNoteTitle"
        );


    if (!modal) {
        return;
    }


    if (title) {

        title.value =
            "";
    }


    modal.classList.add(
        "active"
    );


    setTimeout(
        function() {

            if (title) {
                title.focus();
            }
        },
        50
    );
}


function closeCreateNoteModal() {

    const modal =
        document.getElementById(
            "createNoteModal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );
    }
}


/* ==========================================
   CREATE NOTE
========================================== */

async function createNote() {

    const titleInput =
        document.getElementById(
            "newNoteTitle"
        );

    const button =
        document.getElementById(
            "createNoteSubmit"
        );


    if (!titleInput) {
        return;
    }


    const title =
        titleInput
            .value
            .trim();


    if (!title) {

        alert(
            "Judul note wajib diisi."
        );

        titleInput.focus();

        return;
    }


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Membuat...";
    }


    try {

        const response =
            await window.apiRequest(
                "/notes",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            title,
                            content: ""
                        })
                }
            );


        closeCreateNoteModal();


        window.location.href =
            `note.html?id=${encodeURIComponent(
                response.note.id
            )}`;


    } catch (error) {

        alert(
            error.message
        );


    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "Buat Note";
        }
    }
}


/* ==========================================
   EVENTS
========================================== */

document
    .getElementById(
        "newNoteButton"
    )
    ?.addEventListener(
        "click",
        openCreateNoteModal
    );


document
    .getElementById(
        "createNoteModal"
    )
    ?.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                this
            ) {

                closeCreateNoteModal();
            }
        }
    );


document
    .getElementById(
        "newNoteTitle"
    )
    ?.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key ===
                "Enter"
            ) {

                createNote();
            }
        }
    );


window.openNote =
    openNote;

window.openCreateNoteModal =
    openCreateNoteModal;

window.closeCreateNoteModal =
    closeCreateNoteModal;

window.createNote =
    createNote;