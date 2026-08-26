package handler

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"wishlistbyya/internal/realtime"
)

const (
	maxAvatarSize        = 5 << 20
	maxAvatarRequestBody = 6 << 20
)

type AvatarHandler struct {
	DB  *pgxpool.Pool
	Hub *realtime.Hub
}

func NewAvatarHandler(
	db *pgxpool.Pool,
	hub *realtime.Hub,
) *AvatarHandler {
	return &AvatarHandler{
		DB:  db,
		Hub: hub,
	}
}

func (h *AvatarHandler) broadcastProfileChanged(
	c *gin.Context,
	userID int64,
) {
	if h.Hub == nil {
		return
	}

	rows, err := h.DB.Query(
		c.Request.Context(),
		`
            SELECT f.id
            FROM folders f
            WHERE
                f.type = 'shared'
                AND (
                    f.owner_id = $1
                    OR EXISTS (
                        SELECT 1
                        FROM folder_members fm
                        WHERE
                            fm.folder_id = f.id
                            AND fm.user_id = $1
                    )
                )
        `,
		userID,
	)

	if err != nil {
		log.Printf(
			"gagal mencari shared folder untuk realtime profile: %v",
			err,
		)

		return
	}

	defer rows.Close()

	for rows.Next() {
		var folderID int64

		if err := rows.Scan(
			&folderID,
		); err != nil {
			continue
		}

		h.Hub.Broadcast(
			folderID,
			gin.H{
				"type":    "profile_changed",
				"user_id": userID,
			},
		)
	}
}

func createCloudinaryClient() (
	*cloudinary.Cloudinary,
	error,
) {
	cloudName :=
		strings.TrimSpace(
			os.Getenv(
				"CLOUDINARY_CLOUD_NAME",
			),
		)

	apiKey :=
		strings.TrimSpace(
			os.Getenv(
				"CLOUDINARY_API_KEY",
			),
		)

	apiSecret :=
		strings.TrimSpace(
			os.Getenv(
				"CLOUDINARY_API_SECRET",
			),
		)

	if cloudName == "" ||
		apiKey == "" ||
		apiSecret == "" {
		return nil, errors.New(
			"konfigurasi Cloudinary belum lengkap",
		)
	}

	return cloudinary.NewFromParams(
		cloudName,
		apiKey,
		apiSecret,
	)
}

func avatarPublicID(
	userID int64,
) string {
	return fmt.Sprintf(
		"wishlistbyya_avatar_user_%d",
		userID,
	)
}

func isAllowedAvatarType(
	contentType string,
) bool {
	switch contentType {

	case "image/jpeg",
		"image/png",
		"image/webp":

		return true

	default:
		return false
	}
}

func (h *AvatarHandler) Upload(
	c *gin.Context,
) {
	userID, ok :=
		getAuthenticatedUserID(c)

	if !ok {
		return
	}

	c.Request.Body =
		http.MaxBytesReader(
			c.Writer,
			c.Request.Body,
			maxAvatarRequestBody,
		)

	header, err :=
		c.FormFile("avatar")

	if err != nil {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "foto profile harus dipilih",
			},
		)

		return
	}

	if header.Size <= 0 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "file foto kosong",
			},
		)

		return
	}

	if header.Size > maxAvatarSize {
		c.JSON(
			http.StatusRequestEntityTooLarge,
			gin.H{
				"error": "ukuran foto maksimal 5 MB",
			},
		)

		return
	}

	file, err :=
		header.Open()

	if err != nil {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "gagal membaca foto",
			},
		)

		return
	}

	defer file.Close()

	buffer :=
		make(
			[]byte,
			512,
		)

	readLength, err :=
		file.Read(buffer)

	if err != nil &&
		!errors.Is(
			err,
			io.EOF,
		) {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "gagal memvalidasi foto",
			},
		)

		return
	}

	contentType :=
		http.DetectContentType(
			buffer[:readLength],
		)

	if !isAllowedAvatarType(
		contentType,
	) {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "format foto harus JPG, PNG, atau WEBP",
			},
		)

		return
	}

	_, err =
		file.Seek(
			0,
			io.SeekStart,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal memproses foto",
			},
		)

		return
	}

	cld, err :=
		createCloudinaryClient()

	if err != nil {
		log.Printf(
			"Cloudinary configuration error: %v",
			err,
		)

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "layanan upload foto belum dikonfigurasi",
			},
		)

		return
	}

	publicID :=
		avatarPublicID(
			userID,
		)

	uploadResult, err :=
		cld.Upload.Upload(
			c.Request.Context(),
			file,
			uploader.UploadParams{
				PublicID:     publicID,
				ResourceType: "image",
				Overwrite:    api.Bool(true),
				Invalidate:   api.Bool(true),
			},
		)

	if err != nil {
		log.Printf(
			"Cloudinary upload error: %v",
			err,
		)

		c.JSON(
			http.StatusBadGateway,
			gin.H{
				"error": "gagal mengupload foto profile",
			},
		)

		return
	}

	if uploadResult.SecureURL == "" {
		c.JSON(
			http.StatusBadGateway,
			gin.H{
				"error": "Cloudinary tidak mengembalikan URL foto",
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
                avatar_url = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING
                id,
                email,
                username,
                avatar_url,
                created_at
        `,
		uploadResult.SecureURL,
		userID,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.AvatarURL,
		&user.CreatedAt,
	)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "foto berhasil diupload tetapi gagal disimpan ke profile",
			},
		)

		return
	}

	h.broadcastProfileChanged(
		c,
		userID,
	)

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "foto profile berhasil diperbarui",
			"user":    user,
		},
	)
}

func (h *AvatarHandler) Delete(
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
            UPDATE users
            SET
                avatar_url = '',
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id,
                email,
                username,
                avatar_url,
                created_at
        `,
		userID,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.AvatarURL,
		&user.CreatedAt,
	)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal menghapus foto dari profile",
			},
		)

		return
	}

	cld, cloudinaryErr :=
		createCloudinaryClient()

	if cloudinaryErr == nil {

		_, destroyErr :=
			cld.Upload.Destroy(
				c.Request.Context(),
				uploader.DestroyParams{
					PublicID: avatarPublicID(
						userID,
					),
					ResourceType: "image",
					Invalidate:   api.Bool(true),
				},
			)

		if destroyErr != nil {
			log.Printf(
				"Cloudinary delete avatar error: %v",
				destroyErr,
			)
		}

	} else {
		log.Printf(
			"Cloudinary configuration error saat delete avatar: %v",
			cloudinaryErr,
		)
	}

	h.broadcastProfileChanged(
		c,
		userID,
	)

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "foto profile berhasil dihapus",
			"user":    user,
		},
	)
}
