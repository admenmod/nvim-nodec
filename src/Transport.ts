import { decodeMultiStream, encode, ExtensionCodec } from '@msgpack/msgpack';
import { EventDispatcher, Event } from './events.js';


export const MSGPACK_ENUM = {
	REQUEST: 0,
	RESPONSE: 1,
	NOTIFICATION: 2
} as const;

export type MSGPACK_ENUM = typeof MSGPACK_ENUM[keyof typeof MSGPACK_ENUM];


export type PendingHandler = (error: any[] | null, result: any[] | null) => any;


export class Response {
	private sent: boolean = false;

	constructor(
		private encoder: NodeJS.WritableStream,
		private requestId: number
	) {}

	public send(res: any, isError: boolean = false): void {
		if(this.sent) throw new Error(`Response to id ${this.requestId} already sent`);

		const encoded = encode([
			1,
			this.requestId,
			isError ? res : null,
			!isError ? res : null,
		]);

		this.encoder.write(Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength));
		this.sent = true;
	}
}


export class Transport extends EventDispatcher {
	public '@attach' = new Event<Transport, [NodeJS.WritableStream, NodeJS.ReadableStream]>(this);
	public '@detach' = new Event<Transport, []>(this);

	public '@request' = new Event<Transport, [string, any[], Response]>(this);
	public '@response' = new Event<Transport, [any[] | null, any[] | null]>(this);
	public '@notification' = new Event<Transport, [string, any[]]>(this);


	private nextRequestId: number = 0;
	private pending: Map<number, PendingHandler> = new Map();

	public writer!: NodeJS.WritableStream;
	public reader!: NodeJS.ReadableStream;

	private readonly extensionCodec: ExtensionCodec = this.initializeExtensionCodec();

	private initializeExtensionCodec(): ExtensionCodec {
		const codec = new ExtensionCodec();

		codec;

		return codec;
	}

	private encodeToBuffer(value: unknown): Buffer {
		const encoded = encode(value, { extensionCodec: this.extensionCodec });
		return Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
	}

	private on_result(this: Transport, data: any[]): void {
		const msg_type = data[0];

		if(msg_type === MSGPACK_ENUM.REQUEST) {
			this.emit('request', data[2], data[3], new Response(this.writer, data[1]));
		} else if(msg_type === MSGPACK_ENUM.RESPONSE) {
			const id = data[1];
			const handler = this.pending.get(id)!;
			this.pending.delete(id);
			handler(data[2], data[3]);

			this.emit('response', data[2], data[3]);
		} else if(msg_type === MSGPACK_ENUM.NOTIFICATION) {
			this.emit('notification', data[1], data[2]);
		} else throw 'error msg_type';

		console.log('data: ', data);
	}

	public request(method: string, args: any[], cb: PendingHandler): void {
		this.nextRequestId += 1;
		this.writer.write(this.encodeToBuffer([MSGPACK_ENUM.REQUEST, this.nextRequestId, method, args]));

		this.pending.set(this.nextRequestId, cb);
	}

	public notify(method: string, args: any[]): void {
		this.writer.write(this.encodeToBuffer([MSGPACK_ENUM.NOTIFICATION, method, args]));
	}

	public attach(this: Transport, writer: NodeJS.WritableStream, reader: NodeJS.ReadableStream): void {
		this.writer = writer;
		this.reader = reader;

		this.reader.on('end', () => this.emit('detach'));

		const asyncDecodeGenerator = decodeMultiStream(this.reader, {
			extensionCodec: this.extensionCodec
		});

		const resolveGeneratorRecursively = (iter: AsyncGenerator) => {
			iter.next().then(({ value, done }) => {
				if(done) return;

				this.on_result(value as any[]);
				resolveGeneratorRecursively(iter);
			});
		};

		resolveGeneratorRecursively(asyncDecodeGenerator);

		this.emit('attach', this.writer, this.reader);
	}
}
