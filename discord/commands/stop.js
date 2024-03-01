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
    .setName("stop")
    .setDescription("Stops a server.")
    .addStringOption((option) =>
      option
        .setName("game")
        .setDescription("The game server to stop.")
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

    if (servers[game].running === true) {
      ws.send(JSON.stringify({ type: "startStop", game: game }));
      await interaction.reply(`Stopping \`${servers[game].name}\` server...`);

      let stopped = false;

      // when server is running, send confirmation message
      const intervalId = setInterval(async () => {
        if (servers[game].running === false) {
          clearInterval(intervalId);
          stopped = true;
          return await interaction.editReply(
            `Successfully stopped \`${servers[game].name}\` server!`
          );
        }
      }, 100); // Check every 100ms

      // wait 60 seconds before timeout
      await wait(60 * 1000);
      if (!stopped) {
        // Cleanup function in case the Promise is rejected
        const cleanup = () => clearInterval(intervalId);
        process.on("unhandledRejection", cleanup);
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
        return await interaction.editReply(
          `Could not stop \`${servers[game].name}\` server!`
        );
      }
    } else {
      return interaction.reply(`Running \`${servers[game].name}\` server not found!`);
    }
  },
};
