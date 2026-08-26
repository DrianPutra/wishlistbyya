CREATE TABLE IF NOT EXISTS wishlist_items (
    id BIGSERIAL PRIMARY KEY,

    folder_id BIGINT
        NOT NULL
        REFERENCES folders(id)
        ON DELETE CASCADE,

    created_by BIGINT
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    name VARCHAR(150)
        NOT NULL,

    description TEXT
        NOT NULL
        DEFAULT '',

    price BIGINT
        NOT NULL
        DEFAULT 0,

    tag VARCHAR(100)
        NOT NULL
        DEFAULT '',

    image_url TEXT
        NOT NULL
        DEFAULT '',

    completed BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT wishlist_items_price_check
        CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_folder_id
    ON wishlist_items(folder_id);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_created_by
    ON wishlist_items(created_by);
