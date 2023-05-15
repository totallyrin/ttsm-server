const {url} = require('..\\..\\server\\server.js');
const { SlashCommandBuilder } = require('discord.js');
const servers = require('..\\..\\server\\server.js');
const wait = require('node:timers/promises').setTimeout;
const ws = new WebSocket(url);

const choices = Object.keys(servers.servers).map(serverName => ({
    name: `${serverName === 'pz' ? 'Project Zomboid' : serverName.toString().charAt(0).toUpperCase() + serverName.toString().slice(1)}`,
    value: serverName
}));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('console')
        .setDescription('Display the console.')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game console to display.')
                .setRequired(false)
                .addChoices(...choices)),
    // check if game exists
    async execute(interaction) {
        const game = interaction.options.getString('game', true).toLowerCase() ?? 'No game specified';

        // if game specified
        if (game !== 'No game specified') {
            const game_str = game.charAt(0).toUpperCase() + game.slice(1);

            if (!(game in servers.servers)) {
                return interaction.reply(`There is no server for the game \`${game_str}\`!`);
            }

            if (servers.servers[game].running === true) {
                ws.send(JSON.stringify({type: 'console', enabled: true}));
                await interaction.reply(`\`\`\`${'do nothing'}\`\`\``);
            } else {
                return interaction.reply(`Running \`${game_str}\` server not found!`);
            }
        }
        // no game specified
        else {

        }
    }
};