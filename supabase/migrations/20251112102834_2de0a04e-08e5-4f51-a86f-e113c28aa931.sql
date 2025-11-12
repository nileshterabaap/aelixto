-- Add index for efficient platform queries
CREATE INDEX IF NOT EXISTS posts_user_platform_idx ON posts(user_id, platform) WHERE platform IS NOT NULL;

-- Add index for thumbnail backfill queries
CREATE INDEX IF NOT EXISTS posts_missing_thumbnail_idx ON posts(user_id, platform, created_at) WHERE thumbnail_url IS NULL AND platform IS NOT NULL;