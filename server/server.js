// noinspection JSUnusedLocalSymbols

/**
 * server-side code
 */
const {spawn} = require("child_process");
const {exec} = require("child_process");

const { readFileSync, readFile, writeFile } = require("fs");
const https = require("https");
const WebSocket = require("ws");
// const wss = new WebSocket.Server({port: 2911});
global.WebSocket = require("ws");

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
// Load SSL certificate and private key
const serverOptions = {
  cert: readFileSync("certs/fullchain.pem"),
  key: readFileSync("certs/privkey.pem"),
  passphrase: 'password'
};
// Create HTTPS server
const server = https.createServer(serverOptions);
// Create WebSocket server
const wss = new WebSocket.Server({ server });

const osu = require("node-os-utils");
const cpu = osu.cpu;
const memory = osu.mem;

const os = require("os");
const pty = require("node-pty");
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

const {startBot} = require("../discord/discord.js");
const {deploy} = require("../discord/deploy-commands");

const clients = new Set();


const {join} = require("path");
const {
    login,
    addUser,
    deleteUser,
    changeUsername,
    changePassword,
    editUser,
} = require("./login.ts");

const Queue = require("./queue.ts");
const logs = new Queue(100);
const cpuUse = new Queue(60);
const memoryUse = new Queue(60);

let minecraft = {
    server: undefined,
    running: false,
    config: "server.properties",
};

let terraria = {
    server: undefined,
    running: false,
    config: "serverconfig.txt",
};

let valheim = {
    server: undefined,
    running: false,
    // TODO: update config file path
    config: "test.txt",
};

let pz = {
    server: undefined,
    running: false,
    // TODO: update config file path
    config: "test.txt",
};

exports.servers = {
    minecraft: minecraft,
    terraria: terraria,
    valheim: valheim,
    pz: pz,
};

exports.url = "wss://localhost:2911";

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
    for (const client of clients) {
        if (client.ws === ws) {
            return client;
        }
    }
    return null;
}

/**
 * function to kill all foreign game servers
 *
 * @returns {Promise<void>}
 */
async function killAll() {
    for (const game in exports.servers) {
        await killServer(game);
    }
}

/**
 * function to kill a given foreign game server
 *
 * @param game
 * @returns {Promise<void>}
 */
function killServer(game) {
    return new Promise((resolve, reject) => {
        switch (game) {
            // java-based servers
            case "pz":
            case "minecraft":
                // Find the process ID of the Minecraft server
                exec('tasklist | find "java.exe"', (error, stdout) => {
                    if (error) {
                        // console.error(`exec error: ${error}`);
                        console.error(`could not find any unknown ${game} servers`);
                        // reject(error);
                        resolve();
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

                        console.log("unknown servers killed");
                        resolve();
                    });
                });
                break;
            case "valheim":
            case "terraria":
                // Find the process ID of the Minecraft server
                exec(
                    `tasklist | find "${
                        game.charAt(0).toUpperCase() + game.slice(1)
                    }Server.exe"`,
                    (error, stdout) => {
                        if (error) {
                            // console.error(`exec error: ${error}`);
                            console.error(`could not find any unknown ${game} servers`);
                            // reject(error);
                            resolve();
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

                            console.log("unknown servers killed");
                            resolve();
                        });
                    }
                );
                break;
        }
    });
}

/**
 * function to start a server
 *
 * @param ws websocket to send status updates over
 * @param game server to start
 * @param cmd start command
 * @param args start arguments
 * @param stop stop command
 * @param online online confirmation phrase
 * @param offline offline confirmation phrase
 * @returns {Promise<void>}
 */
// async function startServer(ws, game, cmd, args, stop, online, offline) {
//     // if server is running, send stop command
//     if (exports.servers[game].running) {
//         console.log(`attempting to stop ${game} server`);
//         try {
//             exports.servers[game].server.stdin.write(stop);
//         } catch (e) {
//             console.log(`could not stop ${game} server safely; attempting to kill`);
//             try {
//                 exports.servers[game].server.kill();
//             } catch (e) {
//                 console.log(`could not kill ${game} server`);
//             }
//         }
//     }
//     // if server is not running,
//     else {
//         updateStatus(ws, game, "pinging");
//
//         // kill unknown servers
//         await killServer(game);
//
//         console.log(`starting game server`);
//         // start a new server
//         process.chdir(`game_servers\\${game}`);
//         exports.servers[game].server = spawn(cmd, args);
//         process.chdir("..\\..");
//
//         exports.servers[game].server.stdout.on("data", (data) => {
//             if (typeof data !== "string") return;
//             console.log(
//                 `${game.charAt(0).toUpperCase() + game.slice(1)} server: ${data
//                     .toString()
//                     .trim()}`
//             );
//             if (data !== ("" || "\n" || "\r")) {
//                 console.log(
//                     `${game.charAt(0).toUpperCase() + game.slice(1)} server: ${data
//                         .toString()
//                         .trim()}`
//                 );
//                 if (data.includes(online)) updateStatus(ws, game, true);
//                 if (data.includes(offline)) updateStatus(ws, game, "pinging");
//                 // ws.send(JSON.stringify(`${game.charAt(0).toUpperCase() + game.slice(1)} server: ${data.toString().trim()}\n`));
//                 sendAll({
//                     type: "console",
//                     data: `${game.charAt(0).toUpperCase() + game.slice(1)} server: ${data
//                         .toString()
//                         .trim()}\n`,
//                 });
//             }
//         });
//
//         exports.servers[game].server.stderr.on("data", (data) => {
//             if (typeof data !== "string") return;
//             console.error(
//                 `${game.charAt(0).toUpperCase() + game.slice(1)} server: ${data.trim()}`
//             );
//             ws.send(
//                 JSON.stringify(
//                     `${
//                         game.charAt(0).toUpperCase() + game.slice(1)
//                     } server: ${data.trim()}\n`
//                 )
//             );
//         });
//
//         exports.servers[game].server.on("close", (code) => {
//             console.log(
//                 `${
//                     game.charAt(0).toUpperCase() + game.slice(1)
//                 } server exited with code ${code}`
//             );
//             sendAll({
//                 type: "console",
//                 data: `${
//                     game.charAt(0).toUpperCase() + game.slice(1)
//                 } server exited with code ${code}`,
//             });
//             updateStatus(ws, game, false);
//         });
//     }
// }

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
    // if server is running, send stop command
    if (exports.servers[game].running) {
        console.log(`attempting to stop ${game} server`);
        try {
            exports.servers[game].server.write(stop);
        } catch (e) {
            console.log(`could not stop ${game} server safely; attempting to kill`);
            try {
                exports.servers[game].server.kill();
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
        exports.servers[game].server = pty.spawn(shell, args, {
            name: `${
                game === "pz" ? "PZ" : game.charAt(0).toUpperCase() + game.slice(1)
            }Server`,
            cwd: process.env.PWD,
            env: process.env,
            cols: 1000,
        });
        process.chdir("..\\..");

        exports.servers[game].server.onData((data) => {
            if (typeof data !== "string") return;
            if (!data.includes("[K")) {
                const log = `${
                      game === "pz" ? "PZ" : game.charAt(0).toUpperCase() + game.slice(1)
                } server: ${data.trim()}`
                if (data.includes(online)) {
                    console.log(`${game} server started`);
                    updateStatus(ws, game, true);
                }
                if (data.includes(offline)) {
                    updateStatus(ws, game, "pinging");
                }
                if (data.includes("Terminate batch job (Y/N)?")) {
                    exports.servers[game].server.write("Y");
                    updateStatus(ws, game, false);
                }
                sendAll({
                    type: "console",
                    data: log,
                });
                logs.add(log);
            }
        });

        exports.servers[game].server.onExit((data) => {
            console.log(
                `${game} server exited with code ${data.exitCode}`
            );
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

/**
 * function to send server status updates for all servers
 *
 * @param ws web server for messaging
 */
function updateAll(ws) {
    // console.log('sending server status');
    for (const server in exports.servers) {
        ws.send(
            JSON.stringify({
                type: "serverState",
                game: server,
                running: exports.servers[server].running,
            })
        );
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
    exports.servers[game].running = status;
    ws.send(
        JSON.stringify({
            type: "serverState",
            game: game,
            running: exports.servers[game].running,
        })
    );
}

function sendAll(data) {
    for (const client of clients) {
        const ws = client.ws;
        ws.send(JSON.stringify(data));
    }
}

function sendServerList(ws) {
    // send server list to client
    for (const game in exports.servers) {
        ws.send(JSON.stringify({type: "serverList", name: game.toString()}));
    }
}

function closeUnknownConnection(ws, secs) {
    setTimeout(async () => {
        console.log("attempting to close unknown connection");
        const client = getClient(ws);
        if (client && (!client.username || client.username === "")) {
            await ws.send(
                JSON.stringify({type: "debug", msg: "connection closing"})
            );
            console.log(`closing connection with client ${client.username}`);
            client.ws.close(1000, "Empty username");
            clients.delete(client);
            console.log("unknown client disconnected");
        }
        // sendAll({type: 'debug', msg: 'pinging connection'});
    }, secs * 1000);
}

function sendConfig(ws) {
    // send configs to client
    for (const game in exports.servers) {
        const config = exports.servers[game].config;
        const filePath = join(
            __dirname,
            `../game_servers/${game.toString()}/${config}`
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
                    content: data
                })
            );
        });
    }
}

function sendLogs(ws) {
    for (const log of logs.getItems()) {
        ws.send(
            JSON.stringify({
                type: "console",
                data: log,
            })
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
            usage: usage.toFixed(2)
        });
    });
    memory.info().then((info) => {
        const usage = ((info.usedMemMb / info.totalMemMb) * 100).toFixed(2);
        memoryUse.add({
            time: Date.now(),
            usage
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
            setTimeout(() => reject(new Error("Timeout after 5 seconds")), 5000)
        ),
    ])
        .then((user) => {
            username = user;
        })
        .catch(() => {
            username = "";
        });

    // const username = await getUsername(ws);
    if (username && username !== "") {
        console.log(`client ${username} connected`);
    } else {
        console.log("unknown client connected");
        // closeUnknownConnection(ws, secs);
    }
    clients.add({ws, username});
    // const client = getClient(ws);

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
        // console.log(`updating client ${username}`);
        updateAll(ws);
    }, 1000); // 1s = 1 * 1000ms

    // send cpu/memory stats
    setInterval(() => {
        // cpu.usage().then((usage) => {
        //     ws.send(JSON.stringify({type: "cpu", usage: usage.toFixed(2)}));
        // });
        // memory.info().then((info) => {
        //     const usage = ((info.usedMemMb / info.totalMemMb) * 100).toFixed(2);
        //     ws.send(JSON.stringify({type: "memory", usage: usage}));
        // });
        ws.send(JSON.stringify({type: "cpu", usage: cpuUse}));
        ws.send(JSON.stringify({type: "memory", usage: memoryUse}));
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
                    }`
                );
                const temp = getClient(ws);
                clients.delete(temp);
                clients.add({ws: ws, username: data.username});
                break;
            case "startStop":
                switch (data.game) {
                    case "minecraft":
                        // await startServer(ws, data.game, 'java', ['-Xmx1024M', '-Xms1024M', '-jar', 'server.jar', 'nogui'], '/stop\n', 'Done', 'Stopping the server');
                        await startServerPTY(
                            ws,
                            data.game,
                            [".\\start-server.bat"],
                            "stop\r",
                            "Done",
                            "Stopping the server"
                        );
                        break;
                    case "terraria":
                        await startServerPTY(
                            ws,
                            data.game,
                            [".\\start-server.bat"],
                            "exit\r",
                            "Server started",
                            "Saving before exit..."
                        );
                        break;
                    case "valheim":
                        await startServerPTY(
                            ws,
                            data.game,
                            [".\\start-server.bat"],
                            "\x03",
                            "Game server connected",
                            "World save writing"
                        );
                        break;
                    case "pz":
                        await startServerPTY(
                            ws,
                            data.game,
                            [".\\start-server.bat"],
                            "quit\r",
                            "Server Steam ID",
                            "QuitCommand"
                        );
                        break;
                }
                updateAll(ws);
                break;
            case "command":
                if (exports.servers[data.game].server) {
                    exports.servers[data.game].server.write(data.command);
                    exports.servers[data.game].server.write("\r");
                }
                break;
            case "config":
                // handle saving
                const config = exports.servers[data.game].config;
                const filePath = join(
                    __dirname,
                    `../game_servers/${data.game}/${config}`
                );
                writeFile(filePath, data.content, "utf8", (err) => {
                    if (err) {
                        console.error(err);
                        ws.send(JSON.stringify({
                            type: "saveConfig",
                            success: false
                        }));
                    }
                    console.log(`${data.game} config saved`);
                    ws.send(JSON.stringify({
                        type: "saveConfig",
                        success: true
                    }));
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
                        })
                    );
                } else {
                    await login(ws, data.username, data.password);
                }
                break;
            case "serverList":
                sendServerList(ws);
                break;
            case "addUser":
                const addResult = await addUser(
                    data.username,
                    data.password,
                    data.role
                );
                ws.send(
                    JSON.stringify({
                        type: "addUser",
                        username: data.username,
                        success: addResult,
                    })
                );
                break;
            case "change":
                let result = false;
                if (data.property === "username") {
                    result = await changeUsername(data.username, data.new, data.password);
                } else {
                    result = await changePassword(data.username, data.password, data.new);
                }
                ws.send(JSON.stringify({type: "saveUser", success: result}));
                break;
            case "delUser":
                const delResult = await deleteUser(data.username);
                ws.send(
                    JSON.stringify({
                        type: "delUser",
                        username: data.username,
                        success: delResult,
                    })
                );
                break;
            case "editUser":
                const editResult = await editUser(data.username, data.role);
                ws.send(
                    JSON.stringify({
                        type: "editUser",
                        username: data.username,
                        success: editResult,
                    })
                );
                break;
        }
    });

    ws.on("close", () => {
        let temp = getClient(ws);
        clients.delete(temp);
        if (username && username !== "") {
            console.log(`client ${username} disconnected`);
        } else {
            console.log("unknown client disconnected");
        }
    });
});

server.listen(2911, () => {
  console.log("Secure WebSocket server listening on port 2911");
});
