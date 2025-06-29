import { sha256hash } from '#utils/string/sha256hash';
import { getStatusEmbed } from '#metro/helpers/getStatusEmbed';
import { clearStatusMessages } from '#metro/helpers/clearStatusMessages';
import { ApplyOptions } from '@sapphire/decorators';
import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class ButtonHandler extends InteractionHandler {
	public override async parse(interaction: ButtonInteraction<'cached'>) {
		if (interaction.customId.startsWith(`network-status:${this.name}`)) {
			const [_, __, selectedChannelId] = interaction.customId.split(':');

			return this.some(selectedChannelId);
		}

		return this.none();
	}

	public async run(interaction: ButtonInteraction<'cached'>, selectedChannelId: string) {
		const statusChannel = interaction.guild.channels.cache.get(selectedChannelId);

		if (!statusChannel) {
			interaction.update({
				embeds: [
					new EmbedBuilder() //
						.setTitle('🛑 Error')
						.setColor('Red')
						.setDescription(`No se pudo encontrar el canal con la id ${selectedChannelId}`)
				],
				components: []
			});
			return;
		}

		if (!statusChannel.isSendable()) {
			interaction.update({
				embeds: [
					new EmbedBuilder() //
						.setTitle('🛑 Error')
						.setColor('Red')
						.setDescription(`No puedo enviar mensajes al canal ${selectedChannelId}`)
				]
			});
			return;
		}

		// Hacer deferUpdate en caso de que la acción tome más tiempo de lo normal
		await interaction.deferUpdate();

		// Borrar mensajes de estado previos
		await clearStatusMessages(interaction.guildId);

		// Objeto con la información sobre cada linea de la red
		const statusInfo = await this.container.metro.getMetroNetworkStatus();

		// Recolectar todas las promesas en un array
		const promises = Object.values(statusInfo).map(async (lineInfo) => {
			const statusEmbed = await getStatusEmbed(lineInfo);
			const statusMessage = await statusChannel.send({ embeds: [statusEmbed] });

			return this.container.prisma.metroLineStatusMessage.create({
				data: {
					guildId: interaction.guildId,
					channelId: selectedChannelId,
					line: lineInfo.line,
					messageId: statusMessage.id,
					infoHash: sha256hash(JSON.stringify(lineInfo)) // Hash usado para detectar cambios en el estado de la linea (ver scheduled-tasks/network-status-update.ts)
				}
			});
		});

		// Resolver todas las promesas
		await Promise.all(promises);

		interaction.editReply({
			embeds: [
				new EmbedBuilder() //
					.setTitle('✅ Configuración guardada')
					.setColor('Green')
					.setDescription(`Se estableció <#${selectedChannelId}> como canal de estado`)
			],
			components: []
		});
	}
}
