import { container } from '@sapphire/framework';

export function setStatusChannelId(guildId: string, metroNetworkStatusChannelId: string) {
	return container.prisma.guildConfig.upsert({
		where: { guildId },
		create: { guildId, metroNetworkStatusChannelId },
		update: { metroNetworkStatusChannelId }
	});
}
