const isOnceSymbol = Symbol('isOnceSymbol');

type FnOnce<This = any, Args extends any[] = any[]> = ((this: This, ...args: Args) => any) & { [isOnceSymbol]?: boolean };


export class Event<This = any, Args extends any[] = any[]> {
	private _handlers: FnOnce<This, Args>[] = [];
	protected readonly _this: This;

	constructor(_this: This) { this._this = _this; }

	public on(fn: FnOnce<This, Args>) {
		this._handlers.push(fn);
	}

	public once(fn: FnOnce<This, Args>) {
		fn[isOnceSymbol] = true;
		this._handlers.push(fn);
	}

	public off(fn: FnOnce<This, Args>) {
		let l: number = this._handlers.indexOf(fn);
		if(~l) return;
		this._handlers.splice(l, 1);
	}

	public emit(...args: Args) {
		for(let i = 0; i < this._handlers.length; ++i) {
			const fn = this._handlers[i];
			fn.apply(this._this, args);
			if(fn[isOnceSymbol]) this.off(fn);
		}
	}

	public clear() {
		this._handlers.length = 0;
	}
}


type event_name<T extends string = string> = `@${T}`;

type KeysEvents<T extends object> = ({
	[K in keyof T]: T[K] extends Event ? K extends event_name ? K : never : never
})[keyof T];

type getEventArgs<T extends object, K extends KeysEvents<T>> =
	T[K] extends Event<any, infer A> ? A : never;

type ConvertDel<U extends event_name> = U extends event_name<infer R> ? R : never;
type ConvertAdd<U extends string> = event_name<U>;


type ArgsEvent<T extends object, Type extends ConvertDel<KeysEvents<T>>> =
	getEventArgs<T, ConvertAdd<Type> extends KeysEvents<T> ? ConvertAdd<Type> : never>;


export class EventDispatcher {
	public on<
		Type extends ConvertDel<KeysEvents<this>>,
		Args extends ArgsEvent<this, Type>
	>(type: Type, fn: (this: this, ...args: Args) => any) {
		((this as any)[`@${type}`] as Event<this, Args>).on(fn);
	}

	public once<
		Type extends ConvertDel<KeysEvents<this>>,
		Args extends ArgsEvent<this, Type>
	>(type: Type, fn: (this: this, ...args: Args) => any) {
		((this as any)[`@${type}`] as Event<this, Args>).once(fn);
	}

	public off<
		Type extends ConvertDel<KeysEvents<this>>,
		Args extends ArgsEvent<this, Type>
	>(type: Type, fn: (this: this, ...args: Args) => any) {
		((this as any)[`@${type}`] as Event<this, Args>).off(fn);
	}

	public emit<
		Type extends ConvertDel<KeysEvents<this>>,
		Args extends ArgsEvent<this, Type>
	>(type: Type, ...args: Args) {
		((this as any)[`@${type}`] as Event<this, Args>).emit(...args);
	}

	public clear<Type extends ConvertDel<KeysEvents<this>>>(type: Type) {
		((this as any)[`@${type}`] as Event<this, any>).clear();
	}
}


type primitive_t = string | number | symbol;

class EventEmitter {
	protected _events!: { [type: primitive_t]: FnOnce[] & { store: any } };

	constructor(public isUseStore: boolean = false) {
		Object.defineProperty(this, '_events', { value: {} });
	}

	public once<args_t extends any[] = any[]>(type: primitive_t, fn: FnOnce<any, args_t>) {
		fn[isOnceSymbol] = true;
		return this.on(type, fn);
	}

	public on<args_t extends any[] = any[]>(type: primitive_t, fn: FnOnce<any, args_t>) {
		if(!this._events[type]) {
			(this._events[type] as any) = [];

			Object.defineProperty(this._events[type], 'store', { value: {} });

			let store = this._events[type].store;
			store.type = type;
			store.self = store.emitter = this;
		}

		this._events[type].push(fn);

		return this;
	}

	public off<args_t extends any[] = any[]>(type: primitive_t, fn: FnOnce<any, args_t>) {
		if(!type) for(let i in this._events) delete this._events[i];
		else if(!this._events[type]) return this;
		else if(!fn) delete this._events[type];
		else {
			let l = this._events[type].indexOf(fn);
			if(~l) this._events[type].splice(l, 1);
		}

		return this;
	}

	public emit<args_t extends any[] = any[]>(type: primitive_t, ...args: args_t) {
		if(!this._events[type]) return false;

		for(let i = 0; i < this._events[type].length; i++) {
			this._events[type][i].apply(this.isUseStore ? this._events[type].store : this, args);
			if(this._events[type][i][isOnceSymbol]) this._events[type].splice(i, 1);
		}

		return true;
	}

	//@ts-ignore
	public remove<args_t extends any[] = any[]>(type: primitive_t, fn: FnOnce<any, args_t>): this;
}

Object.defineProperty(EventEmitter.prototype, 'remove', {
	value: EventEmitter.prototype.off,
	writable: true, enumerable: false, configurable: true
});
