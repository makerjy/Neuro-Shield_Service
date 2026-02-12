CREATE TABLE IF NOT EXISTS service_bootstrap (
    id BIGSERIAL PRIMARY KEY,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO service_bootstrap (note)
SELECT 'neuro-shield bootstrap'
WHERE NOT EXISTS (
    SELECT 1 FROM service_bootstrap WHERE note = 'neuro-shield bootstrap'
);
