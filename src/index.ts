import '#lib/setup';
import { PrismaClient } from '../generated';
import { IntentsBitField } from 'discord.js';
import { MetroAPI } from '#metro/api/MetroAPI';
import { container, LogLevel, SapphireClient } from '@sapphire/framework';

const client = new SapphireClient({
	defaultPrefix: 'm!',
	caseInsensitiveCommands: true,
	intents: [
		IntentsBitField.Flags.Guilds,
		IntentsBitField.Flags.GuildMembers,
		IntentsBitField.Flags.GuildMessages,
		IntentsBitField.Flags.MessageContent
	],
	logger: {
		level: process.env['NODE_ENV'] === 'production' ? LogLevel.Info : LogLevel.Debug
	},
	loadMessageCommandListeners: true,
	// Configuración de BullMQ (nescesario para scheduled-tasks)
	tasks: {
		bull: {
			connection: {
				host: process.env.REDIS_HOST,
				port: 6379,
				db: 1
			}
		}
	}
});

// Instanciar prisma para conexión a base de datos y agregar al container de sapphire para uso en pieces
client.prisma = new PrismaClient();
container.prisma = client.prisma;

// Instanciar el wrapper de la API del Metro de Santiago y agregar al container de sapphire para uso en pieces
client.metro = new MetroAPI();
container.metro = client.metro;

const main = async () => {
	try {
		client.logger.info('Iniciando sesión...');
		await client.login();
		client.logger.info('Inicio de sesión exitoso!');

		client.logger.info('[DB] Conectando a la base de datos...');
		await client.prisma.$connect();
		client.logger.info('[DB] Conexión a la base de datos exitosa!');
	} catch (error) {
		client.logger.fatal(error);
		await client.prisma.$disconnect();
		await client.destroy();
		process.exit(-1);
	}
};

main();

// Agregar propiedades a discord.js y @sapphire/pieces para que typescript no grite
declare module 'discord.js' {
	interface Client {
		prisma: PrismaClient;
		metro: MetroAPI;
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		prisma: PrismaClient;
		metro: MetroAPI;
	}
}
