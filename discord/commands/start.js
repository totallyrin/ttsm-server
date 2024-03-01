const { url } = require("../../server/server.js");
const { SlashCommandBuilder } = require("discord.js");
const servers = require("../../server/serverconfig.js").servers;
const wait = require("node:timers/promises").setTimeout;
const ws = new WebSocket(url);

const choices = Object.keys(servers).map((serverName) => ({
  name: servers[serverName].name,
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

    if (!(game in servers)) {
      return interaction.reply(
        `There is no server for the game \`${servers[game].name}\`!`
      );
    }

    let started = false;

    if (servers[game].running === false) {
      ws.send(JSON.stringify({ type: "startStop", game: game }));
      await interaction.reply(`Starting \`${servers[game].name}\` server...`);

      // when server is running, send confirmation message
      const intervalId = setInterval(async () => {
        if (servers[game].running === true) {
          clearInterval(intervalId);
          started = true;
          return await interaction.editReply(
            `Successfully started \`${servers[game].name}\` server!`
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
          `Could not start \`${servers[game].name}\` server!`
        );
      }
    } else {
      return interaction.reply(`\`${servers[game].name}\` server already running!`);
    }
  },
};
