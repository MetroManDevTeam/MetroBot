import { clearMetroStatusMessages } from '#metro/helpers/clearMetroStatusMessages';
import { getMetroLineStatusEmbed } from '#metro/helpers/getMetroLineStatusEmbed';
import { ErrorEmbed } from '#templates/ErrorEmbed';
import { SimpleEmbed } from '#templates/SimpleEmbed';
import { sha256hash } from '#utils/string/sha256hash';
import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ButtonInteraction } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class ButtonHandler extends InteractionHandler {
	public override async parse(interaction: ButtonInteraction<'cached'>) {
		if (interaction.customId.startsWith(`metro-updates:${this.name}`)) {
			const [_, __, channelId] = interaction.customId.split(':');

			return this.some(channelId);
		}

		return this.none();
	}

	public async run(interaction: ButtonInteraction<'cached'>, channelId: string) {
		const updatesChannel = interaction.guild.channels.cache.get(channelId);

		if (!updatesChannel) {
			interaction.update({ embeds: [new ErrorEmbed(`No se pudo encontrar el canal con la id ${channelId}`)], components: [] });
			return;
		}

		if (!updatesChannel.isSendable()) {
			interaction.update({ embeds: [new ErrorEmbed(`No se puedo envíar el mensaje al canal <#${channelId}>`)] });
			return;
		}

		/**
		 * @todo separar el estado de cada linea a su propio mensaje
		 */

		await interaction.deferUpdate();

		// Eliminar los mensajes de estado previos
		await clearMetroStatusMessages(interaction.guildId);
		const networkInfo = await this.container.metro.getNetworkInfo();

		for (const lineInfo of Object.values(networkInfo)) {
			const statusEmbed = await getMetroLineStatusEmbed(lineInfo);
			const message = await updatesChannel.send({ embeds: [statusEmbed] });
			await this.container.prisma.metroStatusMessage.create({
				data: {
					guildId: interaction.guildId,
					channelId: updatesChannel.id,
					messageId: message.id,
					line: lineInfo.id,
					infoHash: sha256hash(JSON.stringify(lineInfo))
				}
			});
		}

		interaction.editReply({
			embeds: [new SimpleEmbed(`Se estableció <#${channelId}> como canal de actualizaciones`, '✅ Configuración guardada')],
			components: []
		});
	}
}
