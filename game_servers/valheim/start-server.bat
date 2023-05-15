@echo off
set SteamAppId=892970
echo "Starting server PRESS CTRL-C to exit"
"./valheim_server.exe" -nographics -batchmode -name "totallyrin" -port 2456 -world "server_1" -password "passwordpass"
-public 1