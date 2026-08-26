package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FolderHandler struct {
	DB *pgxpool.Pool
}

type Folder struct {
	ID          int64     `json:"id"`
	OwnerID     int64     `json:"owner_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Type        string    `json:"type"`
	AccessRole  string    `json:"access_role"`
	IsOwner     bool      `json:"is_owner"`
	MemberCount int64     `json:"member_count"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateFolderRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Type        string `json:"type"`
}

type UpdateFolderRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

func NewFolderHandler(
	db *pgxpool.Pool,
) *FolderHandler {
	return &FolderHandler{
		DB: db,
	}
}

func getUserID(
	c *gin.Context,
) (int64, bool) {
	value, exists :=
		c.Get("userID")

	if !exists {
		c.JSON(
			http.StatusUnauthorized,
			gin.H{
				"error": "user tidak terautentikasi",
			},
		)

		return 0, false
	}

	userID, ok :=
		value.(int64)

	if !ok {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "user id tidak valid",
			},
		)

		return 0, false
	}

	return userID, true
}

/* ==========================================
   CREATE
========================================== */

func (h *FolderHandler) Create(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	var req CreateFolderRequest

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

	req.Name =
		strings.TrimSpace(
			req.Name,
		)

	req.Description =
		strings.TrimSpace(
			req.Description,
		)

	req.Type =
		strings.ToLower(
			strings.TrimSpace(
				req.Type,
			),
		)

	if req.Name == "" {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "nama folder wajib diisi",
			},
		)

		return
	}

	if len(req.Name) > 100 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "nama folder maksimal 100 karakter",
			},
		)

		return
	}

	if req.Type == "" {
		req.Type =
			"private"
	}

	if req.Type != "private" &&
		req.Type != "shared" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "tipe folder tidak valid",
			},
		)

		return
	}

	var folder Folder

	err :=
		h.DB.QueryRow(
			c.Request.Context(),
			`
                INSERT INTO folders (
                    owner_id,
                    name,
                    description,
                    type
                )
                VALUES ($1, $2, $3, $4)

                RETURNING
                    id,
                    owner_id,
                    name,
                    description,
                    type,
                    created_at,
                    updated_at
            `,
			userID,
			req.Name,
			req.Description,
			req.Type,
		).Scan(
			&folder.ID,
			&folder.OwnerID,
			&folder.Name,
			&folder.Description,
			&folder.Type,
			&folder.CreatedAt,
			&folder.UpdatedAt,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membuat folder",
			},
		)

		return
	}

	folder.AccessRole =
		"owner"

	folder.IsOwner =
		true

	folder.MemberCount =
		1

	c.JSON(
		http.StatusCreated,
		gin.H{
			"message": "folder berhasil dibuat",
			"folder":  folder,
		},
	)
}

/* ==========================================
   LIST
========================================== */

func (h *FolderHandler) List(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	rows, err :=
		h.DB.Query(
			c.Request.Context(),
			`
                SELECT
                    f.id,
                    f.owner_id,
                    f.name,
                    f.description,
                    f.type,

                    CASE
                        WHEN f.owner_id = $1
                            THEN 'owner'
                        ELSE 'member'
                    END AS access_role,

                    (f.owner_id = $1)
                        AS is_owner,

                    1 + (
                        SELECT COUNT(*)
                        FROM folder_members fm_count
                        WHERE fm_count.folder_id = f.id
                    ) AS member_count,

                    f.created_at,
                    f.updated_at

                FROM folders f

                LEFT JOIN folder_members fm
                    ON fm.folder_id = f.id
                    AND fm.user_id = $1

                WHERE
                    f.owner_id = $1
                    OR fm.user_id = $1

                ORDER BY
                    f.created_at DESC
            `,
			userID,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil folder",
			},
		)

		return
	}

	defer rows.Close()

	folders :=
		make([]Folder, 0)

	for rows.Next() {
		var folder Folder

		if err :=
			rows.Scan(
				&folder.ID,
				&folder.OwnerID,
				&folder.Name,
				&folder.Description,
				&folder.Type,
				&folder.AccessRole,
				&folder.IsOwner,
				&folder.MemberCount,
				&folder.CreatedAt,
				&folder.UpdatedAt,
			); err != nil {

			c.JSON(
				http.StatusInternalServerError,
				gin.H{
					"error": "gagal membaca data folder",
				},
			)

			return
		}

		folders =
			append(
				folders,
				folder,
			)
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"folders": folders,
		},
	)
}

/* ==========================================
   UPDATE
========================================== */

func (h *FolderHandler) Update(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	var req UpdateFolderRequest

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

	if req.Name == nil &&
		req.Description == nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "tidak ada data yang diubah",
			},
		)

		return
	}

	if req.Name != nil {
		name :=
			strings.TrimSpace(
				*req.Name,
			)

		if name == "" {
			c.JSON(
				http.StatusBadRequest,
				gin.H{
					"error": "nama folder wajib diisi",
				},
			)

			return
		}

		if len(name) > 100 {
			c.JSON(
				http.StatusBadRequest,
				gin.H{
					"error": "nama folder maksimal 100 karakter",
				},
			)

			return
		}

		req.Name =
			&name
	}

	if req.Description != nil {
		description :=
			strings.TrimSpace(
				*req.Description,
			)

		req.Description =
			&description
	}

	var folder Folder

	err :=
		h.DB.QueryRow(
			c.Request.Context(),
			`
                UPDATE folders
                SET
                    name =
                        COALESCE($1, name),

                    description =
                        COALESCE($2, description),

                    updated_at =
                        NOW()

                WHERE id = $3
                AND owner_id = $4

                RETURNING
                    id,
                    owner_id,
                    name,
                    description,
                    type,
                    created_at,
                    updated_at
            `,
			req.Name,
			req.Description,
			folderID,
			userID,
		).Scan(
			&folder.ID,
			&folder.OwnerID,
			&folder.Name,
			&folder.Description,
			&folder.Type,
			&folder.CreatedAt,
			&folder.UpdatedAt,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "folder tidak ditemukan atau kamu bukan pemiliknya",
			},
		)

		return
	}

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengubah folder",
			},
		)

		return
	}

	folder.AccessRole =
		"owner"

	folder.IsOwner =
		true

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "folder berhasil diubah",
			"folder":  folder,
		},
	)
}

/* ==========================================
   DELETE
========================================== */

func (h *FolderHandler) Delete(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	result, err :=
		h.DB.Exec(
			c.Request.Context(),
			`
                DELETE FROM folders
                WHERE id = $1
                AND owner_id = $2
            `,
			folderID,
			userID,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal menghapus folder",
			},
		)

		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "folder tidak ditemukan atau kamu bukan pemiliknya",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "folder berhasil dihapus",
		},
	)
}
