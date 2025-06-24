import { container } from '@sapphire/framework';

export async function getMetroUpdatesMessages(guildId?: string) {
	if (guildId) {
		const data = await container.prisma.guildConfig.findUnique({ where: { guildId: guildId }, select: { metroStatusMessages: true } });
		return data ? data.metroStatusMessages : [];
	}

	return await container.prisma.metroStatusMessage.findMany(guildId ? { where: { guildId: guildId } } : undefined);
}
