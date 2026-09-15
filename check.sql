SELECT "id", "fechaActivacionBaja", "fechaActivacionAlta", "fechaAviso"
FROM "SwitchingEvent"
WHERE "procesoBase" = 'T1' AND "paso" = '06' AND "codigoSolicitud" = '202600000155';