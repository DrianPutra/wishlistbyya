CREATE TABLE IF NOT EXISTS folder_members (
    folder_id BIGINT
        NOT NULL
        REFERENCES folders(id)
        ON DELETE CASCADE,

    user_id BIGINT
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role VARCHAR(20)
        NOT NULL
        DEFAULT 'member',

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        folder_id,
        user_id
    ),

    CONSTRAINT folder_members_role_check
        CHECK (role IN ('member'))
);

CREATE INDEX IF NOT EXISTS idx_folder_members_user_id
    ON folder_members(user_id);

CREATE INDEX IF NOT EXISTS idx_folder_members_folder_id
    ON folder_members(folder_id);
