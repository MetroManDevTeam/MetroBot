import { getMetroLineStatusEmbed } from '#metro/helpers/getMetroLineStatusEmbed';
import { getMetroUpdatesMessages } from '#metro/helpers/getMetroUpdatesMessages';
import { sha256hash } from '#utils/string/sha256hash';
import { ApplyOptions } from '@sapphire/decorators';
import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { Time } from '@sapphire/time-utilities';

@ApplyOptions<ScheduledTask.Options>({
	interval: Time.Minute * 5
})
export class UserTask extends ScheduledTask {
	public override async run() {
		const statusMessages = await getMetroUpdatesMessages();
		const networkInfo = await this.container.metro.getNetworkInfo();

		// Necesario para evitar actualizar los mensajes antes de que discord.js esté listo
		if (!this.container.client.isReady()) {
			this.container.logger.warn(`[MetroStatusUpdates] El cliente no se encuentra listo, reintentando en ${this.interval}ms`);
			return;
		}

		// No actualizar si metro no está operando
		if (!this.container.metro.isOperating()) return;

		for (const statusMessage of statusMessages) {
			// Revisar si el hash de la base de datos es igual al de la API de Metro
			const lineInfo = networkInfo[statusMessage.lineId];
			const currentInfoHash = sha256hash(JSON.stringify(lineInfo));

			// Si son iguales, no actualizar el mensaje
			if (statusMessage.infoHash === currentInfoHash) continue;

			this.container.logger.debug(
				`[MetroStatusUpdates] Se detectaron cambios en el estado de la línea ${statusMessage.lineId}, actualizando...`
			);

			// Si los hashes son distintos, actualizar el mensaje
			await this.container.prisma.metroStatusMessage.update({
				where: { messageId: statusMessage.messageId },
				data: { infoHash: currentInfoHash }
			});

			const updatesChannel = this.container.client.channels.cache.get(statusMessage.channelId);

			if (!updatesChannel) {
				this.container.logger.debug(
					`[MetroStatusUpdates] No se pudo encontrar el canal de actualizaciones con la id ${statusMessage.channelId}`
				);
				continue;
			}

			if (!updatesChannel.isSendable()) {
				this.container.logger.debug(
					`[MetroStatusUpdates] No se pudieron recuperar los mensajes del canal con la id ${statusMessage.channelId}`
				);
				continue;
			}

			const updateMessage = await updatesChannel.messages.fetch(statusMessage.messageId);

			if (!updateMessage) {
				this.container.logger.debug(
					`[MetroStatusUpdates] No se pudo encontrar el mensaje con la id ${statusMessage.messageId} correspondiente al estado de ${statusMessage.lineId}`
				);
				continue;
			}

			await updateMessage.edit({ embeds: [await getMetroLineStatusEmbed(lineInfo)] });

			this.container.logger.debug(`[MetroStatusUpdates] Se actualizó el estado de ${statusMessage.lineId} correctamente`);
		}
	}
}
