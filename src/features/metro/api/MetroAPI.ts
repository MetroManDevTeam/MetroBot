import axios from 'axios';
import {
	MetroLine,
	RawMetroNetworkStatus,
	RawStationDetails,
	MetroNetworkStatus,
	MetroStationDetails,
	AccessibilityEquipment,
	AccessEquipment,
	CommerceEquipment,
	CultureEquipment,
	IntermodalityEquipment,
	GeneralServicesEquipment,
	StationEquipment,
	RawStationEquipment
} from './types';

export class MetroAPI {
	private readonly expressRouteMap = {
		común: 'common',
		roja: 'red',
		Verde: 'green',
		verde: 'green'
	} as const;

	private readonly equipmentMap: Record<RawStationEquipment, StationEquipment> = {
		Ascensores: 'ELEVATORS',
		'Acceso Nivel Calle': 'STREET_LEVEL_ACCESS',
		'Rampas de Acceso': 'ACCESS_RAMPS',
		Accesos: 'ACCESS',
		'Locales Comerciales': 'SHOPS',
		MetroArte: 'METRO_ARTE',
		BiblioMetro: 'BIBLIO_METRO',
		Boletería: 'TICKET_OFFICE',
		'Máquinas de carga bip!': 'BIP_RECHARGE',
		'Cajero automático': 'ATM',
		Teléfonos: 'PUBLIC_PHONES',
		Bus: 'BUS',
		'Linea Cero': 'LINEA_CERO',
		'Escaleras mecánicas': 'ESCALATORS',
		Tren: 'REGIONAL_RAIL',
		'Oficina de Atención a Clientes': 'CUSTOMER_SERVICE_OFFICE',
		BiciMetro: 'BICI_METRO',
		'U Invertida': 'U_INVERTIDA',
		Autoservicio: 'SELF_SERVICE',
		'Máquinas expendedoras': 'VENDING_MACHINES',
		Teléfono: 'PUBLIC_PHONES',
		'Máquinas expendoras': 'VENDING_MACHINES'
	};

	private readonly metroSchedule: Record<number, { start: number; end: number }> = {
		0: { start: 7 * 60 + 30, end: 23 * 60 }, // Domingo
		6: { start: 6 * 60 + 30, end: 23 * 60 }, // Sábado
		1: { start: 6 * 60, end: 23 * 60 },
		2: { start: 6 * 60, end: 23 * 60 },
		3: { start: 6 * 60, end: 23 * 60 },
		4: { start: 6 * 60, end: 23 * 60 },
		5: { start: 6 * 60, end: 23 * 60 }
	};

	public async getMetroNetworkStatus() {
		const raw = await this.fetchRawMetroNetworkStatus();
		const result: Record<string, MetroNetworkStatus[keyof MetroNetworkStatus]> = {};

		for (const [line, data] of Object.entries(raw)) {
			result[line] = {
				line: line as MetroLine,
				status: this.isMetroOperating() ? data.estado : '0',
				messages: {
					primary: data.mensaje_app,
					secondary: data.mensaje || null
				},
				stations: data.estaciones.map((station) => ({
					code: station.codigo,
					status: this.isMetroOperating() ? station.estado : '0',
					name: station.nombre,
					transfer: (station.combinacion.toLowerCase() as MetroLine) || null,
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

	public async getMetroStationDetails(stationId: string): Promise<MetroStationDetails> {
		const raw = await this.fetchRawStationDetails(stationId);
		const expressRaw = raw.rutaExpresa?.tipo ?? raw.ruta_expresa;
		const expressRoute = this.expressRouteMap[expressRaw?.toLowerCase() as keyof typeof this.expressRouteMap] ?? null;

		const expressSchedule = raw.rutaExpresa
			? {
					morning: this.parseTimeInterval(raw.rutaExpresa.horarioMañana),
					evening: this.parseTimeInterval(raw.rutaExpresa.horarioTarde)
				}
			: null;

		return {
			code: raw.codigo,
			name: raw.nombre,
			line: raw.linea as MetroLine,
			status: raw.estado,
			transfer: (raw.combinacion.toLowerCase() as MetroLine) || null,
			messages: {
				primary: raw.descripcion,
				secondary: raw.descripcion_app,
				tertiary: raw.mensaje || null
			},
			expressRoute,
			expressSchedule,
			equipment: {
				accessibility: this.mapEquipment<AccessibilityEquipment>(raw.Equipamiento.Accesibilidad),
				access: this.mapEquipment<AccessEquipment>(raw.Equipamiento.Accesos),
				commerce: this.mapEquipment<CommerceEquipment>(raw.Equipamiento.Comercio),
				culture: this.mapEquipment<CultureEquipment>(raw.Equipamiento.Cultura),
				intermodality: this.mapEquipment<IntermodalityEquipment>(raw.Equipamiento.Intermodalidad),
				generalServices: this.mapEquipment<GeneralServicesEquipment>(raw.Equipamiento['Servicios Generales'])
			}
		};
	}

	public isMetroOperating(): boolean {
		const now = new Date();
		const currentMinutes = now.getHours() * 60 + now.getMinutes();
		const schedule = this.metroSchedule[now.getDay()];

		return currentMinutes >= schedule.start && currentMinutes <= schedule.end;
	}

	// Helpers privados

	private async fetchRawMetroNetworkStatus(): Promise<RawMetroNetworkStatus> {
		try {
			const { data } = await axios.get('https://www.metro.cl/api/estadoRedDetalle.php');
			return data;
		} catch (err) {
			console.error('[MetroAPI] Failed to fetch network status:', err);
			throw new Error('Metro network status fetch failed');
		}
	}

	public async fetchRawStationDetails(stationId: string): Promise<RawStationDetails> {
		try {
			const { data } = await axios.get(`https://8pt7kdrkb0.execute-api.us-east-1.amazonaws.com/UAT/informacion/${stationId}`);
			if (!data) throw new Error('Empty station response');
			return data;
		} catch (err) {
			console.error(`[MetroAPI] Failed to fetch station info for ${stationId}:`, err);
			throw new Error('Metro station data fetch failed');
		}
	}

	private parseTimeInterval(range: string) {
		const [start, end] = range.split(' - ').map((t) => t.trim());
		return { start, end };
	}

	private mapEquipment<T extends StationEquipment>(entries?: RawStationEquipment[]): T[] | null {
		if (!entries?.length) return null;

		return entries.map((entry) => this.equipmentMap[entry]).filter((e): e is T => Boolean(e));
	}
}
