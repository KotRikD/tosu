import { config, sleep, updateProgressBar, wLogger } from '@tosu/common';
import { injectGameOverlay } from '@tosu/game-overlay';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { Process } from 'tsprocess/dist/process';

import { buildResult } from '@/api/utils/buildResult';
import { buildResult as buildResultV2 } from '@/api/utils/buildResultV2';
import { buildResult as buildResultV2Precise } from '@/api/utils/buildResultV2Precise';
import { AllTimesData } from '@/entities/AllTimesData';
import { BassDensityData } from '@/entities/BassDensityData';
import { BeatmapPPData } from '@/entities/BeatmapPpData';
import { DataRepo } from '@/entities/DataRepoList';
import { GamePlayData } from '@/entities/GamePlayData';
import { MenuData } from '@/entities/MenuData';
import { ResultsScreenData } from '@/entities/ResultsScreenData';
import { Settings } from '@/entities/Settings';
import { TourneyManagerData } from '@/entities/TourneyManagerData';
import { TourneyUserProfileData } from '@/entities/TourneyUserProfileData';
import { UserProfile } from '@/entities/UserProfile';
import { MemoryPatterns, PatternData } from '@/objects/memoryPatterns';

import { InstanceManager } from './instanceManager';

const SCAN_PATTERNS: {
    [k in keyof PatternData]: {
        pattern: string;
        offset?: number;
        isTourneyOnly?: boolean;
    };
} = {
    baseAddr: {
        pattern: 'F8 01 74 04 83 65'
    },
    playTimeAddr: {
        pattern: '5E 5F 5D C3 A1 ?? ?? ?? ?? 89 ?? 04'
    },
    chatCheckerAddr: {
        pattern: '0A D7 23 3C 00 00 ?? 01'
    },
    skinDataAddr: {
        pattern: '74 2C 85 FF 75 28 A1 ?? ?? ?? ?? 8D 15'
    },
    settingsClassAddr: {
        pattern: '83 E0 20 85 C0 7E 2F'
    },
    // configurationAddr: {
    //     pattern: '7E 07 8D 65 F8 5E 5F 5D C3 E8',
    //     offset: -0xd
    // },
    // bindingsAddr: {
    //     pattern: '8D 7D D0 B9 08 00 00 00 33 C0 F3 AB 8B CE 89 4D DC B9',
    //     offset: 0x2a
    // },
    rulesetsAddr: {
        pattern: '7D 15 A1 ?? ?? ?? ?? 85 C0'
    },
    canRunSlowlyAddr: {
        pattern: '55 8B EC 80 3D ?? ?? ?? ?? 00 75 26 80 3D'
    },
    statusPtr: {
        pattern: '48 83 F8 04 73 1E',
        offset: -0x4
    },
    menuModsPtr: {
        pattern: 'C8 FF 00 00 00 00 00 81 0D 00 00 00 00 00 08 00 00',
        offset: 0x9
    },
    getAudioLengthPtr: {
        pattern: '55 8B EC 83 EC 08 A1 ?? ?? ?? ?? 85 C0',
        offset: 0x7
    },
    userProfilePtr: {
        pattern: 'A1 ?? ?? ?? ?? 89 85 ?? ?? ?? ?? 6A 00 6A 00 8D 8D',
        offset: 0x1
    },
    rawLoginStatusPtr: {
        pattern: 'B8 0B 00 00 8B 35',
        offset: -0xb
    },
    // gameTimePtr: {
    //     pattern: 'FF 15 ?? ?? ?? ?? A1 ?? ?? ?? ?? 8B 15 ?? ?? ?? ?? 3B',
    //     offset: 0x7
    // },
    spectatingUserPtr: {
        pattern: '8B 0D ?? ?? ?? ?? 85 C0 74 05 8B 50 30',
        offset: -0x4
    }
};

export class OsuInstance {
    entities: DataRepo;

    pid: number;
    process: Process;
    path: string = '';

    isReady: boolean;
    isDestroyed: boolean = false;
    isTourneyManager: boolean = false;
    isTourneySpectator: boolean = false;

    ipcId: number = 0;

    previousState: string = '';
    previousTime: number = 0;

    emitter: EventEmitter;

    constructor(pid: number) {
        this.pid = pid;
        this.entities = new DataRepo();

        this.process = new Process(this.pid);
        this.emitter = new EventEmitter();

        this.path = this.process.path;

        this.entities.set('process', this.process);
        this.entities.set('patterns', new MemoryPatterns());
        this.entities.set('settings', new Settings());
        this.entities.set('allTimesData', new AllTimesData(this.entities));
        this.entities.set('beatmapPpData', new BeatmapPPData(this.entities));
        this.entities.set('menuData', new MenuData(this.entities));
        this.entities.set(
            'bassDensityData',
            new BassDensityData(this.entities)
        );
        this.entities.set('gamePlayData', new GamePlayData(this.entities));
        this.entities.set(
            'resultsScreenData',
            new ResultsScreenData(this.entities)
        );
        this.entities.set(
            'tourneyUserProfileData',
            new TourneyUserProfileData(this.entities)
        );
        this.entities.set(
            'tourneyManagerData',
            new TourneyManagerData(this.entities)
        );
        this.entities.set('userProfile', new UserProfile(this.entities));

        this.watchProcessHealth = this.watchProcessHealth.bind(this);
        this.updateMapMetadata = this.updateMapMetadata.bind(this);
        this.updatePreciseData = this.updatePreciseData.bind(this);
    }

    setTourneyIpcId(ipcId: number) {
        this.ipcId = ipcId;
    }

    setIsTourneySpectator(newVal: boolean) {
        this.isTourneySpectator = newVal;
    }

    private scan(buffer: Buffer, signature: Buffer) {
        for (let i = 0; i <= buffer.length - signature.length; i++) {
            let match = true;
            for (let j = 0; j < signature.length; j++) {
                if (signature[j] !== 0x00 && buffer[i + j] !== signature[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                return i;
            }
        }
        return 0;
    }

    async start() {
        wLogger.info(`[${this.pid}] Running memory chimera..`);

        while (!this.isReady) {
            const patternsRepo = this.entities.get('patterns');
            if (!patternsRepo) {
                throw new Error(
                    'Bases repo not initialized, missed somewhere?'
                );
            }

            try {
                const total = Object.keys(SCAN_PATTERNS).length;
                let completed = 0;

                this.process.scanRegions(
                    (baseAddress: number, region: Buffer) => {
                        for (const baseKey in SCAN_PATTERNS) {
                            if (
                                patternsRepo.getPattern(baseKey as never) !== 0
                            ) {
                                continue;
                            }

                            const s1 = performance.now();

                            const pattern = Buffer.from(
                                SCAN_PATTERNS[baseKey].pattern
                                    .split(' ')
                                    .map((x: string) => (x === '??' ? '00' : x))
                                    .join(''),
                                'hex'
                            );

                            const patternValue = this.scan(region, pattern);

                            if (patternValue === 0) {
                                updateProgressBar(
                                    `[${this.pid}] Scanning`,
                                    completed / total,
                                    `${(performance.now() - s1).toFixed(
                                        2
                                    )}ms ${baseKey}`
                                );
                                continue;
                            }

                            completed += 1;

                            patternsRepo.setPattern(
                                baseKey as never,
                                baseAddress +
                                    patternValue +
                                    (SCAN_PATTERNS[baseKey].offset || 0)
                            );

                            updateProgressBar(
                                `[${this.pid}] Scanning`,
                                completed / total,
                                `${(performance.now() - s1).toFixed(2)}ms ${baseKey}`
                            );
                        }
                    }
                );

                if (!patternsRepo.checkIsBasesValid()) {
                    throw new Error('Memory resolve failed');
                }

                wLogger.info(
                    `[${this.pid}] ALL PATTERNS ARE RESOLVED, STARTING WATCHING THE DATA`
                );
                this.isReady = true;
            } catch (exc) {
                wLogger.error(
                    `[${this.pid}] PATTERN SCANNING FAILED, TRYING ONE MORE TIME...`
                );
                wLogger.debug(exc);
                this.emitter.emit('onResolveFailed', this.pid);
                return;
            }
        }

        /**
         * ENABLING GOSU OVERLAY
         */
        if (config.enableGosuOverlay) {
            await this.injectGameOverlay();
        }

        this.update();
        this.initHighRateData();
        this.initMapMetadata();
        this.watchProcessHealth();
    }

    async injectGameOverlay() {
        await injectGameOverlay(this.process);
    }

    async update() {
        wLogger.debug('OI(update) starting');

        const {
            allTimesData,
            menuData,
            bassDensityData,
            beatmapPpData,
            gamePlayData,
            resultsScreenData,
            settings,
            tourneyUserProfileData,
            tourneyManagerData,
            userProfile
        } = this.entities.getServices([
            'allTimesData',
            'menuData',
            'bassDensityData',
            'beatmapPpData',
            'gamePlayData',
            'resultsScreenData',
            'settings',
            'tourneyUserProfileData',
            'tourneyManagerData',
            'userProfile'
        ]);

        while (!this.isDestroyed) {
            try {
                allTimesData.updateState();
                menuData.updateState();

                // osu! calculates audioTrack length a little bit after updating menuData, sooo.. lets this thing run regardless of menuData updating
                if (menuData.Folder !== '' && menuData.Folder !== null) {
                    menuData.updateMP3Length();
                }

                if (!settings.gameFolder) {
                    settings.setGameFolder(path.join(this.path, '..'));

                    // condition when user have different BeatmapDirectory in osu! config
                    if (fs.existsSync(allTimesData.SongsFolder)) {
                        settings.setSongsFolder(allTimesData.SongsFolder);
                    } else {
                        settings.setSongsFolder(
                            path.join(
                                this.path,
                                '../',
                                allTimesData.SongsFolder
                            )
                        );
                    }
                }

                settings.setSkinFolder(path.join(allTimesData.SkinFolder));

                switch (allTimesData.Status) {
                    case 0:
                        bassDensityData.updateState();
                        break;

                    // skip editor, to prevent constant data reset
                    case 1:
                        if (this.previousTime === allTimesData.PlayTime) break;

                        this.previousTime = allTimesData.PlayTime;
                        beatmapPpData.updateEditorPP();
                        break;

                    // EditorSongSElect and SongSelect
                    case 4:
                    case 5:
                        // Reset Gameplay/ResultScreen data on joining to songSelect
                        if (!gamePlayData.isDefaultState) {
                            gamePlayData.init();
                            resultsScreenData.init();
                            beatmapPpData.resetCurrentAttributes();
                        }
                        break;

                    case 2:
                        // Reset gameplay data on retry
                        if (this.previousTime > allTimesData.PlayTime) {
                            gamePlayData.init(true);
                            beatmapPpData.resetCurrentAttributes();
                        }

                        this.previousTime = allTimesData.PlayTime;

                        if (
                            allTimesData.PlayTime < 0 &&
                            !gamePlayData.isDefaultState
                        ) {
                            gamePlayData.init(true, 'not-default');
                            break;
                        }

                        gamePlayData.updateState();
                        break;

                    case 7:
                        resultsScreenData.updateState();
                        break;

                    case 22:
                        if (!this.isTourneyManager) {
                            this.isTourneyManager = true;
                        }
                        await tourneyManagerData.updateState();
                        break;

                    default:
                        gamePlayData.init();
                        resultsScreenData.init();
                        break;
                }

                if (this.isTourneySpectator) {
                    tourneyUserProfileData.updateState();
                }

                userProfile.updateState();
            } catch (exc) {
                wLogger.error('error happend while another loop executed');
                wLogger.debug(exc);
            }

            await sleep(config.pollRate);
        }
    }

    initHighRateData() {
        wLogger.debug('OI(updatePreciseData) starting');

        const { allTimesData, gamePlayData } = this.entities.getServices([
            'allTimesData',
            'gamePlayData'
        ]);

        this.updatePreciseData(allTimesData, gamePlayData);
    }

    updatePreciseData(allTimesData: AllTimesData, gamePlayData: GamePlayData) {
        if (this.isDestroyed === true) return;

        switch (allTimesData.Status) {
            case 2:
                if (allTimesData.PlayTime < 150) {
                    break;
                }

                if (config.enableKeyOverlay) {
                    gamePlayData.updateKeyOverlay();
                }
                gamePlayData.updateHitErrors();
                break;
            default:
                gamePlayData.resetKeyOverlay();
                break;
        }

        setTimeout(() => {
            this.updatePreciseData(allTimesData, gamePlayData);
        }, config.preciseDataPollRate);
    }

    initMapMetadata() {
        wLogger.debug('OI(updateMapMetadata) Starting');

        const entities = this.entities.getServices([
            'menuData',
            'allTimesData',
            'settings',
            'gamePlayData',
            'beatmapPpData'
        ]);

        this.updateMapMetadata(entities);
    }

    updateMapMetadata(entries: {
        menuData: MenuData;
        allTimesData: AllTimesData;
        settings: Settings;
        gamePlayData: GamePlayData;
        beatmapPpData: BeatmapPPData;
    }) {
        const {
            menuData,
            allTimesData,
            settings,
            gamePlayData,
            beatmapPpData
        } = entries;
        const currentMods =
            allTimesData.Status === 2 || allTimesData.Status === 7
                ? gamePlayData.Mods
                : allTimesData.MenuMods;

        const currentState = `${menuData.MD5}:${menuData.MenuGameMode}:${currentMods}:${menuData.MP3Length}`;

        if (
            menuData.Path?.endsWith('.osu') &&
            settings.gameFolder &&
            this.previousState !== currentState
        ) {
            this.previousState = currentState;

            try {
                beatmapPpData.updateMapMetadata(currentMods);
            } catch (exc) {
                wLogger.error(
                    "OI(updateMapMetadata) Can't update beatmap metadata"
                );
                wLogger.debug(exc);
            }
        }

        setTimeout(() => {
            this.updateMapMetadata(entries);
        }, config.pollRate);
    }

    watchProcessHealth() {
        if (this.isDestroyed === true) return;

        if (!Process.isProcessExist(this.process.handle)) {
            this.isDestroyed = true;
            wLogger.info(
                `OI(watchProcessHealth) osu!.exe at ${this.pid} got destroyed`
            );
            this.emitter.emit('onDestroy', this.pid);
        }

        setTimeout(this.watchProcessHealth, config.pollRate);
    }

    getState(instanceManager: InstanceManager) {
        return buildResult(this.entities, instanceManager);
    }

    getStateV2(instanceManager: InstanceManager) {
        return buildResultV2(this.entities, instanceManager);
    }

    getPreciseData() {
        return buildResultV2Precise(this.entities);
    }
}
