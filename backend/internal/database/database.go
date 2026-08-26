package database

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect() (*pgxpool.Pool, error) {
	databaseURL := os.Getenv("DATABASE_URL")

	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL tidak ditemukan")
	}

	pool, err := pgxpool.New(
		context.Background(),
		databaseURL,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"gagal membuat database pool: %w",
			err,
		)
	}

	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()

		return nil, fmt.Errorf(
			"gagal terhubung ke PostgreSQL: %w",
			err,
		)
	}

	return pool, nil
}
