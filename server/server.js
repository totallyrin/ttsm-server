/**
 * server-side code
 */
const { readFileSync, readFile, writeFile } = require("fs");
const { join } = require("path");
const https = require("https");
const WebSocket = require("ws");
global.WebSocket = require("ws");

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

// Define the absolute path to your certificate files
const certPath = "C:\\Certbot\\live\\totallyrin.ddns.net\\";

// Load SSL certificate and private key
const serverOptions = {
  cert: readFileSync(join(certPath, "fullchain.pem")),
  key: readFileSync(join(certPath, "privkey.pem")),
  passphrase: "password",
};
// Create HTTPS server
const server = https.createServer(serverOptions);
// Create WebSocket server
const wss = new WebSocket.Server({ server });

const osu = require("node-os-utils");
const cpu = osu.cpu;
const memory = osu.mem;

const { startBot } = require("../discord/discord");
const { deploy } = require("../discord/deploy-commands");

module.exports.clients = new Set();

const {
  login,
  addUser,
  deleteUser,
  changeUsername,
  changePassword,
  editUser,
  getUsers,
} = require("./login.ts");

const Queue = require("./queue.ts");
module.exports.logs = new Queue(100);
const { startServerPTY, updateGame } = require("./serverutils");
const cpuUse = new Queue(60);
const memoryUse = new Queue(60);

const servers = require("./serverconfig").servers;

module.exports.url = "wss://localhost:2911";

/**
 * get username of client
 *
 * @param ws client
 * @returns {Promise<unknown>} returns username of client (if exists)
 */
function getUsername(ws) {
  return new Promise((resolve) => {
    ws.on("message", async (message) => {
      // get message data
      const data = JSON.parse(message);

      if (data.type === "username") {
        resolve(data.username);
      }
    });
  });
}

/**
 * helper function to get the client object based on the WebSocket object
 *
 * @param ws WebSocket of client
 * @returns {any|null}
 */
function getClient(ws) {
  for (const client of exports.clients) {
    if (client.ws === ws) {
      return client;
    }
  }
  return null;
}

/**
 * function to send server status updates for all servers
 *
 * @param ws web server for messaging
 */
function updateAll(ws) {
  // console.log('sending server status');
  for (const server in servers) {
    ws.send(
      JSON.stringify({
        type: "serverState",
        game: server,
        name: servers[server].name,
        running: servers[server].running,
      }),
    );
  }
}

function sendServerList(ws) {
  // send server list to client
  for (const game in servers) {
    ws.send(JSON.stringify({
      type: "serverList",
      game: game,
      name: servers[game].name,
    }));
  }
}

function sendConfig(ws) {
  // send configs to client
  for (const game in servers) {
    const config = servers[game].config;
    const filePath = join(
      __dirname,
      `../game_servers/${game.toString()}/${config}`,
    );
    readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      ws.send(
        JSON.stringify({
          type: "config",
          game: game.toString(),
          content: data,
        }),
      );
    });
  }
}

function sendLogs(ws) {
  for (const log of exports.logs.getItems()) {
    ws.send(
      JSON.stringify({
        type: "console",
        data: log,
      }),
    );
  }
}

// main code below
console.log("starting discord bot");
deploy();
startBot();
const secs = 10;
console.log(`unknown clients will be removed after ${secs} seconds`);

// save cpu/memory stats
setInterval(() => {
  cpu.usage().then((usage) => {
    cpuUse.add({
      time: Date.now(),
      usage: usage.toFixed(2),
    });
  });
  memory.info().then((info) => {
    const usage = ((info.usedMemMb / info.totalMemMb) * 100).toFixed(2);
    memoryUse.add({
      time: Date.now(),
      usage,
    });
  });
}, 1000); // 1 second = 1 * 1000ms

/**
 * code to run on new client connection
 */
wss.on("connection", async (ws) => {
  let username;
  Promise.race([
    getUsername(ws),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout after 5 seconds")), 5000),
    ),
  ])
    .then((user) => {
      username = user;
    })
    .catch(() => {
      username = "";
    });

  if (username && username !== "") {
    console.log(`client ${username} connected`);
  }
  exports.clients.add({ ws, username });

  // send server list to client
  sendServerList(ws);

  // send config files
  sendConfig(ws);

  // send server status to webpage
  updateAll(ws);

  // send logs to client
  sendLogs(ws);

  // start loop so that webpage status is updated
  setInterval(() => {
    updateAll(ws);
  }, 1000); // 1s = 1 * 1000ms

  // send cpu/memory stats
  setInterval(() => {
    ws.send(JSON.stringify({ type: "cpu", usage: cpuUse }));
    ws.send(JSON.stringify({ type: "memory", usage: memoryUse }));
  }, 1000); // 1 second = 1 * 1000ms

  // when message is received from client:
  ws.on("message", async (message) => {
    // get message data
    const data = JSON.parse(message);

    switch (data.type) {
      case "username":
        console.log(
          `client ${getClient(ws).username} authenticated as user ${
            data.username
          }`,
        );
        const temp = getClient(ws);
        exports.clients.delete(temp);
        exports.clients.add({ ws: ws, username: data.username });
        break;
      case "update":
        await updateGame(ws, data.game);
        break;
      case "startStop":
        await startServerPTY(ws, data.game);
        updateAll(ws);
        break;
      case "command":
        if (servers[data.game].server) {
          servers[data.game].server.write(data.command);
          servers[data.game].server.write("\r");
        }
        break;
      case "config":
        // handle saving
        const config = servers[data.game].config;
        const filePath = join(
          __dirname,
          `../game_servers/${data.game}/${config}`,
        );
        writeFile(filePath, data.content, "utf8", (err) => {
          if (err) {
            console.error(err);
            ws.send(
              JSON.stringify({
                type: "saveConfig",
                success: false,
              }),
            );
          }
          console.log(`${data.game} config saved`);
          ws.send(
            JSON.stringify({
              type: "saveConfig",
              success: true,
            }),
          );
        });
        break;
      case "login":
        // if username and password not given, throw error
        if (!(data.username && data.password)) {
          ws.send(
            JSON.stringify({
              type: "login",
              success: false,
              error: "Invalid username or password",
            }),
          );
        } else {
          await login(ws, data.username, data.password);
        }
        break;
      case "serverList":
        sendServerList(ws);
        break;
      case "addUser":
        await addUser(data.username, data.password, data.role).then(
          (result) => {
            ws.send(
              JSON.stringify({
                type: "addUser",
                username: data.username,
                role: data.role,
                success: result,
              }),
            );
          },
        );
        break;
      case "change":
        let result = false;
        if (data.property === "username") {
          result = await changeUsername(data.username, data.new, data.password);
        } else {
          result = await changePassword(data.username, data.password, data.new);
        }
        ws.send(JSON.stringify({ type: "saveUser", success: result }));
        break;
      case "delUser":
        await deleteUser(data.username).then((result) => {
          ws.send(
            JSON.stringify({
              type: "delUser",
              username: data.username,
              role: data.role,
              success: result,
            }),
          );
        });
        break;
      case "editUser":
        await editUser(data.username, data.role).then((result) => {
          ws.send(
            JSON.stringify({
              type: "editUser",
              username: data.username,
              role: data.role,
              success: result,
            }),
          );
        });
        break;
      case "users":
        await getUsers().then((users) => {
          ws.send(
            JSON.stringify({
              type: "users",
              users: users,
            }),
          );
        });
        break;
    }
  });

  ws.on("close", () => {
    let temp = getClient(ws);
    exports.clients.delete(temp);
    if (username && username !== "") {
      console.log(`client ${username} disconnected`);
    }
  });
});

server.listen(2911, () => {
  console.log("Secure WebSocket server listening on port 2911");
});
