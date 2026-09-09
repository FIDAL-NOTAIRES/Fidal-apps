-- Table des dépôts d'articles partagés entre associés (tuile PRESSE).
-- À exécuter une fois dans la console SQL de Neon.
-- La fonction /api/depots.js la crée aussi automatiquement au premier appel :
-- ce script n'est utile que si vous préférez la créer à la main.

CREATE TABLE IF NOT EXISTS presse_depots (
  id         bigserial   PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  author     text        NOT NULL,
  kind       text        NOT NULL,   -- photo | file | link | note
  title      text,
  note       text,
  link       text,
  file_url   text,                   -- URL Vercel Blob de la photo ou du PDF
  mime       text
);

CREATE INDEX IF NOT EXISTS presse_depots_recent ON presse_depots (created_at DESC);
