import { container } from '@sapphire/framework';

export function setStatusChannelId(guildId: string, metroNWUpdatesChannelId: string) {
	return container.prisma.guildConfig.upsert({
		where: { guildId },
		create: { guildId, metroNWUpdatesChannelId },
		update: { metroNWUpdatesChannelId }
	});
}
