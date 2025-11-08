CREATE TABLE human (
                   number     INTEGER PRIMARY KEY,
                   email      TEXT UNIQUE,
                   created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE runner (
                    number     INTEGER PRIMARY KEY,
                    name       TEXT UNIQUE NOT NULL,
                    created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE auth_provider (
                           number                    INTEGER PRIMARY KEY,
                           human_number              INTEGER NOT NULL REFERENCES human (number) ON DELETE CASCADE,
                           provider_name             TEXT    NOT NULL,
                           provider_human_identifier TEXT    NOT NULL,
                           UNIQUE (provider_name, provider_human_identifier)
);

CREATE TABLE session (
                     number       INTEGER PRIMARY KEY,
                     human_number INTEGER NOT NULL REFERENCES human (number) ON DELETE CASCADE,
                     expires_at   INTEGER NOT NULL
);

CREATE TABLE message (
                     number       INTEGER PRIMARY KEY,
                     human_number TEXT NOT NULL REFERENCES human (number),
                     title        TEXT NOT NULL,
                     body         TEXT NOT NULL,
                     created_at   INTEGER DEFAULT (unixepoch())
);