import { container } from '@sapphire/framework';

export function getStatusMessages(guildId?: string) {
	return container.prisma.lineStatusMessage.findMany({
		where: guildId ? { guildId } : undefined
	});
}
