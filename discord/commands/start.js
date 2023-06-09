const { url } = require("../../server/server.js");
const { SlashCommandBuilder } = require("discord.js");
const servers = require("../../server/server.js");
const wait = require("node:timers/promises").setTimeout;
const ws = new WebSocket(url);

const choices = Object.keys(servers.servers).map((serverName) => ({
  name: `${
    serverName === "pz"
      ? "Project Zomboid"
      : serverName.toString().charAt(0).toUpperCase() +
        serverName.toString().slice(1)
  }`,
  value: serverName,
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start a server.")
    .addStringOption((option) =>
      option
        .setName("game")
        .setDescription("The game server to start.")
        .setRequired(true)
        .addChoices(...choices)
    ),
  // check if game exists
  async execute(interaction) {
    const game = interaction.options.getString("game", true).toLowerCase();
    const game_str =
      game === "pz"
        ? "Project Zomboid"
        : game.charAt(0).toUpperCase() + game.slice(1);

    if (!(game in servers.servers)) {
      return interaction.reply(
        `There is no server for the game \`${game_str}\`!`
      );
    }

    let started = false;

    if (servers.servers[game].running === false) {
      ws.send(JSON.stringify({ type: "startStop", game: game }));
      await interaction.reply(`Starting \`${game_str}\` server...`);

      // when server is running, send confirmation message
      const intervalId = setInterval(async () => {
        if (servers.servers[game].running === true) {
          clearInterval(intervalId);
          started = true;
          return await interaction.editReply(
            `Successfully started \`${game_str}\` server!`
          );
        }
      }, 100); // Check every 100ms

      // wait 60 seconds before timeout
      await wait(60 * 1000);
      if (!started) {
        // Cleanup function in case the Promise is rejected
        const cleanup = () => clearInterval(intervalId);
        process.on("unhandledRejection", cleanup);
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
        return await interaction.editReply(
          `Could not start \`${game_str}\` server!`
        );
      }
    } else {
      return interaction.reply(`\`${game_str}\` server already running!`);
    }
  },
};
