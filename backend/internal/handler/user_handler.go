package handler

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	DB *pgxpool.Pool
}

type ProfileUserResponse struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	AvatarURL string    `json:"avatar_url"`
	CreatedAt time.Time `json:"created_at"`
}

type UpdateProfileInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
}

type ChangePasswordInput struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func NewUserHandler(
	db *pgxpool.Pool,
) *UserHandler {
	return &UserHandler{
		DB: db,
	}
}

func getAuthenticatedUserID(
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

func (h *UserHandler) Me(
	c *gin.Context,
) {
	userID, ok :=
		getAuthenticatedUserID(c)

	if !ok {
		return
	}

	var user ProfileUserResponse

	err := h.DB.QueryRow(
		c.Request.Context(),
		`
            SELECT
                id,
                email,
                username,
                avatar_url,
                created_at
            FROM users
            WHERE id = $1
        `,
		userID,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.AvatarURL,
		&user.CreatedAt,
	)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {
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

func (h *UserHandler) UpdateMe(
	c *gin.Context,
) {
	userID, ok :=
		getAuthenticatedUserID(c)

	if !ok {
		return
	}

	var input UpdateProfileInput

	if err :=
		c.ShouldBindJSON(&input); err != nil {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "data profile tidak valid",
			},
		)

		return
	}

	username :=
		strings.TrimSpace(
			input.Username,
		)

	email :=
		strings.ToLower(
			strings.TrimSpace(
				input.Email,
			),
		)

	if len(username) < 2 ||
		len(username) > 50 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "username harus terdiri dari 2 sampai 50 karakter",
			},
		)

		return
	}

	if len(email) == 0 ||
		len(email) > 255 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "email tidak valid",
			},
		)

		return
	}

	parsedEmail, err :=
		mail.ParseAddress(email)

	if err != nil ||
		parsedEmail.Address != email {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "format email tidak valid",
			},
		)

		return
	}

	var user ProfileUserResponse

	err = h.DB.QueryRow(
		c.Request.Context(),
		`
            UPDATE users
            SET
                username = $1,
                email = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING
                id,
                email,
                username,
                avatar_url,
                created_at
        `,
		username,
		email,
		userID,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.AvatarURL,
		&user.CreatedAt,
	)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(
			err,
			&pgErr,
		) &&
			pgErr.Code == "23505" {

			switch pgErr.ConstraintName {

			case "users_email_key":
				c.JSON(
					http.StatusConflict,
					gin.H{
						"error": "email sudah digunakan oleh akun lain",
					},
				)

				return

			case "users_username_key":
				c.JSON(
					http.StatusConflict,
					gin.H{
						"error": "username sudah digunakan oleh akun lain",
					},
				)

				return
			}
		}

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memperbarui profile",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "profile berhasil diperbarui",
			"user":    user,
		},
	)
}

func (h *UserHandler) ChangePassword(
	c *gin.Context,
) {
	userID, ok :=
		getAuthenticatedUserID(c)

	if !ok {
		return
	}

	var input ChangePasswordInput

	if err :=
		c.ShouldBindJSON(&input); err != nil {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "data password tidak valid",
			},
		)

		return
	}

	currentPassword :=
		strings.TrimSpace(
			input.CurrentPassword,
		)

	newPassword :=
		strings.TrimSpace(
			input.NewPassword,
		)

	if currentPassword == "" {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "password saat ini harus diisi",
			},
		)

		return
	}

	if len(newPassword) < 8 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "password baru minimal 8 karakter",
			},
		)

		return
	}

	if currentPassword ==
		newPassword {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "password baru harus berbeda dari password lama",
			},
		)

		return
	}

	var passwordHash string

	err := h.DB.QueryRow(
		c.Request.Context(),
		`
            SELECT password_hash
            FROM users
            WHERE id = $1
        `,
		userID,
	).Scan(
		&passwordHash,
	)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {
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
				"error": "gagal mengambil data user",
			},
		)

		return
	}

	err =
		bcrypt.CompareHashAndPassword(
			[]byte(passwordHash),
			[]byte(currentPassword),
		)

	if err != nil {
		c.JSON(
			http.StatusUnauthorized,
			gin.H{
				"error": "password saat ini salah",
			},
		)

		return
	}

	newHash, err :=
		bcrypt.GenerateFromPassword(
			[]byte(newPassword),
			bcrypt.DefaultCost,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memproses password baru",
			},
		)

		return
	}

	_, err = h.DB.Exec(
		c.Request.Context(),
		`
            UPDATE users
            SET
                password_hash = $1,
                updated_at = NOW()
            WHERE id = $2
        `,
		string(newHash),
		userID,
	)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memperbarui password",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "password berhasil diperbarui",
		},
	)
}
