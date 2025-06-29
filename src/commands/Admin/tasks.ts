import { Message } from 'discord.js';
import { Args, MessageCommand } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';

@ApplyOptions<Subcommand.Options>({
	description: 'Handler para scheduled-tasks de MetroBot',
	runIn: ['GUILD_TEXT'],
	preconditions: ['OwnerOnly'],
	subcommands: [
		{
			name: 'run',
			messageRun: 'run'
		}
	]
})
export class UserCommand extends Subcommand {
	public async run(_message: Message, args: Args, _context: MessageCommand.RunContext) {
		const taskName = (await args.pick('string')) as 'network-status-update' | 'station-details-update';
		console.log(await this.container.tasks.run({ name: taskName }));
	}
}
