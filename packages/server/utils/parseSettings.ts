import {
    JsonSafeParse,
    getSettingsPath,
    getStaticPath,
    wLogger
} from '@tosu/common';
import fs from 'fs';
import path from 'path';

import { ISettings, ISettingsCompact, bodyPayload } from './counters.types';

export function parseCounterSettings(
    folderName: string,
    action: 'parse' | 'user/save' | 'counter/get' | 'dev/save' | '',
    payload?: bodyPayload[] & ISettings[]
) {
    const staticPath = getStaticPath();
    const settingsPath = path.join(
        staticPath,
        decodeURI(folderName),
        'settings.json'
    );
    const settingsValuesPath = getSettingsPath(decodeURI(folderName));
    const legacySettingsValuesPath = path.join(
        staticPath,
        decodeURI(folderName),
        'settings.values.json'
    );

    try {
        // copy legacy settings instead of moving/renaming, because some could have their static folder on other drive
        if (fs.existsSync(legacySettingsValuesPath)) {
            // wLogger.warn('counter-settings', 'copied legacy settings to new folder', decodeURI(folderName));
            fs.copyFileSync(legacySettingsValuesPath, settingsValuesPath);
            fs.renameSync(
                legacySettingsValuesPath,
                legacySettingsValuesPath.replace('values', 'old-values')
            );
        }

        if (!fs.existsSync(settingsPath))
            fs.writeFileSync(settingsPath, JSON.stringify([]), 'utf8');

        if (!fs.existsSync(settingsValuesPath))
            fs.writeFileSync(settingsValuesPath, JSON.stringify({}), 'utf8');

        const settings: ISettings[] = JsonSafeParse(
            fs.readFileSync(settingsPath, 'utf8'),
            []
        );

        const values: ISettingsCompact = JsonSafeParse(
            fs.readFileSync(settingsValuesPath, 'utf8'),
            {}
        );

        switch (action) {
            case 'parse':
                for (let i = 0; i < settings.length; i++) {
                    const setting = settings[i];

                    const value = values[setting.uniqueID] ?? setting.value;
                    switch (setting.type) {
                        case 'number': {
                            setting.value = isNaN(value) ? 0 : +value;
                            break;
                        }

                        case 'checkbox': {
                            if (typeof value === 'string') {
                                setting.value = value === 'true';
                                break;
                            }

                            setting.value = value;
                            break;
                        }

                        default: {
                            setting.value = value;
                            break;
                        }
                    }
                }

                return {
                    settings,
                    values,
                    settingsPath,
                    settingsValuesPath
                };

            case 'user/save':
                if (!Array.isArray(payload)) {
                    return new Error('body payload is not array');
                }

                for (let i = 0; i < payload.length; i++) {
                    const setting = payload[i];
                    setting.uniqueID = setting.uniqueID.replace(
                        /[^a-z0-9]/gim,
                        ''
                    );

                    const find = settings.findIndex(
                        (r) => r.uniqueID === setting.uniqueID
                    );
                    if (find === -1) continue;

                    switch (settings[find].type) {
                        case 'number': {
                            settings[find].value = isNaN(setting.value)
                                ? 0
                                : +setting.value;
                            break;
                        }

                        case 'checkbox': {
                            if (typeof setting.value === 'string') {
                                settings[find].value = setting.value === 'true';
                                break;
                            }

                            settings[find].value = setting.value;
                            break;
                        }

                        default: {
                            settings[find].value = setting.value;
                            break;
                        }
                    }

                    values[setting.uniqueID] = settings[find].value;
                }

                return {
                    settings,
                    values,
                    settingsPath,
                    settingsValuesPath
                };

            case 'counter/get':
                for (let i = 0; i < settings.length; i++) {
                    const setting = settings[i];

                    const value = values[setting.uniqueID] ?? setting.value;
                    switch (setting.type) {
                        case 'number': {
                            values[setting.uniqueID] = isNaN(value)
                                ? 0
                                : +value;
                            break;
                        }

                        case 'checkbox': {
                            if (typeof value === 'string') {
                                values[setting.uniqueID] = value === 'true';
                                break;
                            }
                            values[setting.uniqueID] = value;
                            break;
                        }

                        default: {
                            values[setting.uniqueID] = value;
                            break;
                        }
                    }
                }

                return {
                    settings,
                    values,
                    settingsPath,
                    settingsValuesPath
                };

            case 'dev/save': {
                if (!Array.isArray(payload)) {
                    return new Error('body payload is not array');
                }

                for (let i = 0; i < payload.length; i++) {
                    const setting = payload[i];

                    setting.uniqueID = setting.uniqueID.replace(
                        /[^a-z0-9]/gim,
                        ''
                    );

                    const value = setting.value;
                    switch (setting.type) {
                        case 'number': {
                            setting.value = isNaN(value) ? 0 : +value;
                            break;
                        }

                        case 'checkbox': {
                            if (typeof value === 'string') {
                                setting.value = value === 'true';
                                break;
                            }
                            setting.value = value;
                            break;
                        }

                        default: {
                            setting.value = value;
                            break;
                        }
                    }
                }

                return {
                    settings: payload,
                    settingsPath,
                    settingsValuesPath
                };
            }
        }

        return new Error('Undefined action to parse counter settings');
    } catch (exc) {
        wLogger.error(`parseCounterSettings: ${(exc as any).message}`);
        wLogger.debug(exc, {
            staticPath,
            folderName
        });

        return new Error(`parseCounterSettings Error: ${(exc as any).message}`);
    }
}
