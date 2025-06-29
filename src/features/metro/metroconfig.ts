import { ColorResolvable } from 'discord.js';
import { MetroLine } from '#metro/api/types';
import { ExpressRoute } from '../../../generated';

export const lineIcons: Record<MetroLine, string> = {
	l1: '<:l1:1386445105455566918>',
	l2: '<:l2:1386445134367035485>',
	l3: '<:l3:1386445150246670478>',
	l4: '<:l4:1386445164771278990>',
	l4a: '<:l4a:1386445178838978651>',
	l5: '<:l5:1386445194907353108>',
	l6: '<:l6:1386445209130242289>'
};

export const lineNames: Record<MetroLine, string> = {
	l1: 'Línea 1',
	l2: 'Línea 2',
	l3: 'Línea 3',
	l4: 'Línea 4',
	l4a: 'Línea 4A',
	l5: 'Línea 5',
	l6: 'Línea 6'
};

export const lineColors: Record<MetroLine, ColorResolvable> = {
	l1: '#ea000a',
	l2: '#ffaf00',
	l3: '#67210a',
	l4: '#1f2583',
	l4a: '#0079c1',
	l5: '#00ab65',
	l6: '#953994'
};

export const lineStatusMappings = {
	'0': '🌙 Cierre por horario',
	'1': '🟩 Operativa',
	'2': '🟥 Cerrada',
	'3': '🟨 Cierre parcial',
	'4': '⏲️ Demoras en frecuencia',
	'5': '➕ Ruta extendida'
};

export const stationStatusMappings = {
	'0': '🌙', // Cierre por horario
	'1': '<:operativa:1386520320952897536>', // Estación operativa
	'2': '<:cerrada:1388939059157537042>', // Estación cerrada
	'3': '<:parcial:1388938683658408017>', // Parcial (indefinido?)
	'4': '<:parcial:1388938683658408017>', // Parcial
	'5': '<:extendida:1388939180683296908>' // Extendida
};

export const expressRouteIcons: Record<ExpressRoute, string> = {
	common: '<:comun:1388704455423295619>',
	green: '<:verde:1388704493822152888>',
	red: '<:roja:1388704471462187049>'
};
