import axios from 'axios';
import { RawMetroNetworkStatus, MetroNetworkStatus, StationStatus, LineId, RawStationDetails, MetroStationDetails, TimeInterval } from './types';

export class MetroAPI {
	private readonly expressRouteMap = {
		común: 'common',
		roja: 'red',
		verde: 'green'
	} as const;

	private readonly operationalHoursByDay: Record<number, { start: number; end: number }> = {
		0: { start: 7 * 60 + 30, end: 23 * 60 }, // Domingo
		6: { start: 6 * 60 + 30, end: 23 * 60 }, // Sábado
		1: { start: 6 * 60, end: 23 * 60 },
		2: { start: 6 * 60, end: 23 * 60 },
		3: { start: 6 * 60, end: 23 * 60 },
		4: { start: 6 * 60, end: 23 * 60 },
		5: { start: 6 * 60, end: 23 * 60 }
	};

	/**
	 * Obtiene el estado actual de toda la red del Metro de Santiago
	 */
	public async getMetroNetworkStatus(): Promise<MetroNetworkStatus> {
		const rawData = await this.fetchRawMetroNetworkStatus();
		const result = {} as MetroNetworkStatus;

		for (const [line, lineInfo] of Object.entries(rawData)) {
			const key = line as LineId;

			result[key] = {
				lineId: key,
				statusCode: this.isMetroOperatingNow() ? lineInfo.estado : '0',
				messages: {
					primary: lineInfo.mensaje_app,
					secondary: lineInfo.mensaje || null
				},
				stations: lineInfo.estaciones.map<StationStatus>((station) => ({
					code: station.codigo,
					statusCode: this.isMetroOperatingNow() ? station.estado : '0',
					name: station.nombre,
					transferTo: (station.combinacion.toLowerCase() as LineId) || null,
					messages: {
						primary: station.descripcion,
						secondary: station.descripcion_app,
						tertiary: station.mensaje || null
					}
				}))
			};
		}

		return result;
	}

	/**
	 * Obtiene la información detallada de una estación del Metro de Santiago
	 */
	public async getMetroStationDetails(stationId: string): Promise<MetroStationDetails> {
		const rawData = await this.fetchRawStationDetails(stationId);

		const rawExpress = rawData.rutaExpresa?.tipo ?? rawData.ruta_expresa;
		const expressRoute = this.expressRouteMap[rawExpress?.toLowerCase() as keyof typeof this.expressRouteMap] ?? null;

		const expressSchedule = rawData.rutaExpresa
			? {
					morning: this.parseTimeInterval(rawData.rutaExpresa.horarioMañana),
					evening: this.parseTimeInterval(rawData.rutaExpresa.horarioTarde)
				}
			: null;

		return {
			stationCode: rawData.codigo,
			name: rawData.nombre,
			lineId: rawData.linea as LineId,
			statusCode: rawData.estado,
			transferTo: (rawData.combinacion.toLowerCase() as LineId) || null,
			messages: {
				primary: rawData.descripcion,
				secondary: rawData.descripcion_app,
				tertiary: rawData.mensaje || null
			},
			expressRoute,
			expressSchedule,
			equipment: {
				accessibility: rawData.Equipamiento.Accesibilidad || null,
				access: rawData.Equipamiento.Accesos || null,
				culture: rawData.Equipamiento.Cultura || null,
				generalServices: rawData.Equipamiento['Servicios Generales'] || null
			}
		};
	}

	/**
	 * Comprueba si el Metro está operando actualmente
	 */
	public isMetroOperatingNow(): boolean {
		const now = new Date();
		const day = now.getDay();
		const minutes = now.getHours() * 60 + now.getMinutes();
		const hours = this.operationalHoursByDay[day];

		return minutes >= hours.start && minutes <= hours.end;
	}

	// --- Helpers ---

	private async fetchRawMetroNetworkStatus(): Promise<RawMetroNetworkStatus> {
		try {
			const { data } = await axios.get('https://www.metro.cl/api/estadoRedDetalle.php');
			return data;
		} catch (err) {
			console.error('[MetroAPI] Ocurrió un error al obtener el estado de la red:', err);
			throw new Error('');
		}
	}

	private async fetchRawStationDetails(stationId: string): Promise<RawStationDetails> {
		try {
			const { data } = await axios.get(`https://8pt7kdrkb0.execute-api.us-east-1.amazonaws.com/UAT/informacion/${stationId}`);
			if (!data) throw new Error('Empty station response');
			return data;
		} catch (err) {
			console.error(`[MetroAPI] Failed to fetch station info for ${stationId}:`, err);
			throw new Error('Failed to fetch Metro station data');
		}
	}

	private parseTimeInterval(range: string): TimeInterval {
		const [start, end] = range.split(' - ').map((s) => s.trim());
		return { start, end };
	}
}
