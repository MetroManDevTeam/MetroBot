import { container } from '@sapphire/framework';

export function getStatusChannelId(guildId: string) {
	return container.prisma.guildConfig.findUnique({ where: { guildId } }).then((data) => data?.metroNetworkStatusChannelId ?? null);
}
