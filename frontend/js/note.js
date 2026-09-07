const params =
    new URLSearchParams(
        window.location.search
    );

const noteID =
    params.get(
        "id"
    );


let activeNote =
    null;


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


/* ==========================================
   VALIDATE ID
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
   RENDER
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


    saveStatus.textContent =
        readonly
            ? "Read only"
            : "Semua perubahan tersimpan terakhir kali saat tombol Simpan ditekan.";
}


/* ==========================================
   SAVE
========================================== */

async function saveNote() {

    if (
        !activeNote ||
        activeNote.role ===
        "viewer"
    ) {
        return;
    }


    const title =
        titleInput
            .value
            .trim();

    const content =
        contentInput.value;


    if (!title) {

        alert(
            "Judul note wajib diisi."
        );

        titleInput.focus();

        return;
    }


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
                            title,
                            content
                        })
                }
            );


        activeNote =
            response.note;


        document.title =
            `${activeNote.title} - Note`;


        saveStatus.textContent =
            "Tersimpan ✓";


    } catch (error) {

        saveStatus.textContent =
            "Gagal menyimpan";

        alert(
            error.message
        );


    } finally {

        saveButton.disabled =
            false;

        saveButton.textContent =
            "Simpan";
    }
}


/* ==========================================
   DIRTY STATUS
========================================== */

function markUnsaved() {

    if (
        !activeNote ||
        activeNote.role ===
        "viewer"
    ) {
        return;
    }


    saveStatus.textContent =
        "Belum disimpan";
}


titleInput
    .addEventListener(
        "input",
        markUnsaved
    );


contentInput
    .addEventListener(
        "input",
        markUnsaved
    );


/* ==========================================
   DELETE
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
   EVENTS
========================================== */

saveButton
    .addEventListener(
        "click",
        saveNote
    );


deleteButton
    .addEventListener(
        "click",
        deleteNote
    );


window.addEventListener(
    "auth:ready",
    function() {

        loadNote();
    }
);