import crypto from 'crypto';
import getPort from 'get-port';
//@ts-ignore
import Swarm from 'discovery-swarm';
//@ts-ignore
import defaults from 'dat-swarm-defaults';

import { EventDispatcher, Event } from './events.js';


export class ServerCoNeovim extends EventDispatcher {
	public '@connection' = new Event<ServerCoNeovim, []>(this);
	public '@send' = new Event<ServerCoNeovim, [string]>(this);
	public '@data' = new Event<ServerCoNeovim, [any]>(this);


	constructor() {
		super();
	}

	public send(this: ServerCoNeovim, message: string): void {
		this.emit('send', message);
	}

	public connect(this: ServerCoNeovim) {
		const peers: any = {};
		let connSeq: number = 0;

		const myId: Buffer = crypto.randomBytes(32);
		console.log('Your identity: ' + myId.toString('hex'));

		this.on('send', message => {
			for(let id in peers) {
				peers[id].conn.write(message);
			}
		});

		const config = defaults({
			// peer-id
			id: myId,
		});

		const sw = Swarm(config);


		(async () => {
			const port = await getPort();

			sw.listen(port);
			console.log('Listening to port: ' + port);

			sw.join('our-fun-channel');

			sw.on('connection', (conn: any, info: any) => {
				const seq = connSeq;

				const peerId = info.id.toString('hex');
				console.log(`Connected #${seq} to peer: ${peerId}`);

				if(info.initiator) {
					try {
						conn.setKeepAlive(true, 600);
					} catch(exception) {
						console.log('exception', exception);
					}
				}

				conn.on('data', (data: any) => {
					console.log('On data: ', data.toString());

					this.emit('data', data);
				});

				conn.on('close', () => {
					// Here we handle peer disconnection
					console.log(`Connection ${seq} closed, peer id: ${peerId}`);
					// If the closing connection is the last connection with the peer, removes the peer
					if(peers[peerId].seq === seq) {
						delete peers[peerId];
					}
				});

				// Save the connection
				if(!peers[peerId]) {
					peers[peerId] = {};
				}

				peers[peerId].conn = conn;
				peers[peerId].seq = seq;
				connSeq++;
			});


			this.emit('connection');
		})();
	}
}
