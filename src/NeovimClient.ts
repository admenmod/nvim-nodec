import net from 'net';
import { EventDispatcher, Event } from './events.js';
import { Transport } from './Transport.js';


export function attach({ socket }: { socket: string }): NeovimClient {
	const client = net.createConnection(socket);

	const writer = client;
	const reader = client;

	const nvim = new NeovimClient();
	nvim.attach(writer, reader);

	return nvim;
}


export class NeovimClient extends Transport {
	public async getChennelId(): Promise<number> {
		return (await this.request('nvim_get_api_info', []))[0];
	}

	public request(method: string, args: any[]): Promise<any> {
		return new Promise((resolve, reject) => {
			super.request(method, args, (err: any, res: any) => {
				if(err) reject(new Error(`${method}: ${err[1]}`));
				else resolve(res);
			});
		});
	}

	public command(cmd: string): Promise<any> {
		return this.request('nvim_command', [cmd]);
	}
}
