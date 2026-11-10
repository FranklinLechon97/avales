-- Migración: agrega las columnas de adjunto a una tabla "avales" que ya existía.
-- Ejecuta este script UNA VEZ en pgAdmin (Query Tool, sobre tu base sistema_avales)
-- si ya habías corrido "npm run init-db" antes de esta actualización.
-- Es seguro volver a ejecutarlo: usa IF NOT EXISTS y no duplica nada.

ALTER TABLE avales ADD COLUMN IF NOT EXISTS adjunto_nombre_original VARCHAR(255);
ALTER TABLE avales ADD COLUMN IF NOT EXISTS adjunto_nombre_archivo  VARCHAR(255);
ALTER TABLE avales ADD COLUMN IF NOT EXISTS adjunto_mime            VARCHAR(100);
ALTER TABLE avales ADD COLUMN IF NOT EXISTS adjunto_subido_en       TIMESTAMPTZ;
