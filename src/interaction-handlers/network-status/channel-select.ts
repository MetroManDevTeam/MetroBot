import { getStatusChannelId } from '#metro/helpers/getStatusChannelId';
import { getStatusEmbed } from '#metro/helpers/getStatusEmbed';
import { setStatusChannelId } from '#metro/helpers/setStatusChannelId';
import { sha256hash } from '#utils/string/sha256hash';
import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuInteraction, EmbedBuilder } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.SelectMenu
})
export class MenuHandler extends InteractionHandler {
	public override async parse(interaction: ChannelSelectMenuInteraction<'cached'>) {
		if (interaction.customId === `network-status:${this.name}`) return this.some();

		return this.none();
	}

	public async run(interaction: ChannelSelectMenuInteraction<'cached'>) {
		// Revisa la existencia de un canal de actualizaciones ya establecido
		const selectedChannelId = interaction.values[0];
		const statusChannelId = await getStatusChannelId(interaction.guildId);

		// Si existe pedir confirmación al usuario para sobreescribir el canal establecido
		if (statusChannelId) {
			const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder() //
					.setCustomId(`network-status:channel-overwrite-confirm:${selectedChannelId}`) // interaction-handlers/network-status/channel-overwrite-confirm.ts
					.setLabel('Sobreescribir')
					.setStyle(ButtonStyle.Danger),
				new ButtonBuilder() //
					.setCustomId('network-status:channel-overwrite-cancel') // interaction-handlers/network-status/channel-overwrite-cancel.ts
					.setLabel('Cancelar')
					.setStyle(ButtonStyle.Primary)
			);

			interaction.update({
				embeds: [
					new EmbedBuilder() //
						.setTitle('⚠️ Advertencia')
						.setColor('Yellow')
						.setDescription(`¿Sobreescribir <#${statusChannelId}>?`)
				],
				components: [confirmRow]
			});

			return;
		}

		const statusChannel = interaction.guild.channels.cache.get(selectedChannelId);

		if (!statusChannel) {
			interaction.update({
				embeds: [
					new EmbedBuilder() //
						.setTitle('🛑 Error')
						.setColor('Red')
						.setDescription(`No se pudo encontrar el canal especificado`)
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
						.setDescription(`No puedo enviar mensajes al canal especificado`)
				]
			});
			return;
		}

		// Hacer deferUpdate en caso de que la acción tome más tiempo de lo normal
		await interaction.deferUpdate();

		// Guardar configuración a la base de datos
		await setStatusChannelId(interaction.guildId, selectedChannelId);

		// Objeto con la información sobre cada linea de la red
		const statusInfo = await this.container.metro.getNetworkInfo();

		// Recolectar todas las promesas en un array
		const promises = Object.values(statusInfo).map(async (lineInfo) => {
			const statusEmbed = await getStatusEmbed(lineInfo);
			const statusMessage = await statusChannel.send({ embeds: [statusEmbed] });

			return this.container.prisma.lineStatusMessage.create({
				data: {
					guildId: interaction.guildId,
					channelId: selectedChannelId,
					lineId: lineInfo.id,
					messageId: statusMessage.id,
					infoHash: sha256hash(JSON.stringify(lineInfo)) // Hash usado para detectar cambios en el estado de la linea (ver scheduled-tasks/network-status/update.ts)
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
