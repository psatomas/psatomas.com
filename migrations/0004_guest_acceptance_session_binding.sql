-- Binds the one successful acceptance transition to the exact session it
-- creates. Unlike a timestamp, a UUID cannot be shared by concurrent calls.
ALTER TABLE guest_invitations ADD COLUMN accepted_session_id TEXT;
CREATE UNIQUE INDEX idx_guest_invitations_accepted_session_id
  ON guest_invitations (accepted_session_id)
  WHERE accepted_session_id IS NOT NULL;
