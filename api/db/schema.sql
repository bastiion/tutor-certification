-- Sessions: one row per course session until pruned after valid_until.
CREATE TABLE IF NOT EXISTS sessions (
    id                  TEXT PRIMARY KEY,
    course_title        TEXT NOT NULL,
    course_date         TEXT NOT NULL,
    institute_name      TEXT NOT NULL,
    k_master_pub        TEXT NOT NULL,
    k_course_pub        TEXT NOT NULL,
    session_sig         TEXT NOT NULL,
    k_course_priv_enc   TEXT NOT NULL,
    valid_until         INTEGER NOT NULL,
    tutor_email         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revocations (
    cert_id     TEXT PRIMARY KEY,
    revoked_at  TEXT NOT NULL,
    reason      TEXT NOT NULL,
    signature   TEXT NOT NULL
);

-- Links issued certificate IDs to session (course) row for revocation mail routing.
CREATE TABLE IF NOT EXISTS issued_certs (
    cert_id    TEXT PRIMARY KEY,
    course_id  TEXT NOT NULL
);
