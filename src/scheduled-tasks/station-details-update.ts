import { Time } from '@sapphire/time-utilities';
import { sleep } from '#utils/promise/sleep';
import { ApplyOptions } from '@sapphire/decorators';
import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';

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
		const promises = [];

		for (const line of Object.values(statusInfo)) {
			for (const station of line.stations) {
				await sleep(Time.Second);

				this.container.logger.info(`[MetroStationDetials] Actualizando datos de la estación ${station.name}[${station.code}]`);

				const stationData = await this.container.metro.getMetroStationDetails(station.code);

				const promise = this.container.prisma.metroStationDetails.upsert({
					where: { code: stationData.code },
					create: {
						code: stationData.code,
						name: stationData.name,
						line: stationData.line,
						expressRoute: stationData.expressRoute
					},
					update: { name: stationData.name, line: stationData.line, expressRoute: stationData.expressRoute }
				});

				promises.push(promise);
			}
		}

		await Promise.all(promises);

		this.container.logger.info('[MetroStationDetials] Datos actualizados correctamente');
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		'station-details-update': never;
	}
}
