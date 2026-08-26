package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func (h *FolderHandler) GetOne(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	var folder Folder

	err :=
		h.DB.QueryRow(
			c.Request.Context(),
			`
                SELECT
                    f.id,
                    f.owner_id,
                    f.name,
                    f.description,
                    f.type,

                    CASE
                        WHEN f.owner_id = $2
                            THEN 'owner'
                        ELSE 'member'
                    END,

                    (f.owner_id = $2),

                    1 + (
                        SELECT COUNT(*)
                        FROM folder_members fm_count
                        WHERE fm_count.folder_id = f.id
                    ),

                    f.created_at,
                    f.updated_at

                FROM folders f

                LEFT JOIN folder_members fm
                    ON fm.folder_id = f.id
                    AND fm.user_id = $2

                WHERE
                    f.id = $1

                    AND (
                        f.owner_id = $2
                        OR fm.user_id = $2
                    )

                LIMIT 1
            `,
			folderID,
			userID,
		).Scan(
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
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "folder tidak ditemukan atau kamu tidak memiliki akses",
			},
		)

		return
	}

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil folder",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"folder": folder,
		},
	)
}
