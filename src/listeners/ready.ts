import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { StoreRegistryValue } from '@sapphire/pieces';
import { blue, gray, magenta, magentaBright, white, yellow } from 'colorette';

const dev = process.env.NODE_ENV !== 'production';

@ApplyOptions<Listener.Options>({ once: true })
export class UserEvent extends Listener {
	private readonly style = dev ? yellow : blue;

	public override async run() {
		this.container.logger.info(`Cliente listo; Se inició sesión como ${this.container.client.user?.tag} (${this.container.client.id})`);
		this.printBanner();
		this.printStoreDebugInformation();
	}

	private printBanner() {
		const llc = dev ? magentaBright : white;
		const blc = dev ? magenta : blue;

		console.log(
			String.raw`
${dev ? `${llc('MetroBot 6.0.0')}\n${blc('<')}${llc('/')}${blc('>')} ${llc('DEVELOPMENT MODE')}` : ''}
		`.trim()
		);
	}

	private printStoreDebugInformation() {
		const { client, logger } = this.container;
		const stores = [...client.stores.values()];
		const last = stores.pop()!;

		for (const store of stores) logger.info(this.styleStore(store, false));
		logger.info(this.styleStore(last, true));
	}

	private styleStore(store: StoreRegistryValue, last: boolean) {
		return gray(`${last ? '└─' : '├─'} Loaded ${this.style(store.size.toString().padEnd(3, ' '))} ${store.name}.`);
	}
}
