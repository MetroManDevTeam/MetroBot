import { container } from '@sapphire/framework';

export function getStatusMessages(guildId?: string) {
	return container.prisma.metroLineStatusMessage.findMany({
		where: guildId ? { guildId } : undefined
	});
}
