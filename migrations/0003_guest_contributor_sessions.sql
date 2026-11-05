-- Keep the original invitation as a short-lived, pre-acceptance capability.
-- Editor sessions and owner-issued recovery links are separate, revocable
-- bearer credentials. Only their SHA-256 digests are stored.
ALTER TABLE guest_invitations ADD COLUMN accepted_at TEXT;

CREATE TABLE guest_contributor_sessions (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES guest_invitations(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_guest_contributor_sessions_invitation ON guest_contributor_sessions (invitation_id);

CREATE TABLE guest_reauthentication_links (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES guest_invitations(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by_session_id TEXT,
  revoked_at TEXT
);
CREATE INDEX idx_guest_reauthentication_links_invitation ON guest_reauthentication_links (invitation_id);
