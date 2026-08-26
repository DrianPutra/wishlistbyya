CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,

    folder_id BIGINT
        NOT NULL
        REFERENCES folders(id)
        ON DELETE CASCADE,

    actor_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(50)
        NOT NULL,

    item_id BIGINT,

    item_name VARCHAR(150)
        NOT NULL
        DEFAULT '',

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_folder_id
    ON activity_logs(folder_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
    ON activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id
    ON activity_logs(actor_id);
