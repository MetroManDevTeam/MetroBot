import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, Message } from 'discord.js';

@ApplyOptions<Subcommand.Options>({
	description: 'Comandos de configuracion para MetroBot',
	runIn: ['GUILD_TEXT'],
	preconditions: ['OwnerOnly'],
	subcommands: [
		{
			type: 'group',
			name: 'channel',
			entries: [{ name: 'metroupdates', messageRun: 'metroupdates' }]
		}
	]
})
export class UserCommand extends Subcommand {
	public async metroupdates(message: Message) {
		if (!message.channel.isSendable()) {
			return;
		}

		const channelSelectionRow = new ActionRowBuilder<ChannelSelectMenuBuilder>() //
			.addComponents(
				new ChannelSelectMenuBuilder()
					.setCustomId('network-status:channel-select') // interaction-handlers/network-status/channel-select.ts
					.setPlaceholder('Selecciona un canal de la lista')
					.addChannelTypes(ChannelType.GuildText)
			);

		message.channel.send({
			embeds: [
				new EmbedBuilder() //
					.setTitle('⚙️ Canal de Actualizaciones (Metro)')
					.setDescription('Configura un canal de actualizaciones de red')
			],
			components: [channelSelectionRow]
		});
	}
}
