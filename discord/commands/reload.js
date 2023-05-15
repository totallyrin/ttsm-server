
const { SlashCommandBuilder } = require('discord.js');

const path = require("path");
const fs = require("fs");

function getCommandChoices() {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    return commandFiles.map(file => {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Check if command has a name and description property
        if ('data' in command && 'execute' in command && command.data.name && command.data.description) {
            return {
                name: command.data.name,
                value: command.data.name
            };
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            return null;
        }
    }).filter(choice => choice !== null);
}

const choices = getCommandChoices();

module.exports = {
  data: new SlashCommandBuilder()
      .setName('reload')
      .setDescription('Reloads a command.')
      .addStringOption(option =>
          option.setName('command')
              .setDescription('The command to reload.')
              .setRequired(true)
              .addChoices(...choices)),
    // check if command exists
    async execute(interaction) {
        const commandName = interaction.options.getString('command', true).toLowerCase();
        const command = interaction.client.commands.get(commandName);

        if (!command) {
            return interaction.reply(`There is no command with name \`${commandName}\`!`);
        }

        // build correct file path
        delete require.cache[require.resolve(`./${command.data.name}.js`)];

        try {
            await interaction.client.commands.delete(command.data.name);
            const newCommand = require(`./${command.data.name}.js`);
            await interaction.client.commands.set(newCommand.data.name, newCommand);
            await interaction.reply(`Command \`${newCommand.data.name}\` was reloaded.`);
        }
        catch (error) {
            console.error(error);
            await interaction.reply(`There was an error while reloading a command \`${command.data.name}\`:\n\`${error.message}\``);
        }

    },
};