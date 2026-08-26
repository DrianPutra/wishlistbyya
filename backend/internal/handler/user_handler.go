package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserHandler struct {
	DB *pgxpool.Pool
}

func NewUserHandler(
	db *pgxpool.Pool,
) *UserHandler {
	return &UserHandler{
		DB: db,
	}
}

func (h *UserHandler) Me(
	c *gin.Context,
) {
	value, exists :=
		c.Get("userID")

	if !exists {
		c.JSON(
			http.StatusUnauthorized,
			gin.H{
				"error": "user tidak terautentikasi",
			},
		)

		return
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

		return
	}

	var user UserResponse

	err := h.DB.QueryRow(
		c.Request.Context(),
		`
            SELECT
                id,
                email,
                username,
                created_at
            FROM users
            WHERE id = $1
        `,
		userID,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "user tidak ditemukan",
			},
		)

		return
	}

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil user",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"user": user,
		},
	)
}
