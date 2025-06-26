import { getStatusEmbed } from '#metro/helpers/getStatusEmbed';
import { getStatusMessages } from '#metro/helpers/getStatusMessages';
import { sha256hash } from '#utils/string/sha256hash';
import { ApplyOptions } from '@sapphire/decorators';
import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { Time } from '@sapphire/time-utilities';

/**
 * Tarea para actualizar mensajes con el estado actual de la red
 * Refresh: cada 5 minutos
 */
@ApplyOptions<ScheduledTask.Options>({
	interval: 5 * Time.Minute
})
export class UserTask extends ScheduledTask {
	public override async run() {
		// Necesario para evitar actualizar los mensajes antes de que discord.js esté listo
		if (!this.container.client.isReady()) {
			this.container.logger.warn(`[MetroStatusUpdates] El cliente no se encuentra listo, reintentando en ${this.interval}ms`);
			return;
		}

		/**
		 * @todo No actualizar mensajes si metro no está operando, pero también permitiendo
		 * reflejar el cierre de la red en los embeds de estado ya que la lógica anterior no
		 * permitía hacerlo
		 */

		// Recuperar mensajes de estado de la db
		const messagesData = await getStatusMessages();

		const networkInfo = await this.container.metro.getMetroNetworkStatus();

		for (const messageData of messagesData) {
			// Revisar si el hash de la base de datos es igual al de la API de Metro
			const statusInfo = networkInfo[messageData.lineId];
			const currentInfoHash = sha256hash(JSON.stringify(statusInfo));

			// Si son iguales, no actualizar el mensaje
			if (messageData.infoHash === currentInfoHash) continue;

			this.container.logger.debug(`[MetroStatusUpdates] Se detectaron cambios en el estado de la línea ${messageData.lineId}, actualizando...`);

			// Si los hashes son distintos, actualizar el mensaje
			await this.container.prisma.lineStatusMessage.update({
				where: { messageId: messageData.messageId },
				data: { infoHash: currentInfoHash }
			});

			// Canal especificado en la db
			const updatesChannel = this.container.client.channels.cache.get(messageData.channelId);

			if (!updatesChannel) {
				this.container.logger.debug(
					`[MetroStatusUpdates] No se pudo encontrar el canal de actualizaciones con la id ${messageData.channelId}`
				);
				continue;
			}

			if (!updatesChannel.isSendable()) {
				this.container.logger.debug(
					`[MetroStatusUpdates] No se pudieron recuperar los mensajes del canal con la id ${messageData.channelId}`
				);
				continue;
			}

			// Mensaje especificado en la db
			const statusMessage = await updatesChannel.messages.fetch(messageData.messageId);

			if (!statusMessage) {
				this.container.logger.debug(
					`[MetroStatusUpdates] No se pudo encontrar el mensaje con la id ${messageData.messageId} correspondiente al estado de ${messageData.lineId}`
				);
				continue;
			}

			await statusMessage.edit({ embeds: [await getStatusEmbed(statusInfo)] });

			this.container.logger.debug(`[MetroStatusUpdates] Se actualizó el estado de ${messageData.lineId} correctamente`);
		}
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		'network-status-update': never;
	}
}
