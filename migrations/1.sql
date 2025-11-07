CREATE TABLE human (
                   number     INTEGER PRIMARY KEY,
                   email      TEXT UNIQUE NOT NULL,
                   created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE runner (
                    number     INTEGER PRIMARY KEY,
                    name       TEXT UNIQUE NOT NULL,
                    created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE session (
                     number       INTEGER PRIMARY KEY,
                     human_number TEXT    NOT NULL REFERENCES human (number) ON DELETE CASCADE,
                     expires_at   INTEGER NOT NULL
);

CREATE TABLE message (
                     number       INTEGER PRIMARY KEY,
                     human_number TEXT NOT NULL REFERENCES human (number),
                     title        TEXT NOT NULL,
                     body         TEXT NOT NULL,
                     created_at   INTEGER DEFAULT (unixepoch())
);