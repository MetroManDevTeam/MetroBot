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
		/**
		 * @todo guardar detalles sobre estaciones en db periodicamente
		 */
	}
}
