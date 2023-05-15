
const { SlashCommandBuilder } = require('discord.js');
const servers = require('..\\..\\server\\server.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server-status')
        .setDescription('Displays current server statuses'),
    async execute(interaction) {
        let data = '';
        for (const server in servers.servers) {
            data += `\n${(server === 'pz' ? 'Project Zomboid' : server.charAt(0).toUpperCase() + server.slice(1)).padEnd(15, ' ')} : ${servers.servers[server].running ? 'online' : 'offline'}`;
        }
        await interaction.reply('\`\`\`SERVER STATUSES :' + data + '\`\`\`');
    },
};


