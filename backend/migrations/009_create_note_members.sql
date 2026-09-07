CREATE TABLE IF NOT EXISTS note_members (
    note_id BIGINT NOT NULL
        REFERENCES notes(id)
        ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL
        DEFAULT 'editor',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        note_id,
        user_id
    ),

    CONSTRAINT note_members_role_check
        CHECK (
            role IN (
                'viewer',
                'editor'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_note_members_user_id
ON note_members(user_id);

CREATE INDEX IF NOT EXISTS idx_note_members_note_id
ON note_members(note_id);