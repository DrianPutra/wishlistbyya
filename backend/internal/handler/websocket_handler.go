package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"

	"wishlistbyya/internal/auth"
	"wishlistbyya/internal/realtime"
)

type WebSocketHandler struct {
	DB  *pgxpool.Pool
	Hub *realtime.Hub

	Upgrader websocket.Upgrader
}

func NewWebSocketHandler(
	db *pgxpool.Pool,
	hub *realtime.Hub,
) *WebSocketHandler {
	return &WebSocketHandler{
		DB:  db,
		Hub: hub,

		Upgrader: websocket.Upgrader{
			CheckOrigin: func(
				r *http.Request,
			) bool {
				origin :=
					r.Header.Get(
						"Origin",
					)

				return origin == "" ||
					origin ==
						"http://localhost:5500" ||
					origin ==
						"http://127.0.0.1:5500" ||
					origin ==
						"https://wishlistbyya.adriandsputra.workers.dev"
			},
		},
	}
}

func (h *WebSocketHandler) Folder(
	c *gin.Context,
) {
	/* ================================
	   TOKEN
	================================ */

	token :=
		c.Query("token")

	if token == "" {
		c.JSON(
			http.StatusUnauthorized,
			gin.H{
				"error": "token diperlukan",
			},
		)

		return
	}

	claims, err :=
		auth.ParseToken(token)

	if err != nil {
		c.JSON(
			http.StatusUnauthorized,
			gin.H{
				"error": "token tidak valid",
			},
		)

		return
	}

	/* ================================
	   FOLDER ID
	================================ */

	folderID, err :=
		strconv.ParseInt(
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

	/* ================================
	   AUTHORIZATION
	================================ */

	var allowed bool

	err =
		h.DB.QueryRow(
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
			claims.UserID,
		).Scan(
			&allowed,
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

	/* ================================
	   UPGRADE HTTP -> WEBSOCKET
	================================ */

	conn, err :=
		h.Upgrader.Upgrade(
			c.Writer,
			c.Request,
			nil,
		)

	if err != nil {
		return
	}

	client :=
		h.Hub.Register(
			folderID,
			conn,
		)

	defer h.Hub.Unregister(
		folderID,
		client,
	)

	/* ================================
	   CONNECTED EVENT
	================================ */

	client.Mu.Lock()

	_ =
		conn.WriteJSON(
			gin.H{
				"type":      "connected",
				"folder_id": folderID,
			},
		)

	client.Mu.Unlock()

	/* ================================
	   KEEP CONNECTION OPEN
	================================ */

	for {
		_, _, err :=
			conn.ReadMessage()

		if err != nil {
			break
		}
	}
}
