package handler

import (
	"errors"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NoteHandler struct {
	DB *pgxpool.Pool
}

type Note struct {
	ID            int64     `json:"id"`
	OwnerID       int64     `json:"owner_id"`
	OwnerUsername string    `json:"owner_username"`
	Title         string    `json:"title"`
	Content       string    `json:"content"`
	Role          string    `json:"role"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type NoteMember struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type CreateNoteRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type UpdateNoteRequest struct {
	Title   *string `json:"title"`
	Content *string `json:"content"`
}

type ShareNoteRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

func NewNoteHandler(
	db *pgxpool.Pool,
) *NoteHandler {

	return &NoteHandler{
		DB: db,
	}
}

/* ==========================================
   PARSE NOTE ID
========================================== */

func parseNoteID(
	c *gin.Context,
) (int64, bool) {

	noteID, err :=
		strconv.ParseInt(
			c.Param("id"),
			10,
			64,
		)

	if err != nil ||
		noteID <= 0 {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "note id tidak valid",
			},
		)

		return 0, false
	}

	return noteID, true
}

/* ==========================================
   GET USER ROLE IN NOTE
========================================== */

func (h *NoteHandler) getRole(
	c *gin.Context,
	noteID int64,
	userID int64,
) (string, error) {

	var role string

	err :=
		h.DB.QueryRow(
			c.Request.Context(),
			`
                SELECT
                    CASE
                        WHEN n.owner_id = $2
                            THEN 'owner'
                        ELSE nm.role
                    END
                FROM notes n

                LEFT JOIN note_members nm
                    ON nm.note_id = n.id
                    AND nm.user_id = $2

                WHERE n.id = $1
                AND (
                    n.owner_id = $2
                    OR nm.user_id = $2
                )
            `,
			noteID,
			userID,
		).Scan(
			&role,
		)

	return role, err
}

/* ==========================================
   LIST NOTES
========================================== */

func (h *NoteHandler) List(
	c *gin.Context,
) {

	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	/* MY NOTES */

	myRows, err :=
		h.DB.Query(
			c.Request.Context(),
			`
                SELECT
                    n.id,
                    n.owner_id,
                    u.username,
                    n.title,
                    n.content,
                    'owner'::TEXT,
                    n.created_at,
                    n.updated_at

                FROM notes n

                JOIN users u
                    ON u.id = n.owner_id

                WHERE n.owner_id = $1

                ORDER BY
                    n.updated_at DESC,
                    n.id DESC
            `,
			userID,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil note",
			},
		)

		return
	}

	defer myRows.Close()

	myNotes :=
		make([]Note, 0)

	for myRows.Next() {

		var note Note

		err :=
			myRows.Scan(
				&note.ID,
				&note.OwnerID,
				&note.OwnerUsername,
				&note.Title,
				&note.Content,
				&note.Role,
				&note.CreatedAt,
				&note.UpdatedAt,
			)

		if err != nil {

			c.JSON(
				http.StatusInternalServerError,
				gin.H{
					"error": "gagal membaca note",
				},
			)

			return
		}

		myNotes =
			append(
				myNotes,
				note,
			)
	}

	if err := myRows.Err(); err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membaca note",
			},
		)

		return
	}

	/* SHARED WITH ME */

	sharedRows, err :=
		h.DB.Query(
			c.Request.Context(),
			`
                SELECT
                    n.id,
                    n.owner_id,
                    u.username,
                    n.title,
                    n.content,
                    nm.role,
                    n.created_at,
                    n.updated_at

                FROM note_members nm

                JOIN notes n
                    ON n.id = nm.note_id

                JOIN users u
                    ON u.id = n.owner_id

                WHERE nm.user_id = $1

                ORDER BY
                    n.updated_at DESC,
                    n.id DESC
            `,
			userID,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil shared note",
			},
		)

		return
	}

	defer sharedRows.Close()

	sharedNotes :=
		make([]Note, 0)

	for sharedRows.Next() {

		var note Note

		err :=
			sharedRows.Scan(
				&note.ID,
				&note.OwnerID,
				&note.OwnerUsername,
				&note.Title,
				&note.Content,
				&note.Role,
				&note.CreatedAt,
				&note.UpdatedAt,
			)

		if err != nil {

			c.JSON(
				http.StatusInternalServerError,
				gin.H{
					"error": "gagal membaca shared note",
				},
			)

			return
		}

		sharedNotes =
			append(
				sharedNotes,
				note,
			)
	}

	if err := sharedRows.Err(); err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membaca shared note",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"my_notes":     myNotes,
			"shared_notes": sharedNotes,
		},
	)
}

/* ==========================================
   CREATE NOTE
========================================== */

func (h *NoteHandler) Create(
	c *gin.Context,
) {

	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	var req CreateNoteRequest

	if err :=
		c.ShouldBindJSON(
			&req,
		); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "format request tidak valid",
			},
		)

		return
	}

	req.Title =
		strings.TrimSpace(
			req.Title,
		)

	if req.Title == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "judul note wajib diisi",
			},
		)

		return
	}

	if len(
		[]rune(req.Title),
	) > 200 {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "judul note maksimal 200 karakter",
			},
		)

		return
	}

	var note Note

	err :=
		h.DB.QueryRow(
			c.Request.Context(),
			`
                WITH created_note AS (
                    INSERT INTO notes (
                        owner_id,
                        title,
                        content
                    )
                    VALUES (
                        $1,
                        $2,
                        $3
                    )

                    RETURNING
                        id,
                        owner_id,
                        title,
                        content,
                        created_at,
                        updated_at
                )

                SELECT
                    cn.id,
                    cn.owner_id,
                    u.username,
                    cn.title,
                    cn.content,
                    'owner'::TEXT,
                    cn.created_at,
                    cn.updated_at

                FROM created_note cn

                JOIN users u
                    ON u.id = cn.owner_id
            `,
			userID,
			req.Title,
			req.Content,
		).Scan(
			&note.ID,
			&note.OwnerID,
			&note.OwnerUsername,
			&note.Title,
			&note.Content,
			&note.Role,
			&note.CreatedAt,
			&note.UpdatedAt,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membuat note",
			},
		)

		return
	}

	c.JSON(
		http.StatusCreated,
		gin.H{
			"message": "note berhasil dibuat",
			"note":    note,
		},
	)
}

/* ==========================================
   GET ONE NOTE
========================================== */

func (h *NoteHandler) GetOne(
	c *gin.Context,
) {

	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	noteID, ok :=
		parseNoteID(c)

	if !ok {
		return
	}

	role, err :=
		h.getRole(
			c,
			noteID,
			userID,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "note tidak ditemukan atau kamu tidak memiliki akses",
			},
		)

		return
	}

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memeriksa akses note",
			},
		)

		return
	}

	var note Note

	err =
		h.DB.QueryRow(
			c.Request.Context(),
			`
                SELECT
                    n.id,
                    n.owner_id,
                    u.username,
                    n.title,
                    n.content,
                    n.created_at,
                    n.updated_at

                FROM notes n

                JOIN users u
                    ON u.id = n.owner_id

                WHERE n.id = $1
            `,
			noteID,
		).Scan(
			&note.ID,
			&note.OwnerID,
			&note.OwnerUsername,
			&note.Title,
			&note.Content,
			&note.CreatedAt,
			&note.UpdatedAt,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil note",
			},
		)

		return
	}

	note.Role =
		role

	c.JSON(
		http.StatusOK,
		gin.H{
			"note": note,
		},
	)
}

/* ==========================================
   UPDATE NOTE
========================================== */

func (h *NoteHandler) Update(
	c *gin.Context,
) {

	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	noteID, ok :=
		parseNoteID(c)

	if !ok {
		return
	}

	var req UpdateNoteRequest

	if err :=
		c.ShouldBindJSON(
			&req,
		); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "format request tidak valid",
			},
		)

		return
	}

	if req.Title == nil &&
		req.Content == nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "tidak ada perubahan yang dikirim",
			},
		)

		return
	}

	if req.Title != nil {

		title :=
			strings.TrimSpace(
				*req.Title,
			)

		if title == "" {

			c.JSON(
				http.StatusBadRequest,
				gin.H{
					"error": "judul note wajib diisi",
				},
			)

			return
		}

		if len(
			[]rune(title),
		) > 200 {

			c.JSON(
				http.StatusBadRequest,
				gin.H{
					"error": "judul note maksimal 200 karakter",
				},
			)

			return
		}

		req.Title =
			&title
	}

	role, err :=
		h.getRole(
			c,
			noteID,
			userID,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "note tidak ditemukan atau kamu tidak memiliki akses",
			},
		)

		return
	}

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memeriksa akses note",
			},
		)

		return
	}

	if role == "viewer" {

		c.JSON(
			http.StatusForbidden,
			gin.H{
				"error": "kamu hanya memiliki akses baca ke note ini",
			},
		)

		return
	}

	var titleValue any
	var contentValue any

	if req.Title != nil {
		titleValue =
			*req.Title
	}

	if req.Content != nil {
		contentValue =
			*req.Content
	}

	var note Note

	err =
		h.DB.QueryRow(
			c.Request.Context(),
			`
                WITH updated_note AS (
                    UPDATE notes

                    SET
                        title =
                            COALESCE(
                                $1,
                                title
                            ),

                        content =
                            COALESCE(
                                $2,
                                content
                            ),

                        updated_at =
                            NOW()

                    WHERE id = $3

                    RETURNING
                        id,
                        owner_id,
                        title,
                        content,
                        created_at,
                        updated_at
                )

                SELECT
                    un.id,
                    un.owner_id,
                    u.username,
                    un.title,
                    un.content,
                    un.created_at,
                    un.updated_at

                FROM updated_note un

                JOIN users u
                    ON u.id = un.owner_id
            `,
			titleValue,
			contentValue,
			noteID,
		).Scan(
			&note.ID,
			&note.OwnerID,
			&note.OwnerUsername,
			&note.Title,
			&note.Content,
			&note.CreatedAt,
			&note.UpdatedAt,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal menyimpan note",
			},
		)

		return
	}

	note.Role =
		role

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "note berhasil disimpan",
			"note":    note,
		},
	)
}

/* ==========================================
   DELETE NOTE
========================================== */

func (h *NoteHandler) Delete(
	c *gin.Context,
) {

	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	noteID, ok :=
		parseNoteID(c)

	if !ok {
		return
	}

	result, err :=
		h.DB.Exec(
			c.Request.Context(),
			`
                DELETE FROM notes

                WHERE id = $1
                AND owner_id = $2
            `,
			noteID,
			userID,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal menghapus note",
			},
		)

		return
	}

	if result.RowsAffected() == 0 {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "note tidak ditemukan atau kamu bukan pemiliknya",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "note berhasil dihapus",
		},
	)
}

/* ==========================================
   LIST NOTE MEMBERS
========================================== */

func (h *NoteHandler) ListMembers(
	c *gin.Context,
) {

	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	noteID, ok :=
		parseNoteID(c)

	if !ok {
		return
	}

	_, err :=
		h.getRole(
			c,
			noteID,
			userID,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {

		c.JSON(
			http.StatusForbidden,
			gin.H{
				"error": "kamu tidak memiliki akses ke note ini",
			},
		)

		return
	}

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memeriksa akses note",
			},
		)

		return
	}

	rows, err :=
		h.DB.Query(
			c.Request.Context(),
			`
                SELECT
                    id,
                    email,
                    username,
                    role

                FROM (
                    SELECT
                        u.id,
                        u.email,
                        u.username,
                        'owner'::TEXT AS role,
                        0 AS sort_order

                    FROM notes n

                    JOIN users u
                        ON u.id = n.owner_id

                    WHERE n.id = $1

                    UNION ALL

                    SELECT
                        u.id,
                        u.email,
                        u.username,
                        nm.role,
                        1 AS sort_order

                    FROM note_members nm

                    JOIN users u
                        ON u.id = nm.user_id

                    WHERE nm.note_id = $1
                ) members

                ORDER BY
                    sort_order,
                    username
            `,
			noteID,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil anggota note",
			},
		)

		return
	}

	defer rows.Close()

	members :=
		make([]NoteMember, 0)

	for rows.Next() {

		var member NoteMember

		if err :=
			rows.Scan(
				&member.ID,
				&member.Email,
				&member.Username,
				&member.Role,
			); err != nil {

			c.JSON(
				http.StatusInternalServerError,
				gin.H{
					"error": "gagal membaca anggota note",
				},
			)

			return
		}

		members =
			append(
				members,
				member,
			)
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"members": members,
		},
	)
}

/* ==========================================
   SHARE NOTE
========================================== */

func (h *NoteHandler) Share(
	c *gin.Context,
) {

	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	noteID, ok :=
		parseNoteID(c)

	if !ok {
		return
	}

	role, err :=
		h.getRole(
			c,
			noteID,
			userID,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "note tidak ditemukan",
			},
		)

		return
	}

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memeriksa akses note",
			},
		)

		return
	}

	if role != "owner" {

		c.JSON(
			http.StatusForbidden,
			gin.H{
				"error": "hanya pemilik note yang dapat membagikan note",
			},
		)

		return
	}

	var req ShareNoteRequest

	if err :=
		c.ShouldBindJSON(
			&req,
		); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "format request tidak valid",
			},
		)

		return
	}

	req.Email =
		strings.TrimSpace(
			req.Email,
		)

	address, err :=
		mail.ParseAddress(
			req.Email,
		)

	if err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "email tidak valid",
			},
		)

		return
	}

	req.Email =
		strings.ToLower(
			address.Address,
		)

	req.Role =
		strings.ToLower(
			strings.TrimSpace(
				req.Role,
			),
		)

	if req.Role == "" {
		req.Role =
			"editor"
	}

	if req.Role != "editor" &&
		req.Role != "viewer" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "role note tidak valid",
			},
		)

		return
	}

	var target NoteMember

	err =
		h.DB.QueryRow(
			c.Request.Context(),
			`
                SELECT
                    id,
                    email,
                    username

                FROM users

                WHERE LOWER(email) =
                    LOWER($1)
            `,
			req.Email,
		).Scan(
			&target.ID,
			&target.Email,
			&target.Username,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "user dengan email tersebut tidak ditemukan",
			},
		)

		return
	}

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mencari user",
			},
		)

		return
	}

	if target.ID == userID {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "kamu tidak bisa membagikan note kepada diri sendiri",
			},
		)

		return
	}

	_, err =
		h.DB.Exec(
			c.Request.Context(),
			`
                INSERT INTO note_members (
                    note_id,
                    user_id,
                    role
                )

                VALUES (
                    $1,
                    $2,
                    $3
                )

                ON CONFLICT (
                    note_id,
                    user_id
                )

                DO UPDATE SET
                    role = EXCLUDED.role
            `,
			noteID,
			target.ID,
			req.Role,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membagikan note",
			},
		)

		return
	}

	target.Role =
		req.Role

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "note berhasil dibagikan",
			"member":  target,
		},
	)
}

/* ==========================================
   REMOVE NOTE MEMBER
========================================== */

func (h *NoteHandler) RemoveMember(
	c *gin.Context,
) {

	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	noteID, ok :=
		parseNoteID(c)

	if !ok {
		return
	}

	role, err :=
		h.getRole(
			c,
			noteID,
			userID,
		)

	if err != nil {

		if errors.Is(
			err,
			pgx.ErrNoRows,
		) {

			c.JSON(
				http.StatusNotFound,
				gin.H{
					"error": "note tidak ditemukan",
				},
			)

			return
		}

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memeriksa akses note",
			},
		)

		return
	}

	if role != "owner" {

		c.JSON(
			http.StatusForbidden,
			gin.H{
				"error": "hanya pemilik note yang dapat menghapus anggota",
			},
		)

		return
	}

	memberID, err :=
		strconv.ParseInt(
			c.Param("userId"),
			10,
			64,
		)

	if err != nil ||
		memberID <= 0 {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "user id tidak valid",
			},
		)

		return
	}

	result, err :=
		h.DB.Exec(
			c.Request.Context(),
			`
                DELETE FROM note_members

                WHERE note_id = $1
                AND user_id = $2
            `,
			noteID,
			memberID,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal menghapus anggota note",
			},
		)

		return
	}

	if result.RowsAffected() == 0 {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "anggota note tidak ditemukan",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "anggota note berhasil dihapus",
		},
	)
}
