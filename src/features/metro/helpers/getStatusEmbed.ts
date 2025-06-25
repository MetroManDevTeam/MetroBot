import { LineId, NWInfoLine } from '#metro/api/types';
import { lineColors, lineIcons, lineNames, lineStatusMappings, stationStatusMappings } from '#metro/metroconfig';
import { chunk } from '#utils/array/chunk';
import { getMultiLineString } from '#utils/string/getMultiLineString';
import { EmbedBuilder } from 'discord.js';

/**
 * Crea un embed de estado para la linea deseada
 */
export async function getStatusEmbed(lineInfo: NWInfoLine) {
	const stationNames = lineInfo.stations.map((station) => {
		// Agregar icono de estado al nombre de la estación y reemplazar el código de linea si está presente por su respectivo icono
		let name = `${stationStatusMappings[station.statusCode]} ${station.name.replace(lineInfo.id.toUpperCase(), lineIcons[lineInfo.id])}`;

		// Si la estación tiene una combinación agregarla al nombre ej: L1 + ↔️ L2
		if (station.transfer) {
			const transferId = station.transfer.toLowerCase() as LineId;
			name = `${name}↔️${lineIcons[transferId]}`;
		}

		return name;
	});

	const embed = new EmbedBuilder()
		.setTitle(`${lineIcons[lineInfo.id]} ${lineNames[lineInfo.id]}`)
		.setColor(lineColors[lineInfo.id])
		.setDescription(
			getMultiLineString(`📡 **Estado:**: ${lineStatusMappings[lineInfo.statusCode]}`, ` 📝 **Detalles:** ${lineInfo.messages.primary}`)
		)
		.setTimestamp();

	const chunks = chunk(stationNames);

	for (let i = 0; i < chunks.length; i++) {
		embed.addFields({ name: `🚆 Estaciones [${i + 1}]`, value: chunks[i].join('\n') });
	}

	return embed;
}
