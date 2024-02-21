import { Beatmap, Calculator } from '@kotrikd/rosu-pp';
import { config, downloadFile, unzip, wLogger } from '@tosu/common';
import fs from 'fs';
import path from 'path';

import { HttpServer, getContentType, sendJson } from '../index';
import { buildExternalCounters, buildLocalCounters } from '../utils/counters';
import { directoryWalker } from '../utils/directories';

export default function buildBaseApi(app: HttpServer) {
    app.route('/json', 'GET', (req, res) => {
        const osuInstances: any = Object.values(
            req.instanceManager.osuInstances || {}
        );
        if (osuInstances.length < 1) {
            res.statusCode = 500;
            return sendJson(res, { error: 'not_ready' });
        }

        const json = osuInstances[0].getState(req.instanceManager);
        sendJson(res, json);
    });

    app.route(/\/api\/counters\/search\/(?<query>.*)/, 'GET', (req, res) => {
        try {
            const query = decodeURI(req.params.query)
                .replace(/[^a-z0-9A-Z]/, '')
                .toLowerCase();

            if (req.query?.tab == '1') {
                return buildExternalCounters(res, query);
            }

            return buildLocalCounters(res, query);
        } catch (error) {
            wLogger.error((error as any).message);

            return sendJson(res, {
                error: (error as any).message
            });
        }
    });

    app.route(/\/api\/counters\/download\/(?<url>.*)/, 'GET', (req, res) => {
        try {
            const folderName = req.query.name;
            if (!folderName) {
                return sendJson(res, {
                    error: 'no folder name'
                });
            }

            const cacheFolder = path.join(
                path.dirname(process.execPath),
                '.cache'
            );
            const staticPath =
                config.staticFolderPath ||
                path.join(path.dirname(process.execPath), 'static');
            const folderPath = path.join(staticPath, decodeURI(folderName));

            if (fs.existsSync(folderPath)) {
                return sendJson(res, {
                    error: 'Folder already exist'
                });
            }

            if (!fs.existsSync(cacheFolder)) fs.mkdirSync(cacheFolder);

            const startUnzip = (result) => {
                unzip(result, folderPath)
                    .then(() => {
                        wLogger.info(`PP Counter downloaded: ${folderName}`);
                        sendJson(res, {
                            status: 'Finished',
                            path: result
                        });
                    })
                    .catch((reason) => {
                        sendJson(res, {
                            error: reason
                        });
                    });
            };

            downloadFile(
                req.params.url,
                path.join(cacheFolder, `${Date.now()}.zip`)
            )
                .then(startUnzip)
                .catch((reason) => {
                    sendJson(res, {
                        error: reason
                    });
                });
        } catch (error) {
            wLogger.error((error as any).message);

            return sendJson(res, {
                error: (error as any).message
            });
        }
    });

    app.route(/\/api\/deleteCounter\/(?<name>.*)/, 'GET', (req, res) => {
        try {
            const folderName = req.params.name;
            if (!folderName) {
                return sendJson(res, {
                    error: 'no folder name'
                });
            }

            const staticPath =
                config.staticFolderPath ||
                path.join(path.dirname(process.execPath), 'static');
            const folderPath = path.join(staticPath, decodeURI(folderName));

            if (!fs.existsSync(folderPath)) {
                return sendJson(res, {
                    error: `Folder doesn't exists`
                });
            }

            wLogger.info(`PP Counter removed: ${folderName}`);

            fs.rmSync(folderPath, { recursive: true, force: true });
            return sendJson(res, {
                status: 'deleted'
            });
        } catch (error) {
            return sendJson(res, {
                error: (error as any).message
            });
        }
    });

    app.route('/homepage.min.css', 'GET', (req, res) => {
        // @KOTRIK REMOVE THAT SHIT
        fs.readFile(
            'F:/coding/wip/tosu/packages/server/assets/homepage.min.css',
            'utf8',
            (err, content) => {
                res.writeHead(200, {
                    'Content-Type': getContentType('file.html')
                });
                res.end(content);
            }
        );
    });

    app.route('/homepage.js', 'GET', (req, res) => {
        // @KOTRIK REMOVE THAT SHIT
        fs.readFile(
            'F:/coding/wip/tosu/packages/server/assets/homepage.js',
            'utf8',
            (err, content) => {
                res.writeHead(200, {
                    'Content-Type': getContentType('file.html')
                });
                res.end(content);
            }
        );
    });

    app.route('/api/calculate/pp', 'GET', (req, res) => {
        try {
            const query: any = req.query;

            const osuInstances: any = Object.values(
                req.instanceManager.osuInstances || {}
            );
            if (osuInstances.length < 1) {
                res.statusCode = 500;
                return sendJson(res, { error: 'not_ready' });
            }

            const { settings, menuData } = osuInstances[0].entities.getServices(
                ['settings', 'menuData']
            );

            const beatmapFilePath =
                query.path ||
                path.join(
                    settings.gameFolder,
                    'Songs',
                    menuData.Folder,
                    menuData.Path
                );

            const parseBeatmap = new Beatmap({ path: beatmapFilePath });
            const calculator = new Calculator();

            const array = Object.keys(query || {});
            for (let i = 0; i < array.length; i++) {
                const key = array[i];
                const value = query[key];

                if (key in calculator && isFinite(+value))
                    calculator[key](+value);
            }

            return sendJson(res, {
                attributes: calculator.mapAttributes(parseBeatmap),
                performance: calculator.performance(parseBeatmap)
            });
        } catch (error) {
            wLogger.error(error);

            return sendJson(res, {
                error: (error as any).message
            });
        }
    });

    app.route(/.*/, 'GET', (req, res) => {
        const url = req.pathname || '/';
        const folderPath =
            config.staticFolderPath ||
            path.join(path.dirname(process.execPath), 'static');

        if (url == '/') {
            if (req.query?.tab == '1') {
                return buildExternalCounters(res);
            }

            return buildLocalCounters(res);
        }

        const extension = path.extname(url);
        if (extension == '' && !url.endsWith('/')) {
            res.writeHead(301, { Location: url + '/' });
            return res.end();
        }

        const selectIndexHTML = url.endsWith('/') ? url + 'index.html' : url;
        directoryWalker({
            _htmlRedirect: true,
            res,
            baseUrl: url,
            pathname: selectIndexHTML,
            folderPath
        });
    });
}