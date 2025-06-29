import { chunk } from '#utils/array/chunk';
import { getMultiLineString } from '#utils/string/getMultiLineString';
import { getExpressRoute } from './getExpressRoute';
import { EmbedBuilder } from 'discord.js';
import { LineStatus } from '#metro/api/types';
import { expressRouteIcons, lineColors, lineIcons, lineNames, lineStatusMappings, stationStatusMappings } from '#metro/metroconfig';

/**
 * Crea un embed de estado para la linea deseada
 */
export async function getStatusEmbed(lineInfo: LineStatus) {
	const stationNames = await Promise.all(
		lineInfo.stations.map(async (station) => {
			// Agregar icono de estado al nombre de la estación y reemplazar el código de linea si está presente por su respectivo icono
			const statusIcon = stationStatusMappings[station.status];
			const expressRoute = await getExpressRoute(station.code);
			const expressRouteIcon = expressRoute ? expressRouteIcons[expressRoute] : '';
			const name = station.name.replace(lineInfo.line.toUpperCase(), lineIcons[lineInfo.line]);
			const transfer = station.transfer ? `↔️${lineIcons[station.transfer]}` : '';

			return `${statusIcon} ${expressRouteIcon} ${name}${transfer}`;
		})
	);

	const embed = new EmbedBuilder()
		.setTitle(`${lineIcons[lineInfo.line]} ${lineNames[lineInfo.line]}`)
		.setColor(lineColors[lineInfo.line])
		.setDescription(
			getMultiLineString(`📡 **Estado:**: ${lineStatusMappings[lineInfo.status]}`, ` 📝 **Detalles:** ${lineInfo.messages.primary}`)
		)
		.setTimestamp();

	const chunks = chunk(stationNames);

	for (let i = 0; i < chunks.length; i++) {
		embed.addFields({ name: `🚆 Estaciones [${i + 1}]`, value: chunks[i].join('\n') });
	}

	return embed;
}
