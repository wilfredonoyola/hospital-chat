-- Volumen de prueba para medir la lectura de mensajes (solo en desarrollo).
-- ~300 000 mensajes en 90 días repartidos entre las áreas del seed; Emergencias concentra más.
-- Uso: docker compose exec -T db psql -U hospital_chat -d hospital_chat < docs/rendimiento/volumen.sql
INSERT INTO messages (department_id, author_id, body, priority, created_at)
SELECT d.id,
       (SELECT dm.user_id FROM department_members dm WHERE dm.department_id = d.id LIMIT 1),
       'Mensaje de volumen #' || g,
       CASE WHEN g % 50 = 0 THEN 'URGENT' ELSE 'NORMAL' END::message_priority,
       now() - (random() * interval '90 days')
  FROM generate_series(1, 300000) AS g
  JOIN LATERAL (
    SELECT id FROM departments
     WHERE name = CASE WHEN g % 3 = 0 THEN 'UCI' WHEN g % 10 = 1 THEN 'Pediatría' ELSE 'Emergencias' END
  ) d ON true;
ANALYZE messages;
SELECT d.name, count(*) FROM messages m JOIN departments d ON d.id = m.department_id GROUP BY 1 ORDER BY 2 DESC;
