let minecraft = {
  name: "Minecraft",
  server: undefined,
  running: false,
  config: "server.properties",
  args: [".\\start-server.bat"],
  stop: "stop\r",
  online: "Done",
  offline: "Stopping the server",
};

let terraria = {
  name: "Terraria",
  server: undefined,
  running: false,
  config: "serverconfig.txt",
  args: [".\\start-server.bat"],
  stop: "exit\r",
  online: "Server started",
  offline: "Saving before exit...",
};

let valheim = {
  name: "Valheim",
  server: undefined,
  running: false,
  config: "start-server.bat",
  args: [".\\start-server.bat"],
  stop: "\x03",
  online: "Game server connected",
  offline: "Net scene destroyed",
};

let pz = {
  name: "Project Zomboid",
  server: undefined,
  running: false,
  config: "Zomboid\\Server\\servertest.ini",
  args: [".\\start-server.bat"],
  stop: "quit\r",
  online: "Server Steam ID",
  offline: "Shutting down Steam Game Server",
};

let redm = {
  name: "RedM",
  server: undefined,
  running: false,
  config: "txData\\VORPCore\\server.cfg",
  args: [".\\start-server.bat"],
  stop: "quit\r",
  online: "",
  offline: "",
};

module.exports.servers = {
  minecraft: minecraft,
  terraria: terraria,
  valheim: valheim,
  pz: pz,
  redm: redm,
};
