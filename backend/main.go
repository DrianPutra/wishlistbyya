package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"wishlistbyya/internal/database"
	"wishlistbyya/internal/handler"
	"wishlistbyya/internal/middleware"
	"wishlistbyya/internal/realtime"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatal(
			"Gagal membaca file .env",
		)
	}

	db, err :=
		database.Connect()

	if err != nil {
		log.Fatal(err)
	}

	defer db.Close()

	log.Println(
		"PostgreSQL berhasil terhubung",
	)

	router :=
		gin.Default()

	router.Use(
		middleware.CORS(),
	)

	authHandler :=
		handler.NewAuthHandler(db)

	userHandler :=
		handler.NewUserHandler(db)

	folderHandler :=
		handler.NewFolderHandler(db)

	memberHandler :=
		handler.NewMemberHandler(db)

	activityHandler := handler.NewActivityHandler(db)
	realtimeHub :=
		realtime.NewHub()

	wishlistHandler :=
		handler.NewWishlistHandler(
			db,
			realtimeHub,
		)

	webSocketHandler :=
		handler.NewWebSocketHandler(
			db,
			realtimeHub,
		)

	/* HEALTH */

	router.GET(
		"/health",
		func(c *gin.Context) {
			err :=
				db.Ping(
					context.Background(),
				)

			if err != nil {
				c.JSON(
					http.StatusServiceUnavailable,
					gin.H{
						"status":   "error",
						"database": "disconnected",
					},
				)

				return
			}

			c.JSON(
				http.StatusOK,
				gin.H{
					"status":   "ok",
					"database": "connected",
				},
			)
		},
	)

	/* WEBSOCKET */

	router.GET(
		"/ws/folders/:id",
		webSocketHandler.Folder,
	)

	/* API */

	api :=
		router.Group("/api")

	auth :=
		api.Group("/auth")

	auth.POST(
		"/register",
		authHandler.Register,
	)

	auth.POST(
		"/login",
		authHandler.Login,
	)

	/* PROTECTED */

	protected :=
		api.Group("")

	protected.Use(
		middleware.AuthRequired(),
	)

	protected.GET(
		"/users/me",
		userHandler.Me,
	)

	/* FOLDERS */

	folders :=
		protected.Group(
			"/folders",
		)

	folders.GET(
		"",
		folderHandler.List,
	)

	folders.POST(
		"",
		folderHandler.Create,
	)

	folders.GET(
		"/:id",
		folderHandler.GetOne,
	)

	folders.PATCH(
		"/:id",
		folderHandler.Update,
	)

	folders.DELETE(
		"/:id",
		folderHandler.Delete,
	)

	/* MEMBERS */

	folders.GET(
		"/:id/members",
		memberHandler.List,
	)

	folders.POST(
		"/:id/members",
		memberHandler.Add,
	)

	folders.DELETE(
		"/:id/members/:userId",
		memberHandler.Delete,
	)

	/* WISHLIST ITEMS */

	folders.GET(
		"/:id/activities",
		activityHandler.List,
	)

	folders.GET(
		"/:id/items",
		wishlistHandler.List,
	)

	folders.POST(
		"/:id/items",
		wishlistHandler.Create,
	)

	folders.PATCH(
		"/:id/items/:itemId",
		wishlistHandler.Update,
	)

	folders.DELETE(
		"/:id/items/:itemId",
		wishlistHandler.Delete,
	)

	/* SERVER */

	port :=
		os.Getenv("PORT")

	if port == "" {
		port =
			"8080"
	}

	log.Printf(
		"Server berjalan di http://localhost:%s",
		port,
	)

	if err :=
		router.Run(
			":" + port,
		); err != nil {

		log.Fatal(err)
	}
}
