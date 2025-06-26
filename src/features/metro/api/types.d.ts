export type LineId = 'l1' | 'l2' | 'l3' | 'l4' | 'l4a' | 'l5' | 'l6';

export interface RawScheduleInterval {
	value: string; // e.g. "06:00 - 23:00"
	key: string; // e.g. "Lunes a Viernes"
	position: '1' | '2' | '3';
}

export interface ParsedExpressSchedule {
	morning: { start: string; end: string };
	evening: { start: string; end: string };
}

export type RawAccessibilityEquipment = 'Ascensores' | 'Escaleras mecánicas' | 'Rampas de Acceso' | 'Acceso Nivel Calle';
export type RawAccessEquipment = 'Accesos';
export type RawCommerceEquipment = 'Máquinas expendedoras' | 'Locales Comerciales' | 'Máquinas expendoras';
export type RawCultureEquipment = 'MetroArte' | 'BiblioMetro';
export type RawIntermodalityEquipment = 'Autoservicio' | 'Linea Cero' | 'BiciMetro' | 'Bus' | 'Tren' | 'U Invertida';
export type RawGeneralServicesEquipment =
	| 'Autoservicio'
	| 'Boletería'
	| 'Máquinas de carga bip!'
	| 'Cajero automático'
	| 'Teléfono'
	| 'Teléfonos'
	| 'Oficina de Atención a Clientes';

export type RawStationEquipment =
	| RawAccessibilityEquipment
	| RawAccessEquipment
	| RawCommerceEquipment
	| RawCultureEquipment
	| RawIntermodalityEquipment
	| RawGeneralServicesEquipment;

export type AccessibilityEquipment = 'ELEVATORS' | 'ESCALATORS' | 'ACCESS_RAMPS' | 'STREET_LEVEL_ACCESS';
export type AccessEquipment = 'ACCESS';
export type CommerceEquipment = 'VENDING_MACHINES' | 'SHOPS';
export type CultureEquipment = 'METRO_ARTE' | 'BIBLIO_METRO';
export type IntermodalityEquipment = 'LINEA_CERO' | 'BICI_METRO' | 'BUS' | 'REGIONAL_RAIL' | 'U_INVERTIDA';
export type GeneralServicesEquipment = 'SELF_SERVICE' | 'TICKET_OFFICE' | 'BIP_RECHARGE' | 'ATM' | 'PUBLIC_PHONES' | 'CUSTOMER_SERVICE_OFFICE';

export type StationEquipment =
	| AccessibilityEquipment
	| AccessEquipment
	| CommerceEquipment
	| CultureEquipment
	| IntermodalityEquipment
	| GeneralServicesEquipment;

export interface RawStationStatus {
	nombre: string;
	codigo: string;
	estado: '1' | '2' | '3' | '4';
	combinacion: string;
	descripcion: string;
	descripcion_app: string;
	mensaje: string;
}

export interface RawLineStatus {
	estado: '1' | '2' | '3' | '4';
	mensaje: string;
	mensaje_app: string;
	estaciones: RawStationStatus[];
}

export type RawMetroNetworkStatus = Record<LineId, RawLineStatus>;

export interface StationStatus {
	code: string;
	statusCode: '0' | '1' | '2' | '3' | '4' | '5';
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
	statusCode: '0' | '1' | '2' | '3' | '4' | '5';
	messages: {
		primary: string;
		secondary: string | null;
	};
	stations: StationStatus[];
}

export type MetroNetworkStatus = Record<LineId, LineStatus>;

export interface RawExpressRoute {
	horarioMañana: string;
	horarioTarde: string;
	tipo: 'Común' | 'Roja' | 'Verde';
}

export interface RawStationDetails {
	descripcion: string;
	codigo: string;
	estado: string;
	horario: RawScheduleInterval[];
	combinacion: string;
	mensaje: string;
	descripcion_app: string;
	nombre: string;
	linea: string;
	Equipamiento: {
		Accesibilidad?: RawAccessibilityEquipment[];
		Accesos?: RawAccessEquipment[];
		Comercio?: RawCommerceEquipment[];
		Cultura?: RawCultureEquipment[];
		Intermodalidad?: RawIntermodalityEquipment[];
		'Servicios Generales'?: RawGeneralServicesEquipment[];
	};
	rutaExpresa?: RawExpressRoute;
	ruta_expresa?: 'verde' | 'Verde' | 'roja' | 'común'; // casing inconsistency in API
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
	expressSchedule: ParsedExpressSchedule | null;
	equipment: {
		accessibility: AccessibilityEquipment[] | null;
		access: AccessEquipment[] | null;
		commerce: CommerceEquipment[] | null;
		culture: CultureEquipment[] | null;
		intermodality: IntermodalityEquipment[] | null;
		generalServices: GeneralServicesEquipment[] | null;
	};
}
