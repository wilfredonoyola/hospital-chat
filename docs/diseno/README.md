# Diseños de las fases 6 a 9

El laboratorio se cierra como **MVP**: las fases 1 a 5 están construidas, probadas y medidas. Las fases 6 a 9 están **diseñadas, no implementadas**: cada documento dice qué se construiría, por qué, qué se descarta, qué riesgos hay y qué lo dispararía.

La razón es la misma que en el resto del proyecto (ADR 0004, ADR 0006): construir cuando hay un disparador real, no antes. Desplegar en Azure, operar brokers o publicar una app móvil sin usuarios reales agrega costo y operación sin aprender nada que estos diseños no cubran.

| Fase | Documento                              | Decisión central                                                                                                                                                              |
| ---- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6    | [Despliegue en Azure](fase-6-azure.md) | App Service + PostgreSQL Flexible + Key Vault con identidad administrada; adjuntos con SAS de corta duración; slots y migraciones expand/contract para desplegar sin downtime |
| 7    | [Eventos](fase-7-eventos.md)           | Azure Service Bus para notificar urgentes, con outbox, consumidor idempotente, retry, DLQ y circuit breaker; Kafka solo si hace falta releer eventos                          |
| 8    | [CI/CD](fase-8-cicd.md)                | CodeQL, Dependabot, Playwright, imágenes multi-stage y despliegue con OIDC a un slot de staging                                                                               |
| 9    | [App móvil](fase-9-movil.md)           | Expo con token en `expo-secure-store`, sesión por dispositivo y push para urgentes                                                                                            |
