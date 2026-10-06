-- Guest capabilities are bearer secrets represented only by their SHA-256
-- digest. One invitation can be associated with exactly one article.
CREATE TABLE guest_invitations (
  id TEXT PRIMARY KEY,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  capability_hash TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('active', 'submitted', 'revoked')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  submitted_at TEXT,
  revoked_at TEXT
);

CREATE TABLE guest_contributions (
  invitation_id TEXT PRIMARY KEY REFERENCES guest_invitations(id),
  article_id TEXT NOT NULL UNIQUE REFERENCES articles(id)
);

CREATE INDEX idx_guest_invitations_state_expires ON guest_invitations (state, expires_at);
