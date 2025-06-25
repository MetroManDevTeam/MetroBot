import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ButtonInteraction, EmbedBuilder } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class ButtonHandler extends InteractionHandler {
	public override async parse(interaction: ButtonInteraction<'cached'>) {
		if (interaction.customId === `network-status:${this.name}`) return this.some();

		return this.none();
	}

	public async run(interaction: ButtonInteraction<'cached'>) {
		interaction.update({
			embeds: [
				new EmbedBuilder() //
					.setTitle('⚙️ Canal de Actualizaciones (Metro)')
					.setDescription('No se realizaron cambios')
			],
			components: []
		});
	}
}
