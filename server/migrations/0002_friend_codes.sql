-- Accounts are a chosen friend code rather than a Google email. The table was empty when this ran.
ALTER TABLE users RENAME COLUMN email TO code;
ALTER TABLE sessions RENAME COLUMN email TO code;
ALTER TABLE devices RENAME COLUMN email TO code;
ALTER TABLE invites RENAME COLUMN email TO code;

DROP INDEX devices_email;
CREATE INDEX devices_code ON devices(code);
DROP INDEX invites_email;
CREATE INDEX invites_code ON invites(code);

-- Readable on purpose: the owner hands a lost key back to a friend with server/keys.sh.
ALTER TABLE users ADD COLUMN recovery_key TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX users_recovery_key ON users(recovery_key);

CREATE TABLE signups (
  network TEXT NOT NULL,  -- a hash of the address; rows go after the hour ends
  hour INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (network, hour)
);
