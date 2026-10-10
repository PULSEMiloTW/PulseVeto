@echo off
cd /d "%~dp0.."
node --import tsx scripts/closed-beta.mjs
pause
