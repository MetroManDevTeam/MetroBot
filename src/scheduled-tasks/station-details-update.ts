import { Time } from '@sapphire/time-utilities';
import { sleep } from '#utils/promise/sleep';
import { ApplyOptions } from '@sapphire/decorators';
import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { updateStationDetails } from '#metro/helpers/updateStationDetails';

/**
 * Actualiza detalles de cada estación de la red
 * Refresh: El primero de cada mes a las 00:00 hrs
 */
@ApplyOptions<ScheduledTask.Options>({
	pattern: '0 0 1 * *'
})
export class UserTask extends ScheduledTask {
	public override async run() {
		this.container.logger.info('[MetroStationDetials] Actualizando datos...');

		const statusInfo = await this.container.metro.getMetroNetworkStatus();
		const stationCodes = Object.values(statusInfo).flatMap((line) => line.stations.map((station) => station.code));

		for (const stationCode of stationCodes) {
			const station = await this.container.metro.getMetroStationDetails(stationCode);
			this.container.logger.info(`[MetroStationDetails] Actualizando datos de la estación ${station.name}[${station.code}]`);
			await updateStationDetails(station);
			await sleep(Time.Second);
		}

		this.container.logger.info('[MetroStationDetails] Datos actualizados correctamente');
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		'station-details-update': never;
	}
}
