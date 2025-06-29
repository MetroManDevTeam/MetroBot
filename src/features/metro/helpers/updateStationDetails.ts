import { container } from '@sapphire/framework';
import { MetroStationDetails } from '#metro/api/types';

export function updateStationDetails(station: MetroStationDetails) {
	return container.prisma.metroStationDetails.upsert({
		where: { code: station.code },
		create: {
			code: station.code,
			name: station.name,
			line: station.line,
			expressRoute: station.expressRoute
		},
		update: { name: station.name, line: station.line, expressRoute: station.expressRoute }
	});
}
