import Router from '@koa/router';
import Koa from 'koa';
import send from 'koa-send';
import serve from 'koa-static';
import Websockify from 'koa-websocket';
import { servicesVersion } from 'typescript';

import { InstancesManager } from './Instances/InstancesManager';
import { OsuInstance } from './Instances/Osu';
import { sleep } from './Utils/sleep';
import { wLogger } from './logger';

interface CustomContext extends Koa.Context {
	instancesManager: InstancesManager;
}

(async () => {
	wLogger.info('Starting tsosumemory');

	wLogger.info('Searching for osu!');

	const instancesManager = new InstancesManager();
	instancesManager.runWatcher();

	const app = Websockify<{}, CustomContext>(new Koa());
	app.use(async (ctx, next) => {
		ctx.instancesManager = instancesManager;
		await next();
	});

	app.use(async (ctx, next) => {
		ctx.set('Access-Control-Allow-Origin', '*');
		ctx.set(
			'Access-Control-Allow-Headers',
			'Origin, X-Requested-With, Content-Type, Accept'
		);
		ctx.set('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
		await next();
	});

	const router = new Router();

	const sendFunc = serve('./static', {
		index: '/index.html'
	});

	router.get('/(.*)', async (ctx, next) => {
		let staticPath = ctx.request.path.replace('/static', '');
		if (staticPath === '/') {
			ctx.body =
				'please enter correct static path, you can find needed folder in your static folder';
			return;
		}

		ctx.path = staticPath;
		await sendFunc(ctx, next);
	});

	router.get('/Songs/(.*)', async (ctx: CustomContext) => {
		if (Object.keys(ctx.instancesManager.osuInstances).length < 1) {
			ctx.response.status = 500;
			ctx.body = null;
			return;
		}

		const { settings } =
			ctx.instancesManager.osuInstances[0].servicesRepo.getServices(['settings']);
		if (settings.songsFolder === '') {
			ctx.response.status = 404;
			ctx.body = {
				error: 'not_ready'
			};
			return;
		}
		const mapPath = ctx.request.path.replace('/Songs', '');
		await send(ctx, mapPath, { root: settings.songsFolder });
	});

	router.get('/json', (ctx) => {
		if (Object.keys(ctx.instancesManager.osuInstances).length < 1) {
			ctx.response.status = 500;
			ctx.body = null;
			return;
		}

		ctx.body = ctx.instancesManager.osuInstances[Object.keys(ctx.instancesManager.osuInstances)[0]].getState();
	});

	const wsRouter = new Router();
	wsRouter.use(async (ctx, next) => {
		ctx.instancesManager = instancesManager;
		await next();
	})

	wsRouter.get('/ws', async (ctx) => {
		wLogger.debug('>>> ws: CONNECTED');
		let isSocketConnected = true;

		ctx.websocket.on('close', () => {
			isSocketConnected = false;
			wLogger.debug('>>> ws: CLOSED');
		});

		while (isSocketConnected) {
			if (Object.keys(ctx.instancesManager.osuInstances).length < 1) {
				ctx.websocket.send('{}');
				await sleep(500);
				continue;
			}

			ctx.websocket.send(
				JSON.stringify(ctx.instancesManager.osuInstances[Object.keys(ctx.instancesManager.osuInstances)[0]].getState())
			);
			await sleep(500);
		}
	});

	app.ws.use(wsRouter.routes()).use(wsRouter.allowedMethods());
	app.use(router.routes()).use(router.allowedMethods());

	app.listen(24050, '127.0.0.1');
})();
