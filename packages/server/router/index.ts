import {
    downloadFile,
    getCachePath,
    getProgramPath,
    getStaticPath,
    unzip,
    wLogger,
    writeConfig
} from '@tosu/common';
import { autoUpdater } from '@tosu/updater';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import rosu from 'rosu-pp-js';

import { Server, sendJson } from '../index';
import {
    buildExternalCounters,
    buildInstructionLocal,
    buildLocalCounters,
    buildSettings,
    saveSettings
} from '../utils/counters';
import { ISettings } from '../utils/counters.types';
import { directoryWalker } from '../utils/directories';
import { parseCounterSettings } from '../utils/parseSettings';

export default function buildBaseApi(server: Server) {
    server.app.route('/json', 'GET', (req, res) => {
        const osuInstance: any = req.instanceManager.getInstance();
        if (!osuInstance) {
            res.statusCode = 500;
            wLogger.debug('/json', 'not_ready');
            return sendJson(res, { error: 'not_ready' });
        }

        const json = osuInstance.getState(req.instanceManager);
        sendJson(res, json);
    });

    server.app.route(
        /^\/api\/counters\/search\/(?<query>.*)/,
        'GET',
        (req, res) => {
            try {
                const query = decodeURI(req.params.query)
                    .replace(/[^a-z0-9A-Z]/, '')
                    .toLowerCase();

                if (req.query?.tab === '1') {
                    return buildExternalCounters(res, query);
                }

                return buildLocalCounters(res, query);
            } catch (error) {
                wLogger.error((error as any).message);
                wLogger.debug(error);

                return sendJson(res, {
                    error: (error as any).message
                });
            }
        }
    );

    server.app.route(
        /^\/api\/counters\/download\/(?<url>.*)/,
        'GET',
        (req, res) => {
            const folderName = req.query.name;
            if (!folderName) {
                return sendJson(res, {
                    error: 'no folder name'
                });
            }

            const cacheFolder = getCachePath();
            const staticPath = getStaticPath();
            const folderPath = path.join(staticPath, decodeURI(folderName));

            const tempPath = path.join(cacheFolder, `${Date.now()}.zip`);

            if (fs.existsSync(folderPath) && req.query.update !== 'true') {
                return sendJson(res, {
                    error: 'Folder already exist'
                });
            }

            if (!fs.existsSync(cacheFolder)) fs.mkdirSync(cacheFolder);

            try {
                const startUnzip = (result) => {
                    unzip(result, folderPath)
                        .then(() => {
                            wLogger.info(
                                `PP Counter downloaded: ${folderName} (${req.headers.referer})`
                            );
                            fs.unlinkSync(tempPath);

                            sendJson(res, {
                                status: 'Finished',
                                path: result
                            });
                        })
                        .catch((reason) => {
                            fs.unlinkSync(tempPath);
                            wLogger.debug(
                                `counter-${folderName}-unzip`,
                                reason
                            );

                            sendJson(res, {
                                error: reason
                            });
                        });
                };

                downloadFile(req.params.url, tempPath)
                    .then(startUnzip)
                    .catch((reason) => {
                        wLogger.debug(`counter-${folderName}-download`, reason);

                        sendJson(res, {
                            error: reason
                        });
                    });
            } catch (error) {
                wLogger.error((error as any).message);
                wLogger.debug(error);

                sendJson(res, {
                    error: (error as any).message
                });
            }
        }
    );

    server.app.route(
        /^\/api\/counters\/open\/(?<name>.*)/,
        'GET',
        (req, res) => {
            try {
                const folderName = req.params.name;
                if (!folderName) {
                    return sendJson(res, {
                        error: 'no folder name'
                    });
                }

                const staticPath = getStaticPath();
                let folderPath = path.join(staticPath, decodeURI(folderName));
                if (folderName === 'tosu.exe') folderPath = getProgramPath();
                else if (folderName === 'static.exe')
                    folderPath = getStaticPath();

                if (!fs.existsSync(folderPath)) {
                    return sendJson(res, {
                        error: "Folder doesn't exists"
                    });
                }

                let command;
                switch (process.platform) {
                    case 'win32':
                        command = `start "" "${folderPath}"`;
                        break;
                    case 'linux':
                        command = `xdg-open "${folderPath}"`;
                        break;
                    case 'darwin':
                        command = `open -R "${folderPath}"`;
                        break;
                }

                wLogger.info(
                    `PP Counter opened: ${folderName} (${req.headers.referer})`
                );

                exec(command, (err) => {
                    if (err) {
                        wLogger.error('Error opening file explorer:');
                        wLogger.debug(err);

                        return sendJson(res, {
                            error: `Error opening file explorer: ${err.message}`
                        });
                    }

                    return sendJson(res, {
                        status: 'opened'
                    });
                });
            } catch (error) {
                return sendJson(res, {
                    error: (error as any).message
                });
            }
        }
    );

    server.app.route(
        /^\/api\/counters\/delete\/(?<name>.*)/,
        'GET',
        (req, res) => {
            try {
                const folderName = req.params.name;
                if (!folderName) {
                    return sendJson(res, {
                        error: 'no folder name'
                    });
                }

                const staticPath = getStaticPath();
                const folderPath = path.join(staticPath, decodeURI(folderName));

                if (!fs.existsSync(folderPath)) {
                    return sendJson(res, {
                        error: "Folder doesn't exists"
                    });
                }

                wLogger.info(
                    `PP Counter removed: ${folderName} (${req.headers.referer})`
                );

                fs.rmSync(folderPath, { recursive: true, force: true });
                return sendJson(res, {
                    status: 'deleted'
                });
            } catch (error) {
                return sendJson(res, {
                    error: (error as any).message
                });
            }
        }
    );

    server.app.route(
        /^\/api\/counters\/settings\/(?<name>.*)/,
        'GET',
        (req, res) => {
            try {
                const folderName = req.params.name;
                if (!folderName) {
                    return sendJson(res, {
                        error: 'No folder name'
                    });
                }

                const settings = parseCounterSettings(folderName, 'parse');
                if (settings instanceof Error) {
                    wLogger.debug(
                        `counter-${folderName}-settings-get`,
                        settings
                    );

                    return sendJson(res, {
                        error: settings.name
                    });
                }

                wLogger.info(
                    `Settings accessed: ${folderName} (${req.headers.referer})`
                );

                return sendJson(res, settings);
            } catch (error) {
                return sendJson(res, {
                    error: (error as any).message
                });
            }
        }
    );

    server.app.route(
        /^\/api\/counters\/settings\/(?<name>.*)/,
        'POST',
        (req, res) => {
            let body: ISettings[];
            try {
                body = JSON.parse(req.body);
            } catch (error) {
                return sendJson(res, {
                    error: (error as any).message
                });
            }

            try {
                const folderName = req.params.name;
                if (!folderName) {
                    return sendJson(res, {
                        error: 'no folder name'
                    });
                }

                if (req.query.update === 'yes') {
                    const result = parseCounterSettings(
                        folderName,
                        'dev/save',
                        body as any
                    );

                    if (!(result instanceof Error)) {
                        wLogger.info(
                            `Settings re:created: ${folderName} (${req.headers.referer})`
                        );

                        fs.writeFileSync(
                            result.settingsPath,
                            JSON.stringify(result.settings),
                            'utf8'
                        );
                    }

                    return sendJson(res, { result: 'success' });
                }

                wLogger.info(
                    `Settings saved: ${folderName} (${req.headers.referer})`
                );

                const html = saveSettings(folderName, body as any);
                if (html instanceof Error) {
                    wLogger.debug(`counter-${folderName}-settings-save`, html);

                    return sendJson(res, {
                        error: html.name
                    });
                }

                server.WS_COMMANDS.socket.emit(
                    'message',
                    `getSettings:${folderName}`
                );

                return sendJson(res, { result: 'success' });
            } catch (error) {
                return sendJson(res, {
                    error: (error as any).message
                });
            }
        }
    );

    server.app.route('/api/runUpdates', 'GET', async (req, res) => {
        try {
            const result = await autoUpdater();
            if (result instanceof Error) {
                sendJson(res, { result: result.name });
                return;
            }

            sendJson(res, { result: 'updated' });
        } catch (exc) {
            wLogger.error('runUpdates', (exc as any).message);
            wLogger.debug('runUpdates', exc);

            return sendJson(res, {
                error: (exc as any).message
            });
        }
    });

    server.app.route('/api/settingsSave', 'POST', (req, res) => {
        let body: object;
        try {
            body = JSON.parse(req.body);
        } catch (error) {
            return sendJson(res, {
                error: (error as any).message
            });
        }

        writeConfig(server, body);

        sendJson(res, {
            status: 'updated'
        });
    });

    server.app.route('/api/calculate/pp', 'GET', (req, res) => {
        try {
            const query: any = req.query;

            const osuInstance: any = req.instanceManager.getInstance();
            if (!osuInstance) {
                res.statusCode = 500;
                return sendJson(res, { error: 'not_ready' });
            }

            const { allTimesData, menuData, beatmapPpData } =
                osuInstance.getServices([
                    'allTimesData',
                    'menuData',
                    'beatmapPpData'
                ]);

            let beatmap: rosu.Beatmap;
            const exists = fs.existsSync(query.path);
            if (exists) {
                const beatmapFilePath = path.join(
                    allTimesData.GameFolder,
                    'Songs',
                    menuData.Folder,
                    menuData.Path
                );

                const beatmapContent = fs.readFileSync(beatmapFilePath, 'utf8');
                beatmap = new rosu.Beatmap(beatmapContent);
            } else {
                beatmap = beatmapPpData.getCurrentBeatmap();
            }

            if (query.mode !== undefined) beatmap.convert(query.mode);

            const params: rosu.PerformanceArgs = {};

            if (query.clockRate) params.clockRate = +query.clockRate;
            if (query.passedObjects)
                params.passedObjects = +query.passedObjects;
            if (query.combo) params.combo = +query.combo;
            if (query.nMisses) params.misses = +query.nMisses;
            if (query.n100) params.n100 = +query.n100;
            if (query.n300) params.n300 = +query.n300;
            if (query.n50) params.n50 = +query.n50;
            if (query.nGeki) params.nGeki = +query.nGeki;
            if (query.nKatu) params.nKatu = +query.nKatu;
            if (query.mods) params.mods = +query.mods;
            if (query.acc) params.accuracy = +query.acc;

            const calculate = new rosu.Performance(params).calculate(beatmap);
            sendJson(res, calculate);

            // free beatmap only when map path specified
            if (query.path) beatmap.free();
            calculate.free();
        } catch (exc) {
            wLogger.error('calculate/pp', (exc as any).message);
            wLogger.debug('calculate/pp', exc);

            return sendJson(res, {
                error: typeof exc === 'string' ? exc : (exc as any).message
            });
        }
    });

    server.app.route(/.*/, 'GET', (req, res) => {
        try {
            const url = req.pathname || '/';
            const staticPath = getStaticPath();

            if (url === '/') {
                if (req.query?.tab === '1') {
                    return buildExternalCounters(res);
                }

                if (req.query?.tab === '2') {
                    return buildSettings(res);
                }

                if (req.query?.tab === '3') {
                    return buildInstructionLocal(res);
                }

                return buildLocalCounters(res);
            }

            const extension = path.extname(url);
            if (extension === '' && !url.endsWith('/')) {
                res.writeHead(301, { Location: url + '/' });
                return res.end();
            }

            const selectIndexHTML = url.endsWith('/')
                ? url + 'index.html'
                : url;
            directoryWalker({
                _htmlRedirect: true,
                res,
                baseUrl: url,
                pathname: selectIndexHTML,
                folderPath: staticPath
            });
        } catch (error) {
            wLogger.debug(error);

            return sendJson(res, {
                error: (error as any).message
            });
        }
    });
}
