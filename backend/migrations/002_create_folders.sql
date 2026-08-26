CREATE TABLE IF NOT EXISTS folders (
    id BIGSERIAL PRIMARY KEY,

    owner_id BIGINT
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    name VARCHAR(100)
        NOT NULL,

    description TEXT
        NOT NULL
        DEFAULT '',

    type VARCHAR(20)
        NOT NULL
        DEFAULT 'private',

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT folders_type_check
        CHECK (type IN ('private', 'shared'))
);

CREATE INDEX IF NOT EXISTS idx_folders_owner_id
    ON folders(owner_id);
