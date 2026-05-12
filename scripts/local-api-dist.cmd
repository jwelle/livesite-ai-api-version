@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-api-dist.ps1" %*
