import { container } from '@sapphire/framework';

export async function clearStatusMessages(guildId: string) {
	return container.prisma.metroLineStatusMessage.deleteMany({ where: { guildId } });
}
