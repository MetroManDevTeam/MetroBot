import { container } from '@sapphire/framework';

export async function getExpressRoute(code: string) {
	const stationDetails = await container.prisma.metroStationDetails.findUnique({ where: { code } });

	return stationDetails?.expressRoute ?? null;
}
