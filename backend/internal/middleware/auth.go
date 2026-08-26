package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	appauth "wishlistbyya/internal/auth"
)

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		header :=
			c.GetHeader("Authorization")

		if header == "" {
			c.JSON(
				http.StatusUnauthorized,
				gin.H{
					"error": "authorization token diperlukan",
				},
			)

			c.Abort()
			return
		}

		parts :=
			strings.SplitN(
				header,
				" ",
				2,
			)

		if len(parts) != 2 ||
			!strings.EqualFold(
				parts[0],
				"Bearer",
			) {

			c.JSON(
				http.StatusUnauthorized,
				gin.H{
					"error": "format authorization tidak valid",
				},
			)

			c.Abort()
			return
		}

		claims, err :=
			appauth.ParseToken(
				parts[1],
			)

		if err != nil {
			c.JSON(
				http.StatusUnauthorized,
				gin.H{
					"error": "token tidak valid atau sudah kedaluwarsa",
				},
			)

			c.Abort()
			return
		}

		c.Set(
			"userID",
			claims.UserID,
		)

		c.Next()
	}
}
