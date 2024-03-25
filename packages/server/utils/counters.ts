import { config, recursiveFilesSearch, wLogger } from '@tosu/common';
import fs from 'fs';
import http from 'http';
import path from 'path';

import { getContentType } from '../utils';
import {
    authorHTML,
    authorLinksHTML,
    checkboxHTML,
    emptyCounters,
    emptyNotice,
    galleryImageHTML,
    iconsImages,
    iframeHTML,
    inputHTML,
    metadataHTML,
    nameHTML,
    noMoreCounters,
    resultItemHTML,
    saveSettingsButtonHTML,
    settingsItemHTML
} from './htmls';

/**
 * ТАК КАК БЛЯТЬ У НАС В ЖЫЭСЕ
 * НЕ ПРИДУМАЛИ НОРМАЛЬНО ПАКЕТИРОВАТЬ ГОВНО БЕЗ ВЕБПАКА
 * ИДЕМ И ПИЛИМ КОСТЫЛИ
 * kys js!
 */
const pkgAssetsPath =
    'pkg' in process
        ? path.join(__dirname, 'assets')
        : path.join(__filename, '../../../assets');

const pkgRunningFolder =
    'pkg' in process ? path.dirname(process.execPath) : process.cwd();

function splitTextByIndex(text, letter) {
    const index = text.indexOf(letter);
    if (index === -1) {
        return [text];
    } else {
        const part1 = text.substring(0, index);
        const part2 = text.substring(index);

        return [part1, part2];
    }
}

export function parseTXT(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf8')?.split('\n');

    const object: any = {};
    for (let i = 0; i < content.length; i++) {
        const line = content[i];
        const result = splitTextByIndex(line, ':');
        let [key, value] = result;
        if (key == null || value == null) continue;
        value = value.split('##')[0].replace(/\r/, '').replace(':', '');

        if (/[0-9 ]+x[ 0-9-]+/.test(value)) {
            object[key.toLowerCase()] = value.split('x');
        } else object[key.toLowerCase()] = value.trim();
    }

    filePath = path.resolve(filePath);
    const staticPath = path.resolve(config.staticFolderPath);

    object.folderName = path
        .dirname(filePath.replace(staticPath, ''))
        .replace(/^(\\\\\\|\\\\|\\|\/|\/\/)/, '')
        .replace(/\\/gm, '/');

    if (object.resolution) {
        object.resolution = object.resolution.map((r) => r.trim());
    }
    if (object.authorlinks) object.authorlinks = object.authorlinks.split(',');

    delete object.compatiblewith;
    delete object.usecase;

    return object;
}

function rebuildJSON({
    array,
    external,
    query
}: {
    array: {
        folderName: string;
        name: string;
        author: string;
        resolution: number[];
        authorlinks: string[];

        usecase?: string;
        compatiblewith?: string;
        assets?: {
            type: string;
            url: string;
        }[];
        downloadLink?: string;
    }[];
    external?: boolean;
    query?: string;
}) {
    let items = '';
    for (let i = 0; i < array.length; i++) {
        const item = array[i];

        if (query != null) {
            if (
                !(
                    item.name.toLowerCase().includes(query) ||
                    item.name.toLowerCase().includes(query)
                )
            ) {
                continue;
            }
        }

        const name = nameHTML.replace('{NAME}', item.name);
        const author = authorHTML.replace('{AUTHOR}', item.author);

        const links = item.authorlinks
            .map((r) => {
                const domain =
                    /:\/\/(?<domain>\S+)\//.exec(r)?.groups?.domain || '';
                if (!domain) return null;

                const iconUrl = iconsImages[domain.toLowerCase()];
                if (!iconUrl) return null;

                return authorLinksHTML
                    .replace('{LINK}', r)
                    .replace('{ICON_URL}', iconUrl);
            })
            .filter((r) => r != null)
            .join(' ');

        const ip =
            config.serverIP === '0.0.0.0' ? 'localhost' : config.serverIP;

        const iframe = iframeHTML
            .replace(
                '{URL}',
                `http://${ip}:${config.serverPort}/${item.folderName}/`
            )
            .replace(
                '{WIDTH}',
                item.resolution[0] === -1
                    ? '500px'
                    : item.resolution[0] === -2
                      ? '100%'
                      : `${item.resolution[0]}px`
            )
            .replace(
                '{HEIGHT}',
                item.resolution[1] === -1 ? '500px' : `${item.resolution[1]}px`
            );

        const metadata = metadataHTML
            .replace(
                '{COPY_URL}',
                `http://${config.serverIP}:${config.serverPort}/${item.folderName}/`
            )
            .replace('{TEXT_URL}', `/${item.folderName}/`)
            .replace(
                '{COPY_X}',
                item.resolution[0] === -1 || item.resolution[0] === -2
                    ? 'ANY'
                    : item.resolution[0].toString()
            )
            .replace(
                '{X}',
                item.resolution[0] === -1 || item.resolution[0] === -2
                    ? 'ANY'
                    : item.resolution[0].toString()
            )
            .replace(
                '{COPY_Y}',
                item.resolution[1] === -1 || item.resolution[1] === -2
                    ? 'ANY'
                    : item.resolution[1].toString()
            )
            .replace(
                '{Y}',
                item.resolution[1] === -1 || item.resolution[1] === -2
                    ? 'ANY'
                    : item.resolution[1].toString()
            );

        const button = item.downloadLink
            ? `<div class="buttons-group indent-left"><button class="button dl-button flexer" l="${item.downloadLink}" n="${item.name}" a="${item.author}"><span>Download</span></button></div>`
            : `<div class="buttons-group flexer indent-left">
                <button class="button open-button flexer" n="${item.folderName}"><span>Open Folder</span></button>
                <button class="button delete-button flexer" n="${item.folderName}"><span>Delete</span></button>
            </div>`;

        const assets = (item.assets || [])
            .map((r) => {
                return galleryImageHTML.replace('{LINK}', r.url);
            })
            .filter((r) => r != null)
            .join(' ');

        const gallery = item.assets ? assets : iframe;

        const footer =
            external !== true
                ? `<div class="ri-footer flexer">${metadata}</div>`
                : '';

        items += resultItemHTML
            .replace('{NAME}', name)
            .replace('{AUTHOR}', author)
            .replace('{AUTHOR_LINKS}', links)
            .replace('{BUTTONS}', button)
            .replace('{GALLERY}', gallery)
            .replace('{FOOTER}', footer);
    }

    return items;
}

function getLocalCounters() {
    try {
        const staticPath =
            path.resolve(config.staticFolderPath) ||
            path.join(pkgRunningFolder, 'static');

        const countersListTXT = recursiveFilesSearch({
            dir: staticPath,
            fileList: [],
            filename: 'metadata.txt'
        });

        const countersListHTML = recursiveFilesSearch({
            dir: staticPath,
            fileList: [],
            filename: 'index.html'
        });

        const arrayOfLocal = countersListHTML
            .filter((r) => {
                const folder = path.dirname(r);
                return (
                    countersListTXT.find((s) => path.dirname(s) === folder) ==
                    null
                );
            })
            .map((r) => {
                const nestedFolderPath = path.dirname(
                    r.replace(staticPath, '')
                );

                return {
                    folderName: nestedFolderPath
                        .replace(/^(\\\\\\|\\\\|\\|\/|\/\/)/, '')
                        .replace(/\\/gm, '/'),
                    name: path.basename(path.dirname(r)),
                    author: 'local',
                    resolution: [-2, '400'],
                    authorlinks: []
                };
            });

        const array = countersListTXT.map((r) => parseTXT(r));
        return array.concat(arrayOfLocal).filter((r) => r.name !== '');
    } catch (error) {
        wLogger.error((error as any).message);
        wLogger.debug(error);
        return [];
    }
}

export function buildLocalCounters(res: http.ServerResponse, query?: string) {
    const array = getLocalCounters();
    const build = rebuildJSON({
        array,
        external: false,
        query
    });

    if (query != null) {
        res.writeHead(200, {
            'Content-Type': getContentType('file.html')
        });
        return res.end(build || emptyCounters);
    }

    fs.readFile(
        path.join(pkgAssetsPath, 'homepage.html'),
        'utf8',
        (err, content) => {
            if (err) {
                wLogger.debug(err);
                res.writeHead(404, {
                    'Content-Type': 'text/html'
                });

                res.end('<html>page not found</html>');
                return;
            }

            const html = content.replace('{{LIST}}', build || emptyNotice);

            res.writeHead(200, {
                'Content-Type': getContentType('file.html')
            });
            res.end(html);
        }
    );
}

export async function buildExternalCounters(
    res: http.ServerResponse,
    query?: string
) {
    const request = await fetch(
        'https://raw.githubusercontent.com/cyperdark/osu-counters/master/.github/api.json'
    );
    const json: any = await request.json();

    const exists = getLocalCounters();
    const array = json.filter(
        (r) => !exists.find((s) => s.name === r.name && s.author === r.author)
    );

    const build = rebuildJSON({
        array,
        external: true,
        query
    });

    if (query != null) {
        res.writeHead(200, {
            'Content-Type': getContentType('file.html')
        });
        return res.end(build || emptyCounters);
    }

    fs.readFile(
        path.join(pkgAssetsPath, 'homepage.html'),
        'utf8',
        (err, content) => {
            if (err) {
                wLogger.debug(err);
                res.writeHead(404, {
                    'Content-Type': 'text/html'
                });

                res.end('<html>page not found</html>');
                return;
            }

            const html = content.replace('{{LIST}}', build || noMoreCounters);

            res.writeHead(200, {
                'Content-Type': getContentType('file.html')
            });
            res.end(html);
        }
    );
}

export function buildSettings(res: http.ServerResponse) {
    const debugHTML = settingsItemHTML
        .replace('{NAME}', 'DEBUG_LOG')
        .replace(
            '{DESCRIPTION}',
            "Enables logs for tosu developers, not very intuitive for you, the end user.<br />best not to include without developer's request."
        )
        .replace(
            '{INPUT}',
            checkboxHTML
                .replace(/{NAME}/gm, 'DEBUG_LOG')
                .replace('{ADDON}', config.debugLogging ? 'checked="true"' : '')
                .replace('{VALUE}', `${config.debugLogging}`)
        );

    const calculatePPHTML = settingsItemHTML
        .replace('{NAME}', 'CALCULATE_PP')
        .replace(
            '{DESCRIPTION}',
            'Turns PP counting on/off. Very useful for tournament client, you only care about scoring and map stats for example'
        )
        .replace(
            '{INPUT}',
            checkboxHTML
                .replace(/{NAME}/gm, 'CALCULATE_PP')
                .replace('{ADDON}', config.calculatePP ? 'checked="true"' : '')
                .replace('{VALUE}', `${config.calculatePP}`)
        );

    const enableKeyOverlayHTML = settingsItemHTML
        .replace('{NAME}', 'ENABLE_KEY_OVERLAY')
        .replace(
            '{DESCRIPTION}',
            'Enables/disable reading of K1/K2/M1/M2 keys from osu'
        )
        .replace(
            '{INPUT}',
            checkboxHTML
                .replace(/{NAME}/gm, 'ENABLE_KEY_OVERLAY')
                .replace(
                    '{ADDON}',
                    config.enableKeyOverlay ? 'checked="true"' : ''
                )
                .replace('{VALUE}', `${config.enableKeyOverlay}`)
        );

    const enableGosuOverlayHTML = settingsItemHTML
        .replace('{NAME}', 'ENABLE_GOSU_OVERLAY')
        .replace(
            '{DESCRIPTION}',
            'Enables/disable in-game <b>gosumemory</b> overlay<br />(!!!I AM NOT RESPONSIBLE FOR USING IT!!!)'
        )
        .replace(
            '{INPUT}',
            checkboxHTML
                .replace(/{NAME}/gm, 'ENABLE_GOSU_OVERLAY')
                .replace(
                    '{ADDON}',
                    config.enableGosuOverlay ? 'checked="true"' : ''
                )
                .replace('{VALUE}', `${config.enableGosuOverlay}`)
        );

    const pollRateHTML = settingsItemHTML
        .replace('{NAME}', 'POLL_RATE')
        .replace(
            '{DESCRIPTION}',
            'Frequency in milliseconds for updating information.'
        )
        .replace(
            '{INPUT}',
            inputHTML
                .replace('{TYPE}', 'number')
                .replace(/{NAME}/gm, 'POLL_RATE')
                .replace('{ADDON}', config.pollRate ? 'min="0"' : '')
                .replace('{VALUE}', `${config.pollRate}`)
        );

    const preciseDataPollRateHTML = settingsItemHTML
        .replace('{NAME}', 'PRECISE_DATA_POLL_RATE')
        .replace(
            '{DESCRIPTION}',
            'Frequency in milliseconds for updating precise information. (Key overlay and HitErrorData)'
        )
        .replace(
            '{INPUT}',
            inputHTML
                .replace('{TYPE}', 'number')
                .replace(/{NAME}/gm, 'PRECISE_DATA_POLL_RATE')
                .replace('{ADDON}', config.preciseDataPollRate ? 'min="0"' : '')
                .replace('{VALUE}', `${config.preciseDataPollRate}`)
        );

    const serverIPHTML = settingsItemHTML
        .replace('{NAME}', 'SERVER_IP')
        .replace('{DESCRIPTION}', 'The IP address for the API and WebSocket.')
        .replace(
            '{INPUT}',
            inputHTML
                .replace('{TYPE}', 'text')
                .replace(/{NAME}/gm, 'SERVER_IP')
                .replace('{ADDON}', config.serverIP ? 'min="0"' : '')
                .replace('{VALUE}', `${config.serverIP}`)
        );

    const serverPortHTML = settingsItemHTML
        .replace('{NAME}', 'SERVER_PORT')
        .replace('{DESCRIPTION}', 'The port for the API and WebSocket.')
        .replace(
            '{INPUT}',
            inputHTML
                .replace('{TYPE}', 'number')
                .replace(/{NAME}/gm, 'SERVER_PORT')
                .replace('{ADDON}', config.serverPort ? 'min="0"' : '')
                .replace('{VALUE}', `${config.serverPort}`)
        );

    const staticFolderPathtHTML = settingsItemHTML
        .replace('{NAME}', 'STATIC_FOLDER_PATH')
        .replace('{DESCRIPTION}', 'The directory path containing PP counters.')
        .replace(
            '{INPUT}',
            inputHTML
                .replace('{TYPE}', 'text')
                .replace(/{NAME}/gm, 'STATIC_FOLDER_PATH')
                .replace('{ADDON}', config.staticFolderPath ? 'min="0"' : '')
                .replace('{VALUE}', `${config.staticFolderPath}`)
        );

    const settings = `<div class="settings">
    ${debugHTML}
    ${calculatePPHTML}
    ${enableKeyOverlayHTML}
    ${enableGosuOverlayHTML}
    ${pollRateHTML}
    ${preciseDataPollRateHTML}
    ${serverIPHTML}
    ${serverPortHTML}
    ${staticFolderPathtHTML}
    ${saveSettingsButtonHTML}
    </div>`;

    fs.readFile(
        path.join(pkgAssetsPath, 'homepage.html'),
        'utf8',
        (err, content) => {
            if (err) {
                wLogger.debug(err);
                res.writeHead(404, {
                    'Content-Type': 'text/html'
                });

                res.end('<html>page not found</html>');
                return;
            }

            const html = content.replace('{{LIST}}', settings);

            res.writeHead(200, {
                'Content-Type': getContentType('file.html')
            });
            res.end(html);
        }
    );
}

export function buildInstructionLocal(res: http.ServerResponse) {
    const pageContent = `<div class="settings">
        <h3>How to Add Your Own Counter <a>Locally</a></h3>
        <p>
          1. <b>Create a new folder</b>:<br>- First, create a <a>new folder</a> inside your static folder.<br><br>
          2. <b>Move your pp counter files</b>:<br>- Next, move <a>your pp counter</a> files into the newly created folder.<br><br>
          3. <b>Download and place metadata file</b>:<br>- Download the <a
             href="https://raw.githubusercontent.com/cyperdark/osu-counters/master/quickstart/metadata.txt"
             target="_blank">metadata.txt</a> file and place it in the counter folder.<br><br>
          4. <b>Fill out the metadata file</b>:<br>- Finally, <a>open</a> the metadata.txt file and <a>fill out</a> the necessary information.
        </p>
      </div>`;
    fs.readFile(
        path.join(pkgAssetsPath, 'homepage.html'),
        'utf8',
        (err, content) => {
            if (err) {
                wLogger.debug(err);
                res.writeHead(404, {
                    'Content-Type': 'text/html'
                });

                res.end('<html>page not found</html>');
                return;
            }

            const html = content.replace('{{LIST}}', pageContent);

            res.writeHead(200, {
                'Content-Type': getContentType('file.html')
            });
            res.end(html);
        }
    );
}
