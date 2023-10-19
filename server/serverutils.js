const { exec } = require("child_process");
const os = require("os");
const pty = require("node-pty");
const { logs } = require("./server");
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

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
      case "terraria":
        // Find the process ID of the Terraria server
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
 * @param args start arguments
 * @param stop stop command
 * @param online online confirmation phrase
 * @param offline offline confirmation phrase
 * @returns {Promise<void>}
 */
async function startServerPTY(ws, game, args, stop, online, offline) {
  const servers = require("./server").servers;
  const logs = require("./server").logs;
  // if server is running, send stop command
  if (servers[game].running) {
    console.log(`attempting to stop ${game} server`);
    try {
      servers[game].server.write(stop);
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
    servers[game].server = pty.spawn(shell, args, {
      name: `${
        game === "pz" ? "PZ" : game.charAt(0).toUpperCase() + game.slice(1)
      }Server`,
      cwd: process.env.PWD,
      env: process.env,
      cols: 1000,
    });
    process.chdir("..\\..");

    servers[game].server.onData((data) => {
      if (typeof data !== "string") return;
      if (!data.includes("[K")) {
        const log = `${
          game === "pz" ? "PZ" : game.charAt(0).toUpperCase() + game.slice(1)
        } server: ${data.trim()}`;
        if (data.includes(online)) {
          console.log(`${game} server started`);
          updateStatus(ws, game, true);
        }
        if (data.includes(offline)) {
          updateStatus(ws, game, "pinging");
        }
        if (data.includes("Terminate batch job (Y/N)?")) {
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
        data: `${
          game === "pz" ? "PZ" : game.charAt(0).toUpperCase() + game.slice(1)
        } server: exited with code ${data.exitCode}`,
      });
      updateStatus(ws, game, false);
    });
  }
}

async function updateGame(ws, game) {
  const servers = require("./server").servers;
  const logs = require("./server").logs;
  // if server is running, don't update
  if (servers[game].running) {
    const log = `Cannot update ${
      game === "pz" ? "PZ" : game.charAt(0).toUpperCase() + game.slice(1)
    } server: server is running`;
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
    const update = pty.spawn(shell, [`.\\update-${game}.bat`], {
      name: `${
        game === "pz" ? "PZ" : game.charAt(0).toUpperCase() + game.slice(1)
      }Update`,
      cwd: process.env.PWD,
      env: process.env,
      cols: 1000,
    });
    process.chdir("..\\..");

    update.onData((data) => {
      if (typeof data !== "string") return;
      if (!data.includes("[K")) {
        const log = `${data.trim()}`;
        if (data.includes("Replace ..\minecraft\server.jar with latest [Y,N]?") || data.includes("Terminate batch job (Y/N)?")) {
          update.write("Y");
        }
        sendAll({
          type: "console",
          data: log,
        });
        logs.add(log);
      }
    });

    update.onExit((data) => {
      console.log(
        `${game} server updated: update exited with code ${data.exitCode}`,
      );
      sendAll({
        type: "console",
        data: `${
          game === "pz" ? "PZ" : game.charAt(0).toUpperCase() + game.slice(1)
        } server updated: update exited with code ${data.exitCode}`,
      });
      logs.add(`${
          game === "pz" ? "PZ" : game.charAt(0).toUpperCase() + game.slice(1)
        } server updated: update exited with code ${data.exitCode}`);
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
  const servers = require("./server").servers;
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
  const clients = require("./server").clients;
  for (const client of clients) {
    const ws = client.ws;
    ws.send(JSON.stringify(data));
  }
}

module.exports.startServerPTY = startServerPTY;
module.exports.updateGame = updateGame;
