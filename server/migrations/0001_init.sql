CREATE TABLE users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Only a hash of the bearer token is kept, so a database leak can't sign anyone in.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES users(email),
  created_at INTEGER NOT NULL
);

-- FCM registration tokens. session_hash lets signing out drop just that phone.
CREATE TABLE devices (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES users(email),
  session_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX devices_email ON devices(email);

-- addressee is a plain email: you can add a friend who hasn't installed the app yet.
CREATE TABLE friendships (
  requester TEXT NOT NULL,
  addressee TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (requester, addressee)
);
CREATE INDEX friendships_addressee ON friendships(addressee);

CREATE TABLE lobbies (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL REFERENCES users(email),
  date TEXT NOT NULL,          -- DD-MM-YYYY, as the app and UMPoint write it
  court TEXT NOT NULL,
  event TEXT NOT NULL,
  pax INTEGER NOT NULL,
  fire_at INTEGER NOT NULL,    -- the week's Monday 00:00 MYT, in ms
  closes_at INTEGER NOT NULL,  -- no claims after this, so every phone is armed before its 23:50 alarm
  status TEXT NOT NULL CHECK (status IN ('open', 'cancelled')),
  created_at INTEGER NOT NULL
);
CREATE INDEX lobbies_fire_at ON lobbies(fire_at);

-- One row per half hour. The unique index is the guarantee that nobody holds two slots of a session.
CREATE TABLE slots (
  lobby_id TEXT NOT NULL REFERENCES lobbies(id),
  idx INTEGER NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  claimed_by TEXT,
  claimed_at INTEGER,
  result TEXT CHECK (result IN ('booked', 'failed', 'missed')),
  message TEXT,
  PRIMARY KEY (lobby_id, idx)
);
CREATE UNIQUE INDEX slots_one_per_person ON slots(lobby_id, claimed_by) WHERE claimed_by IS NOT NULL;

CREATE TABLE invites (
  lobby_id TEXT NOT NULL REFERENCES lobbies(id),
  email TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  -- host and accepted hold a slot; player said yes after every slot had gone.
  response TEXT NOT NULL CHECK (response IN ('host', 'pending', 'accepted', 'player', 'declined')),
  responded_at INTEGER,
  PRIMARY KEY (lobby_id, email)
);
CREATE INDEX invites_email ON invites(email);

-- Holds the short-lived FCM access token between cold starts.
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires INTEGER NOT NULL
);
