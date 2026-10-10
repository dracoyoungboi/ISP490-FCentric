@echo off
setlocal
title Khoi dong FCentric

REM ====================================================
REM DAT FILE NAY TRONG THU MUC GOC ISP492-F-ORWMS
REM Ngang hang voi hai thu muc frontend va backend.
REM Co the tao shortcut ra Desktop de chay nhanh.
REM
REM TRUOC KHI CHAY:
REM 1. Dung frontend va backend cu bang Ctrl + C.
REM 2. Cap nhat code moi vao du an.
REM 3. Nhan dup file nay hoac shortcut tren Desktop.
REM ====================================================

REM %~dp0 la duong dan thu muc chua file BAT nay.
REM Kiem tra frontend truoc khi chay.
if not exist "%~dp0frontend\package.json" (
    echo LOI: Khong tim thay frontend\package.json.
    pause
    exit /b 1
)

REM Kiem tra Maven Wrapper cua backend.
if not exist "%~dp0backend\mvnw.cmd" (
    echo LOI: Khong tim thay backend\mvnw.cmd.
    pause
    exit /b 1
)

REM FRONTEND:
REM Build giao dien moi vao dist, sau do chay tren cong 5173.
REM && chi chay lenh tiep theo khi lenh truoc thanh cong.
start "FCentric - Frontend" /D "%~dp0frontend" cmd /k "call npm run build && call serve -s dist -l 5173"

REM BACKEND:
REM Dong goi JAR, bo qua chay test, sau do khoi dong Java.
REM -Xms128m: dung luong heap ban dau 128 MB.
REM -Xmx512m: dung luong heap toi da 512 MB.
REM Neu ten file JAR thay doi, sua duong dan ben duoi.
start "FCentric - Backend" /D "%~dp0backend" cmd /k "call .\mvnw.cmd -DskipTests package && java -Xms128m -Xmx512m -jar .\target\backend-0.0.1-SNAPSHOT.jar"

REM Hai cua so chay doc lap va giu hien thi log.
REM Giu chung mo trong khi web dang hoat dong.
endlocal