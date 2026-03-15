-- OAuth token storage (refresh tokens, authorization codes)

CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash      VARCHAR(255) UNIQUE NOT NULL,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id       VARCHAR(255) NOT NULL,
    scope           TEXT,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked         BOOLEAN DEFAULT FALSE,
    revoked_at      TIMESTAMP WITH TIME ZONE,
    replaced_by     UUID REFERENCES refresh_tokens(id)  -- Token rotation
);

CREATE TABLE authorization_codes (
    code_hash       VARCHAR(255) PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id       VARCHAR(255) NOT NULL,
    redirect_uri    TEXT NOT NULL,
    scope           TEXT,
    code_challenge  VARCHAR(255),  -- PKCE
    code_challenge_method VARCHAR(10),
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    used            BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_auth_codes_expires ON authorization_codes(expires_at);
