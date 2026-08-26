CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    email VARCHAR(255)
        NOT NULL
        UNIQUE,

    username VARCHAR(50)
        NOT NULL
        UNIQUE,

    password_hash TEXT
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
);
