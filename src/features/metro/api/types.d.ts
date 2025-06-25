export type LineId = 'l1' | 'l2' | 'l3' | 'l4' | 'l4a' | 'l5' | 'l6';
type RawStatusCode = '1' | '2' | '3' | '4';
type StatusCode = '0' | '1' | '2' | '3' | '4' | '5';

export interface RawNWInfoStation {
	nombre: string;
	codigo: string;
	estado: RawStatusCode;
	combinacion: string;
	descripcion: string;
	descripcion_app: string;
	mensaje: string;
}

export interface RawNWInfoLine {
	estado: RawStatusCode;
	mensaje: string;
	mensaje_app: string;
	estaciones: RawNWInfoStation[];
}

export type RawNWInfo = {
	[key in LineId]: RawNWInfoLine;
};

export interface NWInfoStation {
	code: string;
	statusCode: StatusCode;
	name: string;
	transfer: string | null;
	messages: {
		primary: string;
		secondary: string;
		tertiary: string | null;
	};
}

export interface NWInfoLine {
	id: LineId;
	statusCode: StatusCode;
	messages: {
		primary: string;
		secondary: string | null;
	};
	stations: NWInfoStation[];
}

export type NWInfo = {
	[key in LineId]: NWInfoLine;
};
