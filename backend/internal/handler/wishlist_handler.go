package handler

import (
	"errors"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"wishlistbyya/internal/realtime"
)

type WishlistHandler struct {
	DB  *pgxpool.Pool
	Hub *realtime.Hub
}

type WishlistItem struct {
	ID          int64     `json:"id"`
	FolderID    int64     `json:"folder_id"`
	CreatedBy   int64     `json:"created_by"`
	AddedBy     string    `json:"added_by"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       int64     `json:"price"`
	Tag         string    `json:"tag"`
	ImageURL    string    `json:"image_url"`
	ProductURL  string    `json:"product_url"`
	Completed   bool      `json:"completed"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateWishlistRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Price       int64  `json:"price"`
	Tag         string `json:"tag"`
	ImageURL    string `json:"image_url"`
	ProductURL  string `json:"product_url"`
}

type UpdateWishlistRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Price       *int64  `json:"price"`
	Tag         *string `json:"tag"`
	ImageURL    *string `json:"image_url"`
	ProductURL  *string `json:"product_url"`
	Completed   *bool   `json:"completed"`
}

func NewWishlistHandler(
	db *pgxpool.Pool,
	hub *realtime.Hub,
) *WishlistHandler {
	return &WishlistHandler{
		DB:  db,
		Hub: hub,
	}
}

func normalizeProductURL(
	value string,
) (string, bool) {
	value =
		strings.TrimSpace(value)

	if value == "" {
		return "", true
	}

	parsed, err :=
		url.ParseRequestURI(value)

	if err != nil ||
		parsed.Host == "" {

		return "", false
	}

	if parsed.Scheme != "http" &&
		parsed.Scheme != "https" {

		return "", false
	}

	return value, true
}

/* ==========================================
   CHECK FOLDER ACCESS
========================================== */

func (h *WishlistHandler) hasAccess(
	c *gin.Context,
	folderID string,
	userID int64,
) (bool, error) {
	var allowed bool

	err :=
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
			userID,
		).Scan(
			&allowed,
		)

	return allowed, err
}

func (h *WishlistHandler) requireAccess(
	c *gin.Context,
	folderID string,
	userID int64,
) bool {
	allowed, err :=
		h.hasAccess(
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

		return false
	}

	if !allowed {
		c.JSON(
			http.StatusForbidden,
			gin.H{
				"error": "kamu tidak memiliki akses ke folder ini",
			},
		)

		return false
	}

	return true
}

/* ==========================================
   LIST ITEMS
========================================== */

func (h *WishlistHandler) List(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	if !h.requireAccess(
		c,
		folderID,
		userID,
	) {
		return
	}

	rows, err :=
		h.DB.Query(
			c.Request.Context(),
			`
                SELECT
                    wi.id,
                    wi.folder_id,
                    wi.created_by,
                    u.username,
                    wi.name,
                    wi.description,
                    wi.price,
                    wi.tag,
                    wi.image_url,
                    wi.product_url,
                    wi.completed,
                    wi.created_at,
                    wi.updated_at

                FROM wishlist_items wi

                JOIN users u
                    ON u.id = wi.created_by

                WHERE
                    wi.folder_id = $1

                ORDER BY
                    wi.created_at DESC
            `,
			folderID,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengambil wishlist",
			},
		)

		return
	}

	defer rows.Close()

	items :=
		make([]WishlistItem, 0)

	for rows.Next() {
		var item WishlistItem

		err :=
			rows.Scan(
				&item.ID,
				&item.FolderID,
				&item.CreatedBy,
				&item.AddedBy,
				&item.Name,
				&item.Description,
				&item.Price,
				&item.Tag,
				&item.ImageURL,
				&item.ProductURL,
				&item.Completed,
				&item.CreatedAt,
				&item.UpdatedAt,
			)

		if err != nil {
			c.JSON(
				http.StatusInternalServerError,
				gin.H{
					"error": "gagal membaca wishlist",
				},
			)

			return
		}

		items =
			append(
				items,
				item,
			)
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"items": items,
		},
	)
}

/* ==========================================
   CREATE ITEM
========================================== */

func (h *WishlistHandler) Create(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	if !h.requireAccess(
		c,
		folderID,
		userID,
	) {
		return
	}

	var req CreateWishlistRequest

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

	req.Tag =
		strings.TrimSpace(
			req.Tag,
		)

	req.ImageURL =
		strings.TrimSpace(
			req.ImageURL,
		)

	productURL, validProductURL :=
		normalizeProductURL(
			req.ProductURL,
		)

	if !validProductURL {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "link produk harus berupa URL http atau https yang valid",
			},
		)

		return
	}

	req.ProductURL =
		productURL

	if req.Name == "" {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "nama wishlist wajib diisi",
			},
		)

		return
	}

	if len(req.Name) > 150 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "nama wishlist maksimal 150 karakter",
			},
		)

		return
	}

	if req.Price < 0 {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "harga tidak boleh negatif",
			},
		)

		return
	}

	var item WishlistItem

	err :=
		h.DB.QueryRow(
			c.Request.Context(),
			`
                WITH inserted AS (
                    INSERT INTO wishlist_items (
                        folder_id,
                        created_by,
                        name,
                        description,
                        price,
                        tag,
                        image_url,
                        product_url
                    )

                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8
                    )

                    RETURNING
                        id,
                        folder_id,
                        created_by,
                        name,
                        description,
                        price,
                        tag,
                        image_url,
                        product_url,
                        completed,
                        created_at,
                        updated_at
                )

                SELECT
                    i.id,
                    i.folder_id,
                    i.created_by,
                    u.username,
                    i.name,
                    i.description,
                    i.price,
                    i.tag,
                    i.image_url,
                    i.product_url,
                    i.completed,
                    i.created_at,
                    i.updated_at

                FROM inserted i

                JOIN users u
                    ON u.id = i.created_by
            `,
			folderID,
			userID,
			req.Name,
			req.Description,
			req.Price,
			req.Tag,
			req.ImageURL,
			req.ProductURL,
		).Scan(
			&item.ID,
			&item.FolderID,
			&item.CreatedBy,
			&item.AddedBy,
			&item.Name,
			&item.Description,
			&item.Price,
			&item.Tag,
			&item.ImageURL,
			&item.ProductURL,
			&item.Completed,
			&item.CreatedAt,
			&item.UpdatedAt,
		)

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal membuat wishlist",
			},
		)

		return
	}

	h.recordActivity(
		c,
		folderID,
		userID,
		"wishlist_created",
		item.ID,
		item.Name,
	)

	h.broadcastWishlistChange(
		folderID,
		"created",
		item,
		item.ID,
	)

	c.JSON(
		http.StatusCreated,
		gin.H{
			"message": "wishlist berhasil ditambahkan",
			"item":    item,
		},
	)
}

/* ==========================================
   UPDATE ITEM
========================================== */

func (h *WishlistHandler) Update(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	itemID :=
		c.Param("itemId")

	if !h.requireAccess(
		c,
		folderID,
		userID,
	) {
		return
	}

	var req UpdateWishlistRequest

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
		req.Description == nil &&
		req.Price == nil &&
		req.Tag == nil &&
		req.ImageURL == nil &&
		req.ProductURL == nil &&
		req.Completed == nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "tidak ada data yang diubah",
			},
		)

		return
	}

	var nameValue interface{}
	var descriptionValue interface{}
	var priceValue interface{}
	var tagValue interface{}
	var imageValue interface{}
	var productURLValue interface{}
	var completedValue interface{}

	if req.Name != nil {
		value :=
			strings.TrimSpace(
				*req.Name,
			)

		if value == "" {
			c.JSON(
				http.StatusBadRequest,
				gin.H{
					"error": "nama wishlist wajib diisi",
				},
			)

			return
		}

		if len(value) > 150 {
			c.JSON(
				http.StatusBadRequest,
				gin.H{
					"error": "nama wishlist maksimal 150 karakter",
				},
			)

			return
		}

		nameValue =
			value
	}

	if req.Description != nil {
		descriptionValue =
			strings.TrimSpace(
				*req.Description,
			)
	}

	if req.Price != nil {
		if *req.Price < 0 {
			c.JSON(
				http.StatusBadRequest,
				gin.H{
					"error": "harga tidak boleh negatif",
				},
			)

			return
		}

		priceValue =
			*req.Price
	}

	if req.Tag != nil {
		tagValue =
			strings.TrimSpace(
				*req.Tag,
			)
	}

	if req.ImageURL != nil {
		imageValue =
			strings.TrimSpace(
				*req.ImageURL,
			)
	}

	if req.ProductURL != nil {
		value, valid :=
			normalizeProductURL(
				*req.ProductURL,
			)

		if !valid {
			c.JSON(
				http.StatusBadRequest,
				gin.H{
					"error": "link produk harus berupa URL http atau https yang valid",
				},
			)

			return
		}

		productURLValue =
			value
	}

	if req.Completed != nil {
		completedValue =
			*req.Completed
	}

	var item WishlistItem

	err :=
		h.DB.QueryRow(
			c.Request.Context(),
			`
                WITH updated AS (
                    UPDATE wishlist_items

                    SET
                        name =
                            COALESCE(
                                $1::TEXT,
                                name
                            ),

                        description =
                            COALESCE(
                                $2::TEXT,
                                description
                            ),

                        price =
                            COALESCE(
                                $3::BIGINT,
                                price
                            ),

                        tag =
                            COALESCE(
                                $4::TEXT,
                                tag
                            ),

                        image_url =
                            COALESCE(
                                $5::TEXT,
                                image_url
                            ),

                        product_url =
                            COALESCE(
                                $6::TEXT,
                                product_url
                            ),

                        completed =
                            COALESCE(
                                $7::BOOLEAN,
                                completed
                            ),

                        updated_at =
                            NOW()

                    WHERE
                        id = $8
                        AND folder_id = $9

                    RETURNING
                        id,
                        folder_id,
                        created_by,
                        name,
                        description,
                        price,
                        tag,
                        image_url,
                        product_url,
                        completed,
                        created_at,
                        updated_at
                )

                SELECT
                    i.id,
                    i.folder_id,
                    i.created_by,
                    u.username,
                    i.name,
                    i.description,
                    i.price,
                    i.tag,
                    i.image_url,
                    i.product_url,
                    i.completed,
                    i.created_at,
                    i.updated_at

                FROM updated i

                JOIN users u
                    ON u.id = i.created_by
            `,
			nameValue,
			descriptionValue,
			priceValue,
			tagValue,
			imageValue,
			productURLValue,
			completedValue,
			itemID,
			folderID,
		).Scan(
			&item.ID,
			&item.FolderID,
			&item.CreatedBy,
			&item.AddedBy,
			&item.Name,
			&item.Description,
			&item.Price,
			&item.Tag,
			&item.ImageURL,
			&item.ProductURL,
			&item.Completed,
			&item.CreatedAt,
			&item.UpdatedAt,
		)

	if errors.Is(
		err,
		pgx.ErrNoRows,
	) {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "wishlist tidak ditemukan",
			},
		)

		return
	}

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal mengubah wishlist",
			},
		)

		return
	}

	activityAction := "wishlist_updated"

	if req.Completed != nil {
		if *req.Completed {
			activityAction = "wishlist_completed"
		} else {
			activityAction = "wishlist_uncompleted"
		}
	}

	h.recordActivity(
		c,
		folderID,
		userID,
		activityAction,
		item.ID,
		item.Name,
	)

	h.broadcastWishlistChange(
		folderID,
		"updated",
		item,
		item.ID,
	)

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "wishlist berhasil diubah",
			"item":    item,
		},
	)
}

/* ==========================================
   DELETE ITEM
========================================== */

func (h *WishlistHandler) Delete(
	c *gin.Context,
) {
	userID, ok :=
		getUserID(c)

	if !ok {
		return
	}

	folderID :=
		c.Param("id")

	itemID :=
		c.Param("itemId")

	if !h.requireAccess(
		c,
		folderID,
		userID,
	) {
		return
	}

	var deletedName string

	err :=
		h.DB.QueryRow(
			c.Request.Context(),
			`
                DELETE FROM wishlist_items
                WHERE
                    id = $1
                    AND folder_id = $2
                RETURNING
                    name
            `,
			itemID,
			folderID,
		).Scan(
			&deletedName,
		)

	if err == pgx.ErrNoRows {
		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "wishlist tidak ditemukan",
			},
		)

		return
	}

	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "gagal menghapus wishlist",
			},
		)

		return
	}

	h.recordActivity(
		c,
		folderID,
		userID,
		"wishlist_deleted",
		itemID,
		deletedName,
	)

	h.broadcastWishlistChange(
		folderID,
		"deleted",
		nil,
		itemID,
	)

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "wishlist berhasil dihapus",
		},
	)
}

/* ==========================================
   REALTIME BROADCAST
========================================== */

func (h *WishlistHandler) broadcastWishlistChange(
	folderID string,
	action string,
	item interface{},
	itemID interface{},
) {
	if h.Hub == nil {
		return
	}

	id, err :=
		strconv.ParseInt(
			folderID,
			10,
			64,
		)

	if err != nil {
		return
	}

	h.Hub.Broadcast(
		id,
		map[string]interface{}{
			"type":      "wishlist_changed",
			"action":    action,
			"folder_id": id,
			"item":      item,
			"item_id":   itemID,
		},
	)
}

func (h *WishlistHandler) recordActivity(
	c *gin.Context,
	folderID string,
	actorID int64,
	action string,
	itemID interface{},
	itemName string,
) {
	folderIDInt, err := strconv.ParseInt(
		folderID,
		10,
		64,
	)

	if err != nil {
		log.Printf(
			"activity: folder id tidak valid: %v",
			err,
		)

		return
	}

	var normalizedItemID interface{}

	switch value := itemID.(type) {
	case string:
		parsedID, parseErr := strconv.ParseInt(
			value,
			10,
			64,
		)

		if parseErr == nil {
			normalizedItemID = parsedID
		}

	default:
		normalizedItemID = value
	}

	var activityID int64
	var createdAt time.Time

	err = h.DB.QueryRow(
		c.Request.Context(),
		`
            INSERT INTO activity_logs (
                folder_id,
                actor_id,
                action,
                item_id,
                item_name
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5
            )
            RETURNING
                id,
                created_at
        `,
		folderIDInt,
		actorID,
		action,
		normalizedItemID,
		itemName,
	).Scan(
		&activityID,
		&createdAt,
	)

	if err != nil {
		log.Printf(
			"gagal menyimpan activity log: %v",
			err,
		)

		return
	}

	var username string
	var email string

	err = h.DB.QueryRow(
		c.Request.Context(),
		`
            SELECT
                username,
                email
            FROM users
            WHERE id = $1
        `,
		actorID,
	).Scan(
		&username,
		&email,
	)

	if err != nil {
		username = "Unknown"
		email = ""
	}

	if h.Hub == nil {
		return
	}

	h.Hub.Broadcast(
		folderIDInt,
		map[string]interface{}{
			"type": "activity_created",

			"activity": map[string]interface{}{
				"id":             activityID,
				"folder_id":      folderIDInt,
				"actor_id":       actorID,
				"actor_username": username,
				"actor_email":    email,
				"action":         action,
				"item_id":        normalizedItemID,
				"item_name":      itemName,
				"created_at":     createdAt,
			},
		},
	)
}
