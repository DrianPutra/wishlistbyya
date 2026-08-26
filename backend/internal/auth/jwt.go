package auth

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID int64 `json:"user_id"`

	jwt.RegisteredClaims
}

func GenerateToken(userID int64) (string, error) {
	secret := os.Getenv("JWT_SECRET")

	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET tidak ditemukan")
	}

	claims := Claims{
		UserID: userID,

		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt: jwt.NewNumericDate(
				time.Now(),
			),

			ExpiresAt: jwt.NewNumericDate(
				time.Now().Add(
					7 * 24 * time.Hour,
				),
			),
		},
	}

	token := jwt.NewWithClaims(
		jwt.SigningMethodHS256,
		claims,
	)

	return token.SignedString(
		[]byte(secret),
	)
}

func ParseToken(tokenString string) (*Claims, error) {
	secret := os.Getenv("JWT_SECRET")

	if secret == "" {
		return nil, fmt.Errorf("JWT_SECRET tidak ditemukan")
	}

	token, err := jwt.ParseWithClaims(
		tokenString,
		&Claims{},
		func(token *jwt.Token) (interface{}, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, fmt.Errorf(
					"algoritma JWT tidak valid",
				)
			}

			return []byte(secret), nil
		},
	)

	if err != nil {
		return nil, err
	}

	claims, ok :=
		token.Claims.(*Claims)

	if !ok || !token.Valid {
		return nil, fmt.Errorf(
			"token tidak valid",
		)
	}

	return claims, nil
}
