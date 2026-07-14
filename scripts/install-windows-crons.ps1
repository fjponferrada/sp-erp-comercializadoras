$action = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File `"C:\Users\Administrator\sp-erp-comercializadoras\scripts\trigger-cron.ps1`""

schtasks /create /tn "SPEnergia_Cron_ActivateRenewals" /tr "$action -CronName activate-renewals" /sc daily /st 01:00 /ru SYSTEM /f
schtasks /create /tn "SPEnergia_Cron_UpdatePortfolio" /tr "$action -CronName update-portfolio" /sc daily /st 02:00 /ru SYSTEM /f
schtasks /create /tn "SPEnergia_Cron_FtpSync" /tr "$action -CronName ftp-sync" /sc daily /st 03:00 /ru SYSTEM /f
schtasks /create /tn "SPEnergia_Cron_AggregateHistory" /tr "$action -CronName aggregate-history" /sc daily /st 04:00 /ru SYSTEM /f
schtasks /create /tn "SPEnergia_Cron_TrainForecast" /tr "$action -CronName train-forecast" /sc daily /st 05:00 /ru SYSTEM /f
schtasks /create /tn "SPEnergia_Cron_TriggerScraping" /tr "$action -CronName trigger-scraping" /sc daily /st 06:00 /ru SYSTEM /f
schtasks /create /tn "SPEnergia_Cron_SyncEsios" /tr "$action -CronName sync-esios" /sc daily /st 08:00 /ru SYSTEM /f

Write-Host "Todas las tareas programadas han sido registradas en Windows Task Scheduler."
