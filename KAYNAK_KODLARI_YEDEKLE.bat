@echo off
setlocal EnableDelayedExpansion

REM --- AYARLAR ---
set "SOURCE_DIR=%~dp0"
REM Sondaki backslash'i kaldir
if "%SOURCE_DIR:~-1%"=="\" set "SOURCE_DIR=%SOURCE_DIR:~0,-1%"

REM Tarih ve Saat Bilgisi: YYYY-MM-DD_HH-MM
set "CUR_YYYY=%date:~10,4%"
set "CUR_MM=%date:~7,2%"
set "CUR_DD=%date:~4,2%"
set "CUR_HH=%time:~0,2%"
set "CUR_MIN=%time:~3,2%"

REM Bosluklari 0 ile degistir (Saat tek haneli ise)
set "CUR_HH=%CUR_HH: =0%"

set "TIMESTAMP=%CUR_YYYY%-%CUR_MM%-%CUR_DD%_%CUR_HH%-%CUR_MIN%"

REM Hedef Klasor Ismi
set "BACKUP_DIR=%SOURCE_DIR%_YEDEK_%TIMESTAMP%"

echo ==================================================
echo MUFETTIS YARDIMCISI - KAYNAK KOD YEDEKLEME
echo ==================================================
echo.
echo Kaynak: %SOURCE_DIR%
echo Hedef : %BACKUP_DIR%
echo.
echo Yedekleme basliyor...

REM XCOPY ile kopyala
REM /E - Alt klasorler dahil
REM /I - Hedef klasor yoksa klasor farzet
REM /H - Gizli dosyalari da kopyala
REM /Y - Sormadan uzerine yaz (gerci yeni klasor aciyoruz ama olsun)
REM /Exclude - node_modules vb haric tutmak isterseniz bir dosya gosterilebilir.

xcopy "%SOURCE_DIR%\*" "%BACKUP_DIR%\" /E /I /H /Y

echo.
echo ==================================================
if %ERRORLEVEL% equ 0 (
    echo [BASARILI] Yedekleme tamamlandi!
    echo Yedek Konumu: %BACKUP_DIR%
    
    echo.
    echo Klasor aciliyor...
    explorer "%BACKUP_DIR%"
) else (
    echo [HATA] Yedekleme sirasinda bir sorun olustu!
)
echo ==================================================
echo.
REM pause removed for auto-close
