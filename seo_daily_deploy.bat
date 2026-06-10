@echo off
:: ============================================================
::   MY CARWASH APP — Daily SEO Auto-Deploy Script
::   Runs every morning at 6:00 AM via Windows Task Scheduler
::   - Regenerates all 55 city pages with today's SEO tip
::   - Updates sitemap.xml with today's date
::   - Deploys only /landing to Firebase Hosting (fast deploy)
:: ============================================================

SET LANDING_DIR=C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\landing
SET FUNCTIONS_DIR=C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\functions
SET LOG_FILE=C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\seo_deploy.log

echo. >> %LOG_FILE%
echo ============================================ >> %LOG_FILE%
echo [%DATE% %TIME%] Starting daily SEO deploy... >> %LOG_FILE%
echo ============================================ >> %LOG_FILE%

:: Step 1: Run keyword scraper bot to fetch fresh search queries and keywords
echo [%TIME%] Running seo_keyword_bot.py... >> %LOG_FILE%
python "%LANDING_DIR%\seo_keyword_bot.py" >> %LOG_FILE% 2>&1

IF %ERRORLEVEL% NEQ 0 (
    echo [%TIME%] ERROR: seo_keyword_bot.py failed! >> %LOG_FILE%
    exit /b 1
)
echo [%TIME%] Keywords scraped successfully. >> %LOG_FILE%

:: Step 2: Regenerate all city pages with today's tip and trending keywords
echo [%TIME%] Running generate_seo_pages.py... >> %LOG_FILE%
python "%LANDING_DIR%\generate_seo_pages.py" >> %LOG_FILE% 2>&1

IF %ERRORLEVEL% NEQ 0 (
    echo [%TIME%] ERROR: generate_seo_pages.py failed! >> %LOG_FILE%
    exit /b 1
)
echo [%TIME%] Pages generated successfully. >> %LOG_FILE%

:: Step 2: Deploy to Firebase Hosting (only hosting, not functions - faster)
echo [%TIME%] Deploying to Firebase Hosting... >> %LOG_FILE%
cd /d "C:\Users\cramr\OneDrive\Documents\My-Carwash-app-"
call firebase deploy --only hosting >> %LOG_FILE% 2>&1

IF %ERRORLEVEL% NEQ 0 (
    echo [%TIME%] ERROR: Firebase deploy failed! >> %LOG_FILE%
    exit /b 1
)

echo [%TIME%] Deploy completed successfully! >> %LOG_FILE%
echo [%TIME%] All 55 city pages updated with today's SEO tip. >> %LOG_FILE%
