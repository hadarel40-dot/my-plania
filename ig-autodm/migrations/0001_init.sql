-- חוקים: ריל + מילות מפתח + ההודעה שנשלחת
CREATE TABLE rules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id        TEXT    NOT NULL,
  media_caption   TEXT    NOT NULL DEFAULT '',
  media_permalink TEXT    NOT NULL DEFAULT '',
  keywords        TEXT    NOT NULL,          -- מופרדות בפסיק
  message         TEXT    NOT NULL,
  button_title    TEXT    NOT NULL,
  button_url      TEXT    NOT NULL,
  use_name        INTEGER NOT NULL DEFAULT 1,
  public_reply    INTEGER NOT NULL DEFAULT 1,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX rules_media ON rules (media_id, active);

-- רק תגובות שהתאימו לחוק. נמחקות אחרי 90 יום
CREATE TABLE comments (
  comment_id   TEXT    PRIMARY KEY,           -- מונע שליחה כפולה לאותה תגובה
  rule_id      INTEGER NOT NULL,
  media_id     TEXT    NOT NULL,
  user_id      TEXT    NOT NULL,
  username     TEXT    NOT NULL DEFAULT '',
  text         TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL,              -- pending | sending | sent | failed | expired | skipped
  attempts     INTEGER NOT NULL DEFAULT 0,
  dm_mode      TEXT,                          -- button | text
  error        TEXT,
  reply_error  TEXT,
  received_at  INTEGER NOT NULL,
  next_try_at  INTEGER NOT NULL,
  sent_at      INTEGER
);
CREATE INDEX comments_queue ON comments (status, next_try_at);
CREATE INDEX comments_sent ON comments (sent_at);
CREATE INDEX comments_user ON comments (rule_id, user_id);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE login_attempts (
  ip           TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
