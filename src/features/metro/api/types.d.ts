export type LineId = 'l1' | 'l2' | 'l3' | 'l4' | 'l4a' | 'l5' | 'l6';
export type RawStatusCode = '1' | '2' | '3' | '4';
export type StatusCode = '0' | '1' | '2' | '3' | '4' | '5';

export interface RawStationStatus {
	nombre: string;
	codigo: string;
	estado: RawStatusCode;
	combinacion: string;
	descripcion: string;
	descripcion_app: string;
	mensaje: string;
}

export interface RawLineStatus {
	estado: RawStatusCode;
	mensaje: string;
	mensaje_app: string;
	estaciones: RawStationStatus[];
}

export type RawMetroNetworkStatus = {
	[key in LineId]: RawLineStatus;
};

export interface StationStatus {
	code: string;
	statusCode: StatusCode;
	name: string;
	transferTo: LineId | null;
	messages: {
		primary: string;
		secondary: string;
		tertiary: string | null;
	};
}

export interface LineStatus {
	lineId: LineId;
	statusCode: StatusCode;
	messages: {
		primary: string;
		secondary: string | null;
	};
	stations: StationStatus[];
}

export type MetroNetworkStatus = {
	[key in LineId]: LineStatus;
};

export interface RawStationDetails {
	descripcion: string;
	rutaExpresa?: RawExpressRoute;
	codigo: string;
	estado: string;
	horario: RawStationSchedule[];
	combinacion: string;
	mensaje: string;
	descripcion_app: string;
	nombre: string;
	linea: string;
	Equipamiento: RawStationEquipment;
	ruta_expresa?: 'común' | 'roja' | 'verde';
}

export interface RawStationEquipment {
	Accesibilidad?: string[];
	Accesos?: string[];
	Comercio?: string[];
	Cultura?: string[];
	Intermodalidad?: string[];
	'Servicios Generales'?: string[];
}

export interface RawStationSchedule {
	value: string;
	key: string;
	position: string;
}

export interface RawExpressRoute {
	horarioMañana: string;
	horarioTarde: string;
	tipo: 'Común' | 'Roja' | 'Verde';
}

export interface TimeInterval {
	start: string;
	end: string;
}

export interface ExpressSchedule {
	morning: TimeInterval;
	evening: TimeInterval;
}

export interface MetroStationDetails {
	stationCode: string;
	name: string;
	lineId: LineId;
	statusCode: string;
	transferTo: LineId | null;
	messages: {
		primary: string;
		secondary: string;
		tertiary: string | null;
	};
	expressRoute: 'common' | 'red' | 'green' | null;
	expressSchedule: ExpressSchedule | null;
	equipment: {
		accessibility: string[] | null;
		access: string[] | null;
		culture: string[] | null;
		generalServices: string[] | null;
	};
}
