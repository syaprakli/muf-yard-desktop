@echo off
:: Müf.Yard Masaüstü Başlatıcı
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
call npm start
exit
