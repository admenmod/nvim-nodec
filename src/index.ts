import { ServerCoNeovim } from './server.js';
import { attach } from './NeovimClient.js';



console.log('========================================');
console.log('=================START==================');
console.log('========================================');


const NVIM_LISTEN_ADDRESS = process.env.NVIM_LISTEN_ADDRESS;
console.log(NVIM_LISTEN_ADDRESS);
if(!NVIM_LISTEN_ADDRESS) throw 'NVIM_LISTEN_ADDRESS is null';


process.on('unhandledRejection', (reason, promise) => {
	console.log('exit 1', reason, promise);
	process.exit(1);
});



(async function() {
	const nvim = attach({ socket: NVIM_LISTEN_ADDRESS });

	nvim.on('detach', () => {
		console.log('detach');
		process.exit(0);
	});


	type AnyFunction = (...args: any[]) => any;

	interface ICommand {
		id: string;
		ctx: any;
		fn: AnyFunction;
	}

	const commands = Object.assign([] as ICommand[], {
		prefix: 'CoNeovimCommand',

		add(id: string, fn: AnyFunction, ctx: any = {}) {
			(this as any).push({ id, fn, ctx });
		}
	});

	const chennelId = await nvim.getChennelId();


	nvim.on('request', (method, args, res) => {
		console.log('request >', 'method: ', method, 'args: ', args);

		res.send(null);
	});

	nvim.on('notification', (method, args) => {
		console.log('notification >', 'method: ', method, 'args: ', args);

		const o = commands.find(i => method === `${commands.prefix}${i.id}`);
		if(o) o.fn.call(o.ctx, args);
	});


	// nvim.request('nvim_get_api_info', []).then(data => {
	// 	console.log('nvim_get_api_info > ', data);
	// });

	nvim.command('let g:CoNeovim = 1').then(data => {
		console.log('nvim_command > ', data);
	});


	commands.add('MyCommand', () => {
		console.log('MyCommand');

		// server.question(`${NVIM_LISTEN_ADDRESS.match(/\/(.+?)$/)?.[1]} msksodkw`);
	});


	for(const { id } of commands) {
		const cmd = `command! ${id} call rpcnotify(${chennelId}, "${commands.prefix}${id}")`;

		nvim.command(cmd).then(data => {
			console.log(cmd);
			console.log('nvim_command > ', data);
		});
	}


	const server = new ServerCoNeovim();

	server.on('connection', () => {
		console.log('ServerCoNeovim connection');
	});

	server.on('data', data => {
		console.log('==============');
		data = JSON.parse(data);
		console.log('ServerCoNeovim data: ', data);

		nvim.request('nvim_win_set_cursor', [0, data]).then(data => {
			console.log('nvim_win_set_cursor: ', data);
		});

		console.log('==============');
	});

	server.connect();


	setInterval(() => {
		nvim.request('nvim_win_get_cursor', [0]).then(data => {
			nvim.command(`echo '[${data[0]}, ${data[1]}]'`);

			server.send(`[${data.toString()}]`);
		});
	}, 2000);
})();


console.log('========================================');
console.log('==================END===================');
console.log('========================================');
