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

type NoteWebSocketHandler struct {
	DB  *pgxpool.Pool
	Hub *realtime.Hub

	Upgrader websocket.Upgrader
}

func NewNoteWebSocketHandler(
	db *pgxpool.Pool,
	hub *realtime.Hub,
) *NoteWebSocketHandler {

	return &NoteWebSocketHandler{
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
						"https://wishlistbyya.nekoyaa.workers.dev"
			},
		},
	}
}

func (h *NoteWebSocketHandler) Note(
	c *gin.Context,
) {

	/* ==========================================
	   TOKEN
	========================================== */

	token :=
		c.Query(
			"token",
		)

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
		auth.ParseToken(
			token,
		)

	if err != nil {

		c.JSON(
			http.StatusUnauthorized,
			gin.H{
				"error": "token tidak valid",
			},
		)

		return
	}

	/* ==========================================
	   NOTE ID
	========================================== */

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

		return
	}

	/* ==========================================
	   AUTHORIZATION
	========================================== */

	var allowed bool

	err =
		h.DB.QueryRow(
			c.Request.Context(),
			`
                SELECT EXISTS (
                    SELECT 1

                    FROM notes n

                    LEFT JOIN note_members nm
                        ON nm.note_id = n.id
                        AND nm.user_id = $2

                    WHERE n.id = $1

                    AND (
                        n.owner_id = $2
                        OR nm.user_id = $2
                    )
                )
            `,
			noteID,
			claims.UserID,
		).Scan(
			&allowed,
		)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memeriksa akses note realtime",
			},
		)

		return
	}

	if !allowed {

		c.JSON(
			http.StatusForbidden,
			gin.H{
				"error": "kamu tidak memiliki akses ke note ini",
			},
		)

		return
	}

	/* ==========================================
	   UPGRADE WEBSOCKET
	========================================== */

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
			noteID,
			conn,
		)

	defer h.Hub.Unregister(
		noteID,
		client,
	)

	/*
	   Client tidak perlu mengirim data.
	   Read loop hanya menjaga koneksi
	   dan mendeteksi disconnect.
	*/

	for {

		_, _, err :=
			conn.ReadMessage()

		if err != nil {
			return
		}
	}
}
