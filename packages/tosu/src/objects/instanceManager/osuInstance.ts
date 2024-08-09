import { config, sleep, wLogger } from '@tosu/common';
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
import { DataRepo, DataRepoList } from '@/entities/DataRepoList';
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
    chatCheckerPtr: {
        pattern: '83 3D ?? ?? ?? ?? 00 75 ?? 80 3D',
        offset: 0x2
    },
    skinDataAddr: {
        pattern: '74 2C 85 FF 75 28 A1 ?? ?? ?? ?? 8D 15'
    },
    settingsClassAddr: {
        pattern: '83 E0 20 85 C0 7E 2F'
    },
    configurationAddr: {
        pattern: '7E 07 8D 65 F8 5E 5F 5D C3 E8',
        offset: -0xd
    },
    bindingsAddr: {
        pattern: '8D 7D D0 B9 08 00 00 00 33 C0 F3 AB 8B CE 89 4D DC B9',
        offset: 0x2a
    },
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
        pattern: 'C8 FF ?? ?? ?? ?? ?? 81 0D ?? ?? ?? ?? ?? 08 00 00',
        offset: 0x9
    },
    getAudioLengthPtr: {
        pattern: '55 8B EC 83 EC 08 A1 ?? ?? ?? ?? 85 C0',
        offset: 0x7
    },
    userProfilePtr: {
        pattern: 'FF 15 ?? ?? ?? ?? A1 ?? ?? ?? ?? 8B 48 54 33 D2',
        offset: 0x7
    },
    rawLoginStatusPtr: {
        pattern: 'B8 0B 00 00 8B 35',
        offset: -0xb
    },
    spectatingUserPtr: {
        pattern: '8B 0D ?? ?? ?? ?? 85 C0 74 05 8B 50 30',
        offset: -0x4
    },
    gameTimePtr: {
        pattern: 'A1 ?? ?? ?? ?? 89 46 04 8B D6 E8',
        offset: 0x1
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
    previousMP3Length: number = 0;
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
        this.entities.set('settings', new Settings(this));
        this.entities.set('allTimesData', new AllTimesData(this));
        this.entities.set('beatmapPpData', new BeatmapPPData(this));
        this.entities.set('menuData', new MenuData(this));
        this.entities.set('bassDensityData', new BassDensityData(this));
        this.entities.set('gamePlayData', new GamePlayData(this));
        this.entities.set('resultsScreenData', new ResultsScreenData(this));
        this.entities.set(
            'tourneyUserProfileData',
            new TourneyUserProfileData(this)
        );
        this.entities.set('tourneyManagerData', new TourneyManagerData(this));
        this.entities.set('userProfile', new UserProfile(this));

        this.watchProcessHealth = this.watchProcessHealth.bind(this);
        this.updatePreciseData = this.updatePreciseData.bind(this);
    }

    setTourneyIpcId(ipcId: number) {
        this.ipcId = ipcId;
    }

    setIsTourneySpectator(newVal: boolean) {
        this.isTourneySpectator = newVal;
    }

    async start() {
        wLogger.info(`[${this.pid}] Running memory chimera...`);
        while (!this.isReady) {
            const patternsRepo = this.entities.get('patterns');
            if (!patternsRepo) {
                throw new Error(
                    'Bases repo not initialized, missed somewhere?'
                );
            }

            try {
                const s1 = performance.now();

                const results = this.process.scanBatch(
                    Object.values(SCAN_PATTERNS).map((x) => x.pattern)
                );

                const indexToKey = Object.keys(SCAN_PATTERNS);

                for (let i = 0; i < results.length; i++) {
                    const baseKey = indexToKey[
                        results[i].index
                    ] as keyof PatternData;

                    patternsRepo.setPattern(
                        baseKey,
                        results[i].address +
                            (SCAN_PATTERNS[baseKey].offset || 0)
                    );
                }

                wLogger.debug(
                    `[${this.pid}] Took ${(performance.now() - s1).toFixed(2)} ms to scan patterns`
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
        this.initPreciseData();
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
        } = this.getServices([
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
                const menuUpdate = menuData.updateState();
                if (menuUpdate === 'not-ready') {
                    await sleep(config.pollRate);
                    continue;
                }

                // osu! calculates audioTrack length a little bit after updating menuData, sooo.. lets this thing run regardless of menuData updating
                if (menuData.Folder !== '' && menuData.Folder !== null) {
                    menuData.updateMP3Length();
                }

                if (!allTimesData.GameFolder) {
                    allTimesData.setGameFolder(this.path);

                    // condition when user have different BeatmapDirectory in osu! config
                    if (fs.existsSync(allTimesData.MemorySongsFolder)) {
                        allTimesData.setSongsFolder(
                            allTimesData.MemorySongsFolder
                        );
                    } else {
                        allTimesData.setSongsFolder(
                            path.join(this.path, allTimesData.MemorySongsFolder)
                        );
                    }
                }

                // update important data before doing rest
                if (allTimesData.Status === 7) {
                    const resultUpdate = resultsScreenData.updateState();
                    if (resultUpdate === 'not-ready') {
                        await sleep(config.pollRate);
                        continue;
                    }
                }

                settings.updateState();

                const currentMods =
                    allTimesData.Status === 2
                        ? gamePlayData.Mods
                        : allTimesData.Status === 7
                          ? resultsScreenData.Mods
                          : allTimesData.MenuMods;

                const currentState = `${menuData.MD5}:${menuData.MenuGameMode}:${currentMods}`;
                const updateGraph =
                    this.previousState !== currentState ||
                    this.previousMP3Length !== menuData.MP3Length;
                if (
                    menuData.Path?.endsWith('.osu') &&
                    allTimesData.GameFolder &&
                    this.previousState !== currentState
                ) {
                    const metadataUpdate =
                        beatmapPpData.updateMapMetadata(currentMods);
                    if (metadataUpdate === 'not-ready') {
                        await sleep(config.pollRate);
                        continue;
                    }
                    beatmapPpData.updateGraph(currentMods);
                    this.previousState = currentState;
                }

                if (
                    menuData.Path?.endsWith('.osu') &&
                    allTimesData.GameFolder &&
                    updateGraph
                ) {
                    beatmapPpData.updateGraph(currentMods);
                    this.previousMP3Length = menuData.MP3Length;
                }

                switch (allTimesData.Status) {
                    case 0:
                        bassDensityData.updateState();
                        break;

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
                            gamePlayData.init(undefined, '4,5');
                            resultsScreenData.init();
                            beatmapPpData.resetCurrentAttributes();
                        }

                        // Reset ResultScreen if we in song select
                        if (resultsScreenData.PlayerName) {
                            resultsScreenData.init();
                        }
                        break;

                    case 2:
                        // Reset gameplay data on retry
                        if (this.previousTime > allTimesData.PlayTime) {
                            gamePlayData.init(true);
                            beatmapPpData.resetCurrentAttributes();
                        }

                        // reset before first object
                        if (
                            allTimesData.PlayTime <
                            beatmapPpData.timings.firstObj
                        ) {
                            gamePlayData.resetQuick();
                        }

                        this.previousTime = allTimesData.PlayTime;

                        gamePlayData.updateState();
                        break;

                    case 7:
                        resultsScreenData.updatePerformance();
                        break;

                    case 22:
                        if (!this.isTourneyManager) {
                            this.isTourneyManager = true;
                        }
                        await tourneyManagerData.updateState();
                        break;

                    // do not spam reset on multiplayer and direct
                    case 11:
                    case 12:
                    case 15:
                        break;

                    default:
                        gamePlayData.init(
                            undefined,
                            `default-${allTimesData.Status}`
                        );
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

    initPreciseData() {
        wLogger.debug('OI(updatePreciseData) starting');

        const { allTimesData, gamePlayData } = this.getServices([
            'allTimesData',
            'gamePlayData'
        ]);

        this.updatePreciseData(allTimesData, gamePlayData);
    }

    updatePreciseData(allTimesData: AllTimesData, gamePlayData: GamePlayData) {
        if (this.isDestroyed === true) return;
        allTimesData.updatePreciseState();

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

    watchProcessHealth() {
        if (this.isDestroyed === true) return;

        if (!Process.isProcessExist(this.process.handle)) {
            this.isDestroyed = true;
            wLogger.warn(
                `OI(watchProcessHealth) osu!.exe at ${this.pid} got destroyed `
            );
            this.emitter.emit('onDestroy', this.pid);
        }

        setTimeout(this.watchProcessHealth, config.pollRate);
    }

    getState(instanceManager: InstanceManager) {
        return buildResult(instanceManager);
    }

    getStateV2(instanceManager: InstanceManager) {
        return buildResultV2(instanceManager);
    }

    getPreciseData(instanceManager: InstanceManager) {
        return buildResultV2Precise(instanceManager);
    }

    /**
     * Returns map of requested services\
     * Throws if any of requested services is not currently present
     */
    getServices<T extends (keyof DataRepoList)[]>(
        services: T
    ): Pick<DataRepoList, T[number]> | never {
        return services.reduce(
            (acc, item: keyof Pick<DataRepoList, T[number]>) => {
                const instance = this.entities.get(item);
                if (!instance || instance === null) {
                    throw new Error(
                        `Service "${item}" was not set in DataRepo list`
                    );
                }
                acc[item] = instance as never;
                return acc;
            },
            {} as Pick<DataRepoList, T[number]>
        );
    }
}
