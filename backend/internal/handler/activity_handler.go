package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ActivityHandler struct {
	DB *pgxpool.Pool
}

type Activity struct {
	ID             int64     `json:"id"`
	FolderID       int64     `json:"folder_id"`
	ActorID        *int64    `json:"actor_id"`
	ActorUsername  string    `json:"actor_username"`
	ActorEmail     string    `json:"actor_email"`
	ActorAvatarURL string    `json:"actor_avatar_url"`
	Action         string    `json:"action"`
	ItemID         *int64    `json:"item_id"`
	ItemName       string    `json:"item_name"`
	CreatedAt      time.Time `json:"created_at"`
}

func NewActivityHandler(db *pgxpool.Pool) *ActivityHandler {
	return &ActivityHandler{
		DB: db,
	}
}

func (h *ActivityHandler) List(c *gin.Context) {
	userID, ok := getUserID(c)

	if !ok {
		return
	}

	folderID, err := strconv.ParseInt(
		c.Param("id"),
		10,
		64,
	)

	if err != nil {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "folder id tidak valid",
			},
		)

		return
	}

	var allowed bool

	err = h.DB.QueryRow(
		c.Request.Context(),
		`
            SELECT EXISTS (
                SELECT 1
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
            )
        `,
		folderID,
		userID,
	).Scan(&allowed)

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

	rows, err := h.DB.Query(
		c.Request.Context(),
		`
            SELECT
                a.id,
                a.folder_id,
                a.actor_id,
                COALESCE(u.username, 'Unknown'),
                COALESCE(u.email, ''),
                COALESCE(u.avatar_url, ''),
                a.action,
                a.item_id,
                a.item_name,
                a.created_at

            FROM activity_logs a

            LEFT JOIN users u
                ON u.id = a.actor_id

            WHERE
                a.folder_id = $1

            ORDER BY
                a.created_at DESC

            LIMIT 50
        `,
		folderID,
	)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil activity log",
			},
		)

		return
	}

	defer rows.Close()

	activities := make([]Activity, 0)

	for rows.Next() {
		var activity Activity

		var actorID pgtype.Int8
		var itemID pgtype.Int8

		err := rows.Scan(
			&activity.ID,
			&activity.FolderID,
			&actorID,
			&activity.ActorUsername,
			&activity.ActorEmail,
			&activity.ActorAvatarURL,
			&activity.Action,
			&itemID,
			&activity.ItemName,
			&activity.CreatedAt,
		)

		if err != nil {
			c.JSON(
				http.StatusInternalServerError,
				gin.H{
					"error": "gagal membaca activity log",
				},
			)

			return
		}

		if actorID.Valid {
			value := actorID.Int64
			activity.ActorID = &value
		}

		if itemID.Valid {
			value := itemID.Int64
			activity.ItemID = &value
		}

		activities = append(
			activities,
			activity,
		)
	}

	if rows.Err() != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membaca activity log",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"activities": activities,
		},
	)
}
