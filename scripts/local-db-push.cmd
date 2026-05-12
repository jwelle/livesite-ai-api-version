@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-db-push.ps1" %*
