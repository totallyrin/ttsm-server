:: if NOT running as admin, comment out the following line
cd "%~dp0"

git pull
node server/server.js
pause