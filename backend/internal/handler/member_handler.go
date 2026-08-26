package handler

import (
	"errors"
	"net/http"
	"net/mail"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MemberHandler struct {
	DB *pgxpool.Pool
}

type FolderMember struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type AddMemberRequest struct {
	Email string `json:"email"`
}

func NewMemberHandler(
	db *pgxpool.Pool,
) *MemberHandler {
	return &MemberHandler{
		DB: db,
	}
}

/* ==========================================
   CHECK FOLDER ACCESS
========================================== */

func (h *MemberHandler) hasFolderAccess(
	c *gin.Context,
	folderID string,
	userID int64,
) (bool, error) {
	var allowed bool

	err := h.DB.QueryRow(
		c.Request.Context(),
		`
            SELECT EXISTS (
                SELECT 1
                FROM folders f
                WHERE f.id = $1
                AND (
                    f.owner_id = $2
                    OR EXISTS (
                        SELECT 1
                        FROM folder_members fm
                        WHERE fm.folder_id = f.id
                        AND fm.user_id = $2
                    )
                )
            )
        `,
		folderID,
		userID,
	).Scan(
		&allowed,
	)

	return allowed, err
}

/* ==========================================
   LIST MEMBERS
========================================== */

func (h *MemberHandler) List(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	allowed, err :=
		h.hasFolderAccess(
			c,
			folderID,
			userID,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memeriksa akses folder",
			},
		)

		return
	}

	if !allowed {
		c.JSON(
			http.StatusForbidden,
			gin.H{
				"error": "kamu tidak memiliki akses ke folder ini",
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
                    FROM folders f
                    JOIN users u
                        ON u.id = f.owner_id
                    WHERE f.id = $1

                    UNION ALL

                    SELECT
                        u.id,
                        u.email,
                        u.username,
                        fm.role,
                        1 AS sort_order
                    FROM folder_members fm
                    JOIN users u
                        ON u.id = fm.user_id
                    WHERE fm.folder_id = $1
                ) AS members

                ORDER BY
                    sort_order,
                    username
            `,
			folderID,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil anggota",
			},
		)

		return
	}

	defer rows.Close()

	members :=
		make([]FolderMember, 0)

	for rows.Next() {
		var member FolderMember

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
					"error": "gagal membaca anggota",
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
   ADD MEMBER
========================================== */

func (h *MemberHandler) Add(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	var req AddMemberRequest

	if err :=
		c.ShouldBindJSON(&req); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "format request tidak valid",
			},
		)

		return
	}

	req.Email =
		strings.ToLower(
			strings.TrimSpace(
				req.Email,
			),
		)

	address, err :=
		mail.ParseAddress(
			req.Email,
		)

	if err != nil ||
		address.Address != req.Email {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "format email tidak valid",
			},
		)

		return
	}

	var (
		ownerID    int64
		folderType string
	)

	err =
		h.DB.QueryRow(
			c.Request.Context(),
			`
                SELECT
                    owner_id,
                    type
                FROM folders
                WHERE id = $1
            `,
			folderID,
		).Scan(
			&ownerID,
			&folderType,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "folder tidak ditemukan",
			},
		)

		return
	}

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membaca folder",
			},
		)

		return
	}

	if ownerID != userID {
		c.JSON(
			http.StatusForbidden,
			gin.H{
				"error": "hanya pemilik folder yang dapat menambahkan anggota",
			},
		)

		return
	}

	if folderType != "shared" {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "anggota hanya dapat ditambahkan ke shared folder",
			},
		)

		return
	}

	var member FolderMember

	err =
		h.DB.QueryRow(
			c.Request.Context(),
			`
                SELECT
                    id,
                    email,
                    username
                FROM users
                WHERE email = $1
            `,
			req.Email,
		).Scan(
			&member.ID,
			&member.Email,
			&member.Username,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "akun dengan email tersebut tidak ditemukan",
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

	if member.ID == ownerID {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "pemilik folder sudah memiliki akses",
			},
		)

		return
	}

	_, err =
		h.DB.Exec(
			c.Request.Context(),
			`
                INSERT INTO folder_members (
                    folder_id,
                    user_id,
                    role
                )
                VALUES ($1, $2, 'member')
            `,
			folderID,
			member.ID,
		)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(
			err,
			&pgErr,
		) &&
			pgErr.Code == "23505" {

			c.JSON(
				http.StatusConflict,
				gin.H{
					"error": "user sudah menjadi anggota folder",
				},
			)

			return
		}

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal menambahkan anggota",
			},
		)

		return
	}

	member.Role =
		"member"

	c.JSON(
		http.StatusCreated,
		gin.H{
			"message": "anggota berhasil ditambahkan",
			"member":  member,
		},
	)
}

/* ==========================================
   DELETE MEMBER
========================================== */

func (h *MemberHandler) Delete(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	memberIDString :=
		c.Param("userId")

	memberID, err :=
		strconv.ParseInt(
			memberIDString,
			10,
			64,
		)

	if err != nil {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "user id tidak valid",
			},
		)

		return
	}

	var ownerID int64

	err =
		h.DB.QueryRow(
			c.Request.Context(),
			`
                SELECT owner_id
                FROM folders
                WHERE id = $1
            `,
			folderID,
		).Scan(
			&ownerID,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "folder tidak ditemukan",
			},
		)

		return
	}

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membaca folder",
			},
		)

		return
	}

	if ownerID != userID {
		c.JSON(
			http.StatusForbidden,
			gin.H{
				"error": "hanya pemilik folder yang dapat menghapus anggota",
			},
		)

		return
	}

	result, err :=
		h.DB.Exec(
			c.Request.Context(),
			`
                DELETE FROM folder_members
                WHERE folder_id = $1
                AND user_id = $2
            `,
			folderID,
			memberID,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal menghapus anggota",
			},
		)

		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "anggota tidak ditemukan",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "anggota berhasil dihapus",
		},
	)
}
