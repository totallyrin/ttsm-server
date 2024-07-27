const { exec } = require("child_process");
const os = require("os");
const pty = require("node-pty");
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
const servers = require("./serverconfig").servers;
const logs = require("./server").logs;
const clients = require("./server").clients;

/**
 * function to kill a given foreign game server
 *
 * @param game
 * @returns {Promise<void>}
 */
async function killServer(game) {
  return new Promise((resolve, reject) => {
    switch (game) {
      // java-based servers
      case "pz":
      case "tekkit2":
      case "minecraft":
        // Find the process ID of the Minecraft server
        exec('tasklist | find "java.exe"', (error, stdout) => {
          if (error) {
            console.error(`could not find any unknown ${game} servers`);
            resolve(error);
            return;
          }

          // Extract the process ID from the output
          const pid = stdout.trim().split(/\s+/)[1];

          // Kill the process
          exec(`taskkill /F /PID ${pid}`, (error) => {
            if (error) {
              console.error(`exec error: ${error}`);
              reject(error);
            }

            console.log(`process ${pid} killed`);
            resolve(pid);
          });
        });
        break;
      case "valheim":
      case "redm":
      case "terraria":
        // Find the process ID of the server
        exec(
          `tasklist | find "${
            game.charAt(0).toUpperCase() + game.slice(1)
          }Server.exe"`,
          (error, stdout) => {
            if (error) {
              console.error(`could not find any unknown ${game} servers`);
              resolve(error);
              return;
            }

            // Extract the process ID from the output
            const pid = stdout.trim().split(/\s+/)[1];

            // Kill the process
            exec(`taskkill /F /PID ${pid}`, (error, stdout) => {
              if (error) {
                console.error(`exec error: ${error}`);
                reject(error);
              }

              console.log(`process ${pid} killed`);
              resolve(stdout);
            });
          },
        );
        break;
    }
  });
}

/**
 * function to start a server using node-pty
 *
 * @param ws websocket to send status updates over
 * @param game server to start
 * @returns {Promise<void>}
 */
async function startServerPTY(ws, game) {
  // if server is running, send stop command
  if (servers[game].running) {
    console.log(`attempting to stop ${game} server`);
    try {
      servers[game].server.write(servers[game].stop);
    } catch (e) {
      console.log(`could not stop ${game} server safely; attempting to kill`);
      try {
        servers[game].server.kill();
      } catch (e) {
        console.log(`could not kill ${game} server`);
      }
    }
  }
  // if server is not running,
  else {
    updateStatus(ws, game, "pinging");

    // kill unknown servers
    await killServer(game);

    console.log(`starting ${game} server`);
    // start a new server
    process.chdir(`game_servers\\${game}`);
    servers[game].server = pty.spawn(shell, servers[game].args, {
      name: `${game}Server`,
      cwd: process.env.PWD,
      env: process.env,
      cols: 1000,
    });
    process.chdir("..\\..");

    servers[game].server.onData((data) => {
      if (typeof data !== "string") return;
      if (!data.includes("[K") && !data.includes("C:\\Users\\")) {
        const log = `${servers[game].name} server: ${data.trim()}`;
        if (data.includes(servers[game].online)) {
          console.log(`${game} server started`);
          updateStatus(ws, game, true);
        }
        if (data.includes(servers[game].offline)) {
          updateStatus(ws, game, "pinging");
        }
        if (data.includes("Terminate batch job (Y/N)?") || data.includes("Press any key")) {
          servers[game].server.write("Y");
          updateStatus(ws, game, false);
        }
        sendAll({
          type: "console",
          data: log,
        });
        logs.add(log);
      }
    });

    servers[game].server.onExit((data) => {
      console.log(`${game} server exited with code ${data.exitCode}`);
      sendAll({
        type: "console",
        data: `${servers[game].name} server: exited with code ${data.exitCode}`,
      });
      updateStatus(ws, game, false);
    });
  }
}

async function updateGame(ws, game) {
  // if server is running, don't update
  if (servers[game].running) {
    const log = `${servers[game].name} server: Cannot update; server is running`;
    console.log(log);
    sendAll({
      type: "console",
      data: log,
    });
    logs.add(log);
  }
  // if server is not running,
  else {
    updateStatus(ws, game, "updating");

    // kill unknown servers
    await killServer(game);

    console.log(`updating ${game} server`);
    // start a new process
    process.chdir(`game_servers\\updates`);
    servers[game].server = pty.spawn(shell, [`.\\update-${game}.bat`], {
      name: `${game}Update`,
      cwd: process.env.PWD,
      env: process.env,
      cols: 1000,
    });
    process.chdir("..\\..");

    servers[game].server.onData((data) => {
      if (typeof data !== "string") return;
      if (!data.includes("[K")) {
        const log = `${servers[game].name} server: ${data.trim()}`;
        if (
          data.includes("Replace ..minecraftserver.jar with latest [Y,N]?") ||
          data.includes("Terminate batch job (Y/N)?")
        ) {
          servers[game].server.write("Y");
        }
        sendAll({
          type: "console",
          data: log,
        });
        logs.add(log);
      }
    });

    servers[game].server.onExit((data) => {
      console.log(`${game} server: update exited with code ${data.exitCode}`);
      const log = `${servers[game].name} server: update exited with code ${data.exitCode}`;
      sendAll({
        type: "console",
        data: log,
      });
      logs.add(log);
      updateStatus(ws, game, false);
    });
  }
}

/**
 * function to send server status updates
 *
 * @param ws web server for messaging
 * @param game game to update
 * @param status status to update to
 */
function updateStatus(ws, game, status) {
  servers[game].running = status;
  ws.send(
    JSON.stringify({
      type: "serverState",
      game: game,
      running: servers[game].running,
    }),
  );
}

function sendAll(data) {
  for (const client of clients) {
    const ws = client.ws;
    ws.send(JSON.stringify(data));
  }
}

module.exports.startServerPTY = startServerPTY;
module.exports.updateGame = updateGame;
