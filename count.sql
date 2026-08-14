SELECT count(*)
FROM "SwitchingEvent" AS se
WHERE se."procesoBase" = 'T1'
  AND se."paso" = '06'
  AND se."contractId" IS NOT NULL
  AND COALESCE(se."fechaActivacionBaja", se."fechaActivacionAlta") IS NOT NULL;