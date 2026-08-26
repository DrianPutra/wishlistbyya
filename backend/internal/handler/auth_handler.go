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

	appauth "wishlistbyya/internal/auth"
)

type AuthHandler struct {
	DB *pgxpool.Pool
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UserResponse struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
}

func NewAuthHandler(
	db *pgxpool.Pool,
) *AuthHandler {
	return &AuthHandler{
		DB: db,
	}
}

/* ==========================================
   REGISTER
========================================== */

func (h *AuthHandler) Register(
	c *gin.Context,
) {
	var req RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
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
			strings.TrimSpace(req.Email),
		)

	req.Username =
		strings.ToLower(
			strings.TrimSpace(req.Username),
		)

	if req.Email == "" {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "email wajib diisi",
			},
		)

		return
	}

	address, err :=
		mail.ParseAddress(req.Email)

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

	if len(req.Username) < 4 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "username minimal 4 karakter",
			},
		)

		return
	}

	if len(req.Username) > 50 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "username maksimal 50 karakter",
			},
		)

		return
	}

	if len(req.Password) < 6 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "password minimal 6 karakter",
			},
		)

		return
	}

	if len([]byte(req.Password)) > 72 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "password terlalu panjang",
			},
		)

		return
	}

	passwordHash, err :=
		bcrypt.GenerateFromPassword(
			[]byte(req.Password),
			bcrypt.DefaultCost,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memproses password",
			},
		)

		return
	}

	var user UserResponse

	err = h.DB.QueryRow(
		c.Request.Context(),
		`
            INSERT INTO users (
                email,
                username,
                password_hash
            )
            VALUES ($1, $2, $3)
            RETURNING
                id,
                email,
                username,
                created_at
        `,
		req.Email,
		req.Username,
		string(passwordHash),
	).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.CreatedAt,
	)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) &&
			pgErr.Code == "23505" {

			switch pgErr.ConstraintName {

			case "users_email_key":

				c.JSON(
					http.StatusConflict,
					gin.H{
						"error": "email sudah digunakan",
					},
				)

			case "users_username_key":

				c.JSON(
					http.StatusConflict,
					gin.H{
						"error": "username sudah digunakan",
					},
				)

			default:

				c.JSON(
					http.StatusConflict,
					gin.H{
						"error": "data user sudah digunakan",
					},
				)
			}

			return
		}

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membuat user",
			},
		)

		return
	}

	c.JSON(
		http.StatusCreated,
		gin.H{
			"message": "akun berhasil dibuat",
			"user":    user,
		},
	)
}

/* ==========================================
   LOGIN
========================================== */

func (h *AuthHandler) Login(
	c *gin.Context,
) {
	var req LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
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
			strings.TrimSpace(req.Email),
		)

	if req.Email == "" ||
		req.Password == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "email dan password wajib diisi",
			},
		)

		return
	}

	var (
		user         UserResponse
		passwordHash string
	)

	err := h.DB.QueryRow(
		c.Request.Context(),
		`
            SELECT
                id,
                email,
                username,
                password_hash,
                created_at
            FROM users
            WHERE email = $1
        `,
		req.Email,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&passwordHash,
		&user.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(
			http.StatusUnauthorized,
			gin.H{
				"error": "email atau password salah",
			},
		)

		return
	}

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal melakukan login",
			},
		)

		return
	}

	err =
		bcrypt.CompareHashAndPassword(
			[]byte(passwordHash),
			[]byte(req.Password),
		)

	if err != nil {
		c.JSON(
			http.StatusUnauthorized,
			gin.H{
				"error": "email atau password salah",
			},
		)

		return
	}

	token, err :=
		appauth.GenerateToken(
			user.ID,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membuat token",
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "login berhasil",
			"token":   token,
			"user":    user,
		},
	)
}
