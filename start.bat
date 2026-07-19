@echo off
cd /d "%~dp0"

echo Starting Kaizen system... this can take a minute the first time.
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --force-recreate
docker exec kaizen-nginx nginx -s reload

echo.
echo Done. On THIS PC, find the IP address by running "ipconfig" in a
echo terminal (look for IPv4 Address). Other devices on the same
echo Wifi/LAN should then open a browser to:
echo.
echo     http://THAT-IP-ADDRESS
echo.
pause