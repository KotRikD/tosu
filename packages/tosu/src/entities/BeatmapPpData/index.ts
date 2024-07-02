import { config, wLogger } from '@tosu/common';
import fs from 'fs';
import { Beatmap as ParsedBeatmap } from 'osu-classes';
import { BeatmapDecoder } from 'osu-parsers';
import path from 'path';
import rosu from 'rosu-pp-js';

import { BeatmapStrains } from '@/api/types/v1';
import { AbstractEntity } from '@/entities/AbstractEntity';
import { OsuInstance } from '@/objects/instanceManager/osuInstance';
import { fixDecimals } from '@/utils/converters';

interface BeatmapPPAcc {
    '100': number;
    '99': number;
    '98': number;
    '97': number;
    '96': number;
    '95': number;
}

interface BeatmapPPAttributes {
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
    beatmapContent?: string;
    strains: number[];
    strainsAll: BeatmapStrains;
    commonBPM: number;
    minBPM: number;
    maxBPM: number;
    ppAcc: BeatmapPPAcc;
    calculatedMapAttributes: BeatmapPPAttributes;
    currAttributes: BeatmapPPCurrentAttributes;
    timings: BeatmapPPTimings;

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
        this.timings = {
            firstObj: 0,
            full: 0
        };
    }

    updatePPData(
        strains: number[],
        strainsAll: BeatmapStrains,
        ppAcc: BeatmapPPAcc,
        mapAttributes: BeatmapPPAttributes
    ) {
        this.strains = strains;
        this.strainsAll = strainsAll;
        if (config.calculatePP) {
            this.ppAcc = ppAcc;
        }
        this.calculatedMapAttributes = mapAttributes;
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

        this.currAttributes = {
            ...this.currAttributes,
            stars,
            pp,
            maxThisPlayPP
        };
    }

    updateFcPP(fcPP: number) {
        this.currAttributes = {
            ...this.currAttributes,
            fcPP
        };
    }

    updateBPM(commonBPM: number, minBPM: number, maxBPM: number) {
        this.commonBPM = Math.round(commonBPM);
        this.minBPM = Math.round(minBPM);
        this.maxBPM = Math.round(maxBPM);
    }

    updateTimings(firstObj: number, full: number) {
        this.timings = {
            firstObj,
            full
        };
    }

    resetCurrentAttributes() {
        this.currAttributes = {
            stars: 0.0,
            pp: 0.0,
            maxThisPlayPP: 0.0,
            fcPP: 0.0
        };
    }

    getCurrentBeatmap() {
        return this.beatmap;
    }

    updateMapMetadata(currentMods: number) {
        try {
            const startTime = performance.now();

            const { menuData, allTimesData } = this.osuInstance.getServices([
                'menuData',
                'allTimesData'
            ]);

            const mapPath = path.join(
                allTimesData.SongsFolder,
                menuData.Folder,
                menuData.Path
            );

            try {
                this.beatmapContent = fs.readFileSync(mapPath, 'utf8');

                if (this.beatmap) this.beatmap.free();
                if (this.PerformanceAttributes)
                    this.PerformanceAttributes.free();
            } catch (error) {
                wLogger.debug(
                    `BPPD(updateMapMetadata) Can't get map: ${mapPath}`
                );
                return;
            }

            this.beatmap = new rosu.Beatmap(this.beatmapContent);

            const beatmapCheckTime = performance.now();
            const totalTime = (beatmapCheckTime - startTime).toFixed(2);
            wLogger.debug(
                `BPPD(updateMapMetadata) [${totalTime}ms] Spend on opening beatmap`
            );

            const difficulty = new rosu.Difficulty({ mods: currentMods });
            const attributes = new rosu.BeatmapAttributesBuilder({
                map: this.beatmap,
                mods: currentMods,
                mode: menuData.MenuGameMode
            }).build();

            const strains = difficulty.strains(this.beatmap);
            const fcPerformance = new rosu.Performance({
                mods: currentMods
            }).calculate(this.beatmap);

            this.PerformanceAttributes = fcPerformance;

            const ppAcc = {};
            for (const acc of [100, 99, 98, 97, 96, 95]) {
                const calculate = new rosu.Performance({
                    accuracy: acc
                }).calculate(fcPerformance);
                ppAcc[acc] = fixDecimals(calculate.pp);

                calculate.free();
            }

            const calculationTime = performance.now();
            wLogger.debug(
                `BPPD(updateMapMetadata) [${(
                    calculationTime - beatmapCheckTime
                ).toFixed(2)}ms] Spend on attributes & strains calculation`
            );

            const resultStrains: BeatmapStrains = {
                series: [],
                xaxis: []
            };

            let oldStrains: number[] = [];

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

                this.updateBPM(
                    bpm * attributes.clockRate,
                    bpmMin * attributes.clockRate,
                    bpmMax * attributes.clockRate
                );

                const firstObj = Math.round(
                    this.lazerBeatmap.hitObjects.at(0)?.startTime ?? 0
                );
                const full = Math.round(this.lazerBeatmap.totalLength);

                this.updateTimings(firstObj, full);

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
            const firstObjectTime =
                this.timings.firstObj / attributes.clockRate;
            const lastObjectTime =
                firstObjectTime + strainsAmount * sectionOffsetTime;
            const mp3LengthTime = menuData.MP3Length / attributes.clockRate;

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

            const graphProcessTime = performance.now();
            wLogger.debug(
                `BPPD(updateMapMetadata) [${(
                    graphProcessTime - beatmapParseTime
                ).toFixed(2)}ms] Spend on prcoessing graph strains`
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

            const endTime = performance.now();
            wLogger.debug(
                `BPPD(updateMapMetadata) [${(endTime - startTime).toFixed(
                    2
                )}ms] Total spent time`
            );

            this.updatePPData(oldStrains, resultStrains, ppAcc as never, {
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
            });

            this.Mode = strains.mode;

            difficulty.free();
            attributes.free();
            strains.free();

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
}
