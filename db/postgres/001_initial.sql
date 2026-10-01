CREATE TABLE users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at bigint NOT NULL
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE libraries (
  owner_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
);

CREATE TABLE bootstrap (
  id integer PRIMARY KEY CHECK (id = 1),
  user_id uuid NOT NULL REFERENCES users(id)
);

CREATE TABLE rooms (
  code text PRIMARY KEY CHECK (code ~ '^[0-9]{6}$'),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at bigint NOT NULL
);
CREATE INDEX rooms_created_at_idx ON rooms(created_at);
