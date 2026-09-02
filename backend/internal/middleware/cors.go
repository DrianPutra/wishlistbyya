package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	allowedOrigins := map[string]bool{
		"http://localhost:5500":                    true,
		"http://127.0.0.1:5500":                    true,
		"https://wishlistbyya.nekoyaa.workers.dev": true,
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if allowedOrigins[origin] {
			c.Writer.Header().Set(
				"Access-Control-Allow-Origin",
				origin,
			)

			c.Writer.Header().Set(
				"Vary",
				"Origin",
			)
		}

		c.Writer.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		)

		c.Writer.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PATCH, DELETE, OPTIONS",
		)

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(
				http.StatusNoContent,
			)

			return
		}

		c.Next()
	}
}
