import rosu from '@kotrikd/rosu-pp';
import { config, wLogger } from '@tosu/common';
import fs from 'fs';
import { Beatmap as ParsedBeatmap } from 'osu-classes';
import { BeatmapDecoder } from 'osu-parsers';
import path from 'path';

import { BeatmapStrains } from '@/api/types/v1';
import { AbstractEntity } from '@/entities/AbstractEntity';
import { OsuInstance } from '@/objects/instanceManager/osuInstance';
import { fixDecimals } from '@/utils/converters';
import { OsuMods } from '@/utils/osuMods.types';

interface BeatmapPPAcc {
    '100': number;
    '99': number;
    '98': number;
    '97': number;
    '96': number;
    '95': number;
}

interface BeatmapAttributes {
    ar: number;
    cs: number;
    hp: number;
    od: number;
    circles: number;
    sliders: number;
    spinners: number;
    holds: number;
    maxCombo: number;
    fullStars: number;
    stars: number;
    aim?: number | undefined;
    speed?: number | undefined;
    flashlight?: number | undefined;
    sliderFactor?: number | undefined;
    stamina?: number | undefined;
    rhythm?: number | undefined;
    color?: number | undefined;
    peak?: number | undefined;
    hitWindow?: number | undefined;
}

interface BeatmapPPAttributes {
    ppAccuracy: number;
    ppAim: number;
    ppDifficulty: number;
    ppFlashlight: number;
    ppSpeed: number;
}

interface BeatmapPPCurrentAttributes {
    stars: number;
    pp: number;
    fcPP: number;
    maxThisPlayPP: number;
}

interface BeatmapPPTimings {
    firstObj: number;
    full: number;
}

export class BeatmapPPData extends AbstractEntity {
    beatmap?: rosu.Beatmap;
    lazerBeatmap?: ParsedBeatmap;
    PerformanceAttributes?: rosu.PerformanceAttributes;

    Mode: number;
    clockRate: number = 1;
    beatmapContent?: string;
    strains: number[];
    strainsAll: BeatmapStrains;
    realtimeBPM: number;
    commonBPM: number;
    minBPM: number;
    maxBPM: number;
    ppAcc: BeatmapPPAcc;
    calculatedMapAttributes: BeatmapAttributes;
    currAttributes: BeatmapPPCurrentAttributes = {
        stars: 0.0,
        pp: 0.0,
        maxThisPlayPP: 0.0,
        fcPP: 0.0
    };

    currPPAttributes: BeatmapPPAttributes = {
        ppAccuracy: 0.0,
        ppAim: 0.0,
        ppDifficulty: 0.0,
        ppFlashlight: 0.0,
        ppSpeed: 0.0
    };

    fcPPAttributes: BeatmapPPAttributes = {
        ppAccuracy: 0.0,
        ppAim: 0.0,
        ppDifficulty: 0.0,
        ppFlashlight: 0.0,
        ppSpeed: 0.0
    };

    timings: BeatmapPPTimings = {
        firstObj: 0,
        full: 0
    };

    constructor(osuInstance: OsuInstance) {
        super(osuInstance);

        this.init();
    }

    init() {
        this.strains = [];
        this.strainsAll = {
            series: [],
            xaxis: []
        };
        this.Mode = 0;
        this.realtimeBPM = 0.0;
        this.commonBPM = 0.0;
        this.minBPM = 0.0;
        this.maxBPM = 0.0;
        this.ppAcc = {
            100: 0.0,
            99: 0.0,
            98: 0.0,
            97: 0.0,
            96: 0.0,
            95: 0.0
        };
        this.calculatedMapAttributes = {
            ar: 0.0,
            cs: 0.0,
            hp: 0.0,
            od: 0.0,
            circles: 0,
            sliders: 0,
            spinners: 0,
            holds: 0,
            maxCombo: 0,
            fullStars: 0.0,
            stars: 0.0,
            aim: 0.0,
            speed: 0.0,
            flashlight: 0.0,
            sliderFactor: 0.0,
            stamina: 0.0,
            rhythm: 0.0,
            color: 0.0,
            peak: 0.0,
            hitWindow: 0.0
        };
        this.currAttributes = {
            stars: 0.0,
            pp: 0.0,
            maxThisPlayPP: 0.0,
            fcPP: 0.0
        };
        this.currPPAttributes = {
            ppAccuracy: 0.0,
            ppAim: 0.0,
            ppDifficulty: 0.0,
            ppFlashlight: 0.0,
            ppSpeed: 0.0
        };
        this.fcPPAttributes = {
            ppAccuracy: 0.0,
            ppAim: 0.0,
            ppDifficulty: 0.0,
            ppFlashlight: 0.0,
            ppSpeed: 0.0
        };
        this.timings = {
            firstObj: 0,
            full: 0
        };
    }

    updatePPAttributes(
        type: 'curr' | 'fc',
        attributes: rosu.PerformanceAttributes
    ) {
        try {
            if (type !== 'curr' && type !== 'fc') return;

            this[`${type}PPAttributes`] = {
                ppAccuracy: attributes.ppAccuracy || 0.0,
                ppAim: attributes.ppAim || 0.0,
                ppDifficulty: attributes.ppDifficulty || 0.0,
                ppFlashlight: attributes.ppFlashlight || 0.0,
                ppSpeed: attributes.ppSpeed || 0.0
            };
        } catch (exc) {
            wLogger.error(
                `BPPD(updatePPAttributes)-${type}`,
                (exc as any).message
            );
            wLogger.debug(`BPPD(updatePPAttributes)-${type}`, exc);
        }
    }

    updateCurrentAttributes(stars: number, pp: number) {
        if (this.currAttributes.pp.toFixed(2) !== pp.toFixed(2)) {
            wLogger.debug(
                `BPPD(updateCurrentAttributes) maxPP -> ${this.currAttributes.maxThisPlayPP.toFixed(
                    2
                )} pp -> ${pp.toFixed(2)} stars -> ${stars.toFixed(2)}`
            );
        }
        const maxThisPlayPP = Math.max(pp, this.currAttributes.maxThisPlayPP);

        this.currAttributes.stars = stars;
        this.currAttributes.pp = pp;
        this.currAttributes.maxThisPlayPP = maxThisPlayPP;
    }

    resetAttributes() {
        this.currAttributes = {
            stars: 0.0,
            pp: 0.0,
            maxThisPlayPP: 0.0,
            fcPP: this.ppAcc[100] || 0.0
        };

        this.currPPAttributes = {
            ppAccuracy: 0.0,
            ppAim: 0.0,
            ppDifficulty: 0.0,
            ppFlashlight: 0.0,
            ppSpeed: 0.0
        };
        this.fcPPAttributes = {
            ppAccuracy: 0.0,
            ppAim: 0.0,
            ppDifficulty: 0.0,
            ppFlashlight: 0.0,
            ppSpeed: 0.0
        };
    }

    getCurrentBeatmap() {
        return this.beatmap;
    }

    updateMapMetadata(currentMods: number, currentMode: number) {
        try {
            const startTime = performance.now();

            const { menuData, allTimesData } = this.osuInstance.getServices([
                'menuData',
                'allTimesData'
            ]);

            if (menuData.Folder === '') {
                wLogger.debug(
                    `BPPD(updateMapMetadata) Skip osu! music theme file`,
                    {
                        SongsFolder: allTimesData.SongsFolder,
                        Folder: menuData.Folder,
                        Path: menuData.Path
                    }
                );
                return;
            }

            const mapPath = path.join(
                allTimesData.SongsFolder,
                menuData.Folder,
                menuData.Path
            );

            try {
                this.beatmapContent = fs.readFileSync(mapPath, 'utf8');

                try {
                    if (this.beatmap) this.beatmap.free();
                } catch (exc) {
                    this.beatmap = undefined;
                    wLogger.debug(
                        `BPPD(updateMapMetadata) unable to free beatmap`,
                        exc
                    );
                }

                try {
                    if (this.PerformanceAttributes)
                        this.PerformanceAttributes.free();
                } catch (exc) {
                    this.PerformanceAttributes = undefined;
                    wLogger.debug(
                        `BPPD(updateMapMetadata) unable to free PerformanceAttributes`,
                        exc
                    );
                }
            } catch (error) {
                wLogger.debug(
                    `BPPD(updateMapMetadata) Can't get map`,
                    {
                        mapPath,
                        currentMods,
                        currentMode
                    },
                    (error as Error).stack
                );
                return 'not-ready';
            }

            this.beatmap = new rosu.Beatmap(this.beatmapContent);
            if (this.beatmap.mode === 0 && this.beatmap.mode !== currentMode)
                this.beatmap.convert(currentMode);

            const beatmapCheckTime = performance.now();
            const totalTime = (beatmapCheckTime - startTime).toFixed(2);
            wLogger.debug(
                `BPPD(updateMapMetadata) [${totalTime}ms] Spend on opening beatmap`
            );

            const difficulty = new rosu.Difficulty({ mods: currentMods });
            const attributes = new rosu.BeatmapAttributesBuilder({
                map: this.beatmap,
                mods: currentMods,
                mode: currentMode
            }).build();

            const fcPerformance = new rosu.Performance({
                mods: currentMods
            }).calculate(this.beatmap);

            this.PerformanceAttributes = fcPerformance;
            this.clockRate = attributes.clockRate;

            if (config.calculatePP) {
                const ppAcc = {};
                for (const acc of [100, 99, 98, 97, 96, 95]) {
                    const calculate = new rosu.Performance({
                        mods: currentMods,
                        accuracy: acc
                    }).calculate(fcPerformance);
                    ppAcc[acc] = fixDecimals(calculate.pp);

                    calculate.free();
                }

                this.ppAcc = ppAcc as any;
            }

            const calculationTime = performance.now();
            wLogger.debug(
                `BPPD(updateMapMetadata) [${(
                    calculationTime - beatmapCheckTime
                ).toFixed(2)}ms] Spend on attributes & strains calculation`
            );

            try {
                const decoder = new BeatmapDecoder();

                this.lazerBeatmap = decoder.decodeFromString(
                    this.beatmapContent,
                    {
                        parseEvents: true,
                        parseTimingPoints: true,
                        parseHitObjects: true,

                        parseColours: false,
                        parseEditor: false,
                        parseGeneral: false,
                        parseStoryboard: false,
                        parseMetadata: false
                    }
                );

                const { bpm, bpmMin, bpmMax } = this.lazerBeatmap;

                if (
                    this.lazerBeatmap.events.backgroundPath !==
                    menuData.BackgroundFilename
                ) {
                    menuData.BackgroundFilename =
                        this.lazerBeatmap.events.backgroundPath || '';
                }

                this.commonBPM = Math.round(bpm * this.clockRate);
                this.minBPM = Math.round(bpmMin * this.clockRate);
                this.maxBPM = Math.round(bpmMax * this.clockRate);

                const firstObj = Math.round(
                    this.lazerBeatmap.hitObjects.at(0)?.startTime ?? 0
                );
                const full = Math.round(this.lazerBeatmap.totalLength);

                this.timings.firstObj = firstObj;
                this.timings.full = full;

                this.resetReportCount('BPPD(updateMapMetadataTimings)');
            } catch (exc) {
                this.reportError(
                    'BPPD(updateMapMetadataTimings)',
                    10,
                    `BPPD(updateMapMetadataTimings) ${(exc as any).message}`
                );
                wLogger.debug(exc);
                return;
            }

            const beatmapParseTime = performance.now();
            wLogger.debug(
                `BPPD(updateMapMetadata) [${(
                    beatmapParseTime - calculationTime
                ).toFixed(2)}ms] Spend on parsing beatmap`
            );

            const endTime = performance.now();
            wLogger.debug(
                `BPPD(updateMapMetadata) [${(endTime - startTime).toFixed(
                    2
                )}ms] Total spent time`
            );

            this.calculatedMapAttributes = {
                ar: attributes.ar,
                cs: attributes.cs,
                od: attributes.od,
                hp: attributes.hp,
                circles: this.lazerBeatmap.hittable,
                sliders: this.lazerBeatmap.slidable,
                spinners: this.lazerBeatmap.spinnable,
                holds: this.lazerBeatmap.holdable,
                maxCombo: fcPerformance.difficulty.maxCombo,
                fullStars: fcPerformance.difficulty.stars,
                stars: fcPerformance.difficulty.stars,
                aim: fcPerformance.difficulty.aim,
                speed: fcPerformance.difficulty.speed,
                flashlight: fcPerformance.difficulty.flashlight,
                sliderFactor: fcPerformance.difficulty.sliderFactor,
                stamina: fcPerformance.difficulty.stamina,
                rhythm: fcPerformance.difficulty.rhythm,
                color: fcPerformance.difficulty.color,
                peak: fcPerformance.difficulty.peak,
                hitWindow: fcPerformance.difficulty.hitWindow
            };

            difficulty.free();
            attributes.free();

            this.resetReportCount('BPPD(updateMapMetadata)');
        } catch (exc) {
            this.reportError(
                'BPPD(updateMapMetadata)',
                10,
                `BPPD(updateMapMetadata) ${(exc as any).message}`
            );
            wLogger.debug(exc);
        }
    }

    updateGraph(currentMods: number) {
        if (this.beatmap === undefined) return;
        try {
            const startTime = performance.now();
            const { menuData } = this.osuInstance.getServices(['menuData']);

            const resultStrains: BeatmapStrains = {
                series: [],
                xaxis: []
            };

            const difficulty = new rosu.Difficulty({ mods: currentMods });
            const strains = difficulty.strains(this.beatmap);

            let oldStrains: number[] = [];

            let strainsAmount = 0;
            switch (strains.mode) {
                case 0:
                    strainsAmount = strains.aim?.length || 0;
                    break;

                case 1:
                    strainsAmount = strains.color?.length || 0;
                    break;

                case 2:
                    strainsAmount = strains.movement?.length || 0;
                    break;

                case 3:
                    strainsAmount = strains.strains?.length || 0;
                    break;
            }

            const sectionOffsetTime = strains.sectionLength;
            const firstObjectTime = this.timings.firstObj / this.clockRate;
            const lastObjectTime =
                firstObjectTime + strainsAmount * sectionOffsetTime;
            const mp3LengthTime = menuData.MP3Length / this.clockRate;

            const LEFT_OFFSET = Math.floor(firstObjectTime / sectionOffsetTime);
            const RIGHT_OFFSET =
                mp3LengthTime >= lastObjectTime
                    ? Math.ceil(
                          (mp3LengthTime - lastObjectTime) / sectionOffsetTime
                      )
                    : 0;

            const updateWithOffset = (
                name: string,
                values: Float64Array | undefined
            ) => {
                if (values instanceof Float64Array !== true) return;
                let data: number[] = [];

                if (Number.isFinite(LEFT_OFFSET) && LEFT_OFFSET > 0) {
                    data = Array(LEFT_OFFSET).fill(-100);
                }

                data = data.concat(Array.from(values));

                if (Number.isFinite(RIGHT_OFFSET) && RIGHT_OFFSET > 0) {
                    data = data.concat(Array(RIGHT_OFFSET).fill(-100));
                }

                resultStrains.series.push({ name, data });
            };

            switch (strains.mode) {
                case 0:
                    updateWithOffset('aim', strains.aim);
                    updateWithOffset('aimNoSliders', strains.aimNoSliders);
                    updateWithOffset('flashlight', strains.flashlight);
                    updateWithOffset('speed', strains.speed);

                    if (strains.aim instanceof Float64Array)
                        oldStrains = Array.from(strains.aim);
                    break;
                case 1:
                    updateWithOffset('color', strains.color);
                    updateWithOffset('rhythm', strains.rhythm);
                    updateWithOffset('stamina', strains.stamina);

                    if (strains.color instanceof Float64Array)
                        oldStrains = Array.from(strains.color);
                    break;
                case 2:
                    updateWithOffset('movement', strains.movement);

                    if (strains.movement instanceof Float64Array)
                        oldStrains = Array.from(strains.movement);
                    break;
                case 3:
                    updateWithOffset('strains', strains.strains);

                    if (strains.strains instanceof Float64Array)
                        oldStrains = Array.from(strains.strains);
                    break;
                default:
                // no-default
            }

            if (Number.isFinite(LEFT_OFFSET) && LEFT_OFFSET > 0) {
                oldStrains = Array(LEFT_OFFSET).fill(0).concat(oldStrains);
            }

            if (Number.isFinite(RIGHT_OFFSET) && RIGHT_OFFSET > 0) {
                oldStrains = oldStrains.concat(Array(RIGHT_OFFSET).fill(0));
            }

            const endTIme = performance.now();
            wLogger.debug(
                `BPPD(updateGraph) [${(endTIme - startTime).toFixed(2)}ms] Spend on processing graph strains`
            );

            for (let i = 0; i < LEFT_OFFSET; i++) {
                resultStrains.xaxis.push(i * sectionOffsetTime);
            }

            const total =
                resultStrains.series[0].data.length -
                LEFT_OFFSET -
                RIGHT_OFFSET;
            for (let i = 0; i < total; i++) {
                resultStrains.xaxis.push(
                    firstObjectTime + i * sectionOffsetTime
                );
            }

            for (let i = 0; i < RIGHT_OFFSET; i++) {
                resultStrains.xaxis.push(
                    lastObjectTime + i * sectionOffsetTime
                );
            }

            this.strains = oldStrains;
            this.strainsAll = resultStrains;
            this.Mode = strains.mode;

            strains.free();

            this.resetReportCount('BPPD(updateGraph)');
        } catch (exc) {
            this.reportError(
                'BPPD(updateGraph)',
                10,
                `BPPD(updateGraph) ${(exc as any).message}`
            );
            wLogger.debug(exc);
        }
    }

    updateEditorPP() {
        try {
            if (
                !this.beatmap ||
                !this.beatmapContent ||
                !this.PerformanceAttributes ||
                !this.lazerBeatmap
            ) {
                return;
            }

            const startTime = performance.now();

            const { allTimesData } = this.osuInstance.getServices([
                'allTimesData'
            ]);

            const beatmapParseTime = performance.now();
            const totalTime = (beatmapParseTime - startTime).toFixed(2);
            wLogger.debug(
                `(updateEditorPP) Spend:${totalTime}ms on beatmap parsing`
            );

            const passedObjects = this.lazerBeatmap.hitObjects.filter(
                (r) => r.startTime <= allTimesData.PlayTime
            );

            const curPerformance = new rosu.Performance({
                passedObjects: passedObjects.length
            }).calculate(this.PerformanceAttributes);

            const calculateTime = performance.now();

            this.currAttributes.pp = curPerformance.pp;
            this.currAttributes.stars =
                passedObjects.length === 0
                    ? 0
                    : curPerformance.difficulty.stars;

            wLogger.debug(
                `(updateEditorPP) Spend:${(
                    calculateTime - beatmapParseTime
                ).toFixed(2)}ms on calculating performance`
            );

            curPerformance.free();

            this.resetReportCount('BPPD(updateEditorPP)');
        } catch (exc) {
            this.reportError(
                'BPPD(updateEditorPP)',
                10,
                `BPPD(updateEditorPP) ${(exc as any).message}`
            );
            wLogger.debug(exc);
        }
    }

    updateRealTimeBPM(timeMS: number, mods: number) {
        if (!this.lazerBeatmap) return;

        const multiply =
            (mods & OsuMods.DoubleTime) === OsuMods.DoubleTime ||
            (mods & OsuMods.Nightcore) === OsuMods.Nightcore
                ? 1.5
                : (mods & OsuMods.HalfTime) === OsuMods.HalfTime
                  ? 0.75
                  : 1;
        const bpm =
            this.lazerBeatmap.controlPoints.timingPoints
                // @ts-ignore
                .toReversed()
                .find((r) => r.startTime <= timeMS && r.bpm !== 0)?.bpm ||
            this.lazerBeatmap.controlPoints.timingPoints[0]?.bpm ||
            0.0;

        this.realtimeBPM = Math.round(bpm * multiply);
    }
}
