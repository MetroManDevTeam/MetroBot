import { Time } from '@sapphire/time-utilities';
import { ApplyOptions } from '@sapphire/decorators';
import { sha256hash } from '#utils/string/sha256hash';
import { getStatusEmbed } from '#metro/helpers/getStatusEmbed';
import { getStatusMessages } from '#metro/helpers/getStatusMessages';
import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';

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
		const lineStatusMessages = await getStatusMessages();

		const networkInfo = await this.container.metro.getMetroNetworkStatus();

		for (const lineStatusMessage of lineStatusMessages) {
			// Revisar si el hash de la base de datos es igual al de la API de Metro
			const statusInfo = networkInfo[lineStatusMessage.line];
			const currentInfoHash = sha256hash(JSON.stringify(statusInfo));

			//console.log(statusInfo);

			// Si son iguales, no actualizar el mensaje
			if (lineStatusMessage.infoHash === currentInfoHash) continue;

			this.container.logger.debug(
				`[MetroStatusUpdates] Se detectaron cambios en el estado de la línea ${lineStatusMessage.line}, actualizando...`
			);

			// Si los hashes son distintos, actualizar el mensaje
			await this.container.prisma.metroLineStatusMessage.update({
				where: { messageId: lineStatusMessage.messageId },
				data: { infoHash: currentInfoHash }
			});

			// Canal especificado en la db
			const updatesChannel = this.container.client.channels.cache.get(lineStatusMessage.channelId);

			if (!updatesChannel) {
				this.container.logger.debug(
					`[MetroStatusUpdates] No se pudo encontrar el canal de actualizaciones con la id ${lineStatusMessage.channelId}`
				);
				continue;
			}

			if (!updatesChannel.isSendable()) {
				this.container.logger.debug(
					`[MetroStatusUpdates] No se pudieron recuperar los mensajes del canal con la id ${lineStatusMessage.channelId}`
				);
				continue;
			}

			// Mensaje especificado en la db
			const statusMessage = await updatesChannel.messages.fetch(lineStatusMessage.messageId);

			if (!statusMessage) {
				this.container.logger.debug(
					`[MetroStatusUpdates] No se pudo encontrar el mensaje con la id ${lineStatusMessage.messageId} correspondiente al estado de ${lineStatusMessage.line}`
				);
				continue;
			}

			await statusMessage.edit({ embeds: [await getStatusEmbed(statusInfo)] });

			this.container.logger.debug(`[MetroStatusUpdates] Se actualizó el estado de ${lineStatusMessage.line} correctamente`);
		}
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		'network-status-update': never;
	}
}
