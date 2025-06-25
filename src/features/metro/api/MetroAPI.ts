import axios from 'axios';
import { RawNWInfo, NWInfo, LineId } from './types';

/**
 * Clase principal para interactuar con las APIs del Metro de Santiago
 */
export class MetroAPI {
	/**
	 * Obtiene el estado general de la red del Metro de Santiago
	 * @async
	 */
	public async getNetworkInfo() {
		const rawData = await this.fetchRawNetworkData();
		const result = {} as NWInfo;

		for (const [line, lineInfo] of Object.entries(rawData)) {
			const key = line as LineId;

			result[key] = {
				id: key,
				statusCode: this.isOperating() ? lineInfo.estado : '0',
				messages: {
					primary: lineInfo.mensaje_app,
					secondary: lineInfo.mensaje || null
				},
				stations: lineInfo.estaciones.map((station) => ({
					code: station.codigo,
					statusCode: this.isOperating() ? station.estado : '0',
					name: station.nombre,
					transfer: station.combinacion || null,
					messages: { primary: station.descripcion, secondary: station.descripcion_app, tertiary: station.mensaje || null }
				}))
			};
		}

		return result;
	}

	/**
	 * Comprueba si la red del Metro de Santiago está operando
	 */
	public isOperating() {
		const now = new Date();
		const day = now.getDay(); // 0 = Domingo, 6 = Sábado
		const minutes = now.getHours() * 60 + now.getMinutes();

		let start: number, end: number;

		switch (day) {
			case 0: {
				// Domingo
				start = 7 * 60 + 30; // 7:30
				end = 23 * 60; // 23:00
				break;
			}

			case 6: {
				// Sábado
				start = 6 * 60 + 30; // 6:30
				end = 23 * 60; // 23:00
				break;
			}

			default: {
				// Lunes a viernes
				start = 6 * 60; // 6:00
				end = 23 * 60; // 23:00
			}
		}

		// start ≤ ahora ≤ end
		return start <= minutes && minutes <= end;
	}

	private async fetchRawNetworkData(): Promise<RawNWInfo> {
		const { data } = await axios.get('https://www.metro.cl/api/estadoRedDetalle.php');
		return data;
	}
}
