UPDATE "Contract" AS c
SET "terminationDate" = COALESCE(se."fechaActivacionBaja", se."fechaActivacionAlta")
FROM "SwitchingEvent" AS se
WHERE se."contractId" = c."id"
  AND se."procesoBase" = 'T1'
  AND se."paso" = '06'
  AND COALESCE(se."fechaActivacionBaja", se."fechaActivacionAlta") IS NOT NULL;