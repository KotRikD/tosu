import rosu from '@kotrikd/rosu-pp';
import { wLogger } from '@tosu/common';

import { AbstractEntity } from '@/entities/AbstractEntity';
import { OsuInstance } from '@/objects/instanceManager/osuInstance';
import { calculateAccuracy, calculateGrade } from '@/utils/calculators';
import { netDateBinaryToDate } from '@/utils/converters';
import { OsuMods } from '@/utils/osuMods.types';

export class ResultsScreenData extends AbstractEntity {
    OnlineId: number;
    PlayerName: string;
    Mods: OsuMods;
    Mode: number;
    MaxCombo: number;
    Score: number;
    Hit100: number;
    Hit300: number;
    Hit50: number;
    HitGeki: number;
    HitKatu: number;
    HitMiss: number;
    Grade: string;
    Date: string;
    Accuracy: number;
    pp: number;
    fcPP: number;

    previousBeatmap: string;

    constructor(osuInstance: OsuInstance) {
        super(osuInstance);

        this.init();
    }

    init() {
        wLogger.debug('RSD(init) Reset');

        this.PlayerName = '';
        this.Mods = 0;
        this.Mode = 0;
        this.MaxCombo = 0;
        this.Score = 0;
        this.Hit100 = 0;
        this.Hit300 = 0;
        this.Hit50 = 0;
        this.HitGeki = 0;
        this.HitKatu = 0;
        this.HitMiss = 0;
        this.Grade = '';
        this.Date = '';
        this.Accuracy = 0;
        this.pp = 0;
        this.fcPP = 0;

        this.previousBeatmap = '';
    }

    updateState() {
        try {
            const { process, patterns, allTimesData } =
                this.osuInstance.getServices([
                    'process',
                    'patterns',
                    'allTimesData'
                ]);
            if (process === null) {
                throw new Error('Process not found');
            }
            if (patterns === null) {
                throw new Error('Bases repo not found');
            }
            if (allTimesData === null) {
                throw new Error('AllTimesData not found');
            }

            const { rulesetsAddr } = patterns.getPatterns(['rulesetsAddr']);

            const rulesetAddr = process.readInt(
                process.readInt(rulesetsAddr - 0xb) + 0x4
            );
            if (rulesetAddr === 0) {
                wLogger.debug('RSD(updateState) rulesetAddr is zero');
                return 'not-ready';
            }

            const resultScreenBase = process.readInt(rulesetAddr + 0x38);
            if (resultScreenBase === 0) {
                wLogger.debug('RSD(updateState) resultScreenBase is zero');
                return 'not-ready';
            }

            // OnlineId   int64   `mem:"[Ruleset + 0x38] + 0x4"`
            this.OnlineId = process.readLong(resultScreenBase + 0x4);
            // PlayerName string  `mem:"[[Ruleset + 0x38] + 0x28]"`
            this.PlayerName = process.readSharpString(
                process.readInt(resultScreenBase + 0x28)
            );
            // ModsXor1   int32   `mem:"[[Ruleset + 0x38] + 0x1C] + 0xC"` ^ ModsXor2   int32   `mem:"[[Ruleset + 0x38] + 0x1C] + 0x8"`
            this.Mods =
                process.readInt(
                    process.readInt(resultScreenBase + 0x1c) + 0xc
                ) ^
                process.readInt(process.readInt(resultScreenBase + 0x1c) + 0x8);
            // Mode       int32   `mem:"[Ruleset + 0x38] + 0x64"`
            this.Mode = process.readInt(resultScreenBase + 0x64);
            // MaxCombo   int16   `mem:"[Ruleset + 0x38] + 0x68"`
            this.MaxCombo = process.readShort(resultScreenBase + 0x68);
            // Score      int32   `mem:"[Ruleset + 0x38] + 0x78"`
            this.Score = process.readInt(resultScreenBase + 0x78);
            // Hit100     int16   `mem:"[Ruleset + 0x38] + 0x88"`
            this.Hit100 = process.readShort(resultScreenBase + 0x88);
            // Hit300     int16   `mem:"[Ruleset + 0x38] + 0x8A"`
            this.Hit300 = process.readShort(resultScreenBase + 0x8a);
            // Hit50      int16   `mem:"[Ruleset + 0x38] + 0x8C"`
            this.Hit50 = process.readShort(resultScreenBase + 0x8c);
            // HitGeki    int16   `mem:"[Ruleset + 0x38] + 0x8E"`
            this.HitGeki = process.readShort(resultScreenBase + 0x8e);
            // HitKatu    int16   `mem:"[Ruleset + 0x38] + 0x90"`
            this.HitKatu = process.readShort(resultScreenBase + 0x90);
            // HitMiss    int16   `mem:"[Ruleset + 0x38] + 0x92"`
            this.HitMiss = process.readShort(resultScreenBase + 0x92);

            const hits = {
                300: this.Hit300,
                geki: 0,
                100: this.Hit100,
                katu: 0,
                50: this.Hit50,
                0: this.HitMiss
            };

            this.Grade = calculateGrade({
                mods: this.Mods,
                mode: this.Mode,
                hits
            });

            this.Accuracy = calculateAccuracy({
                mode: this.Mode,
                hits
            });

            this.Date = netDateBinaryToDate(
                process.readInt(resultScreenBase + 0xa4),
                process.readInt(resultScreenBase + 0xa0)
            ).toISOString();

            this.resetReportCount('RSD(updateState)');
        } catch (exc) {
            this.reportError(
                'RSD(updateState)',
                10,
                `RSD(updateState) ${(exc as any).message}`
            );
            wLogger.debug(exc);
        }
    }

    updatePerformance() {
        try {
            const { beatmapPpData, menuData } = this.osuInstance.getServices([
                'beatmapPpData',
                'menuData'
            ]);

            const key = `${menuData.MD5}${this.Mods}${this.Mode}${this.PlayerName}`;
            if (this.previousBeatmap === key) {
                return;
            }

            const currentBeatmap = beatmapPpData.getCurrentBeatmap();
            if (!currentBeatmap) {
                wLogger.debug("RSD(updatePerformance) can't get current map");
                return;
            }

            const scoreParams: rosu.PerformanceArgs = {
                combo: this.MaxCombo,
                mods: this.Mods,
                misses: this.HitMiss,
                n50: this.Hit50,
                n100: this.Hit100,
                n300: this.Hit300,
                nKatu: this.HitKatu,
                nGeki: this.HitGeki
            };

            const curPerformance = new rosu.Performance(scoreParams).calculate(
                currentBeatmap
            );
            const fcPerformance = new rosu.Performance({
                mods: this.Mods,
                misses: 0,
                accuracy: this.Accuracy
            }).calculate(curPerformance);

            this.pp = curPerformance.pp;
            this.fcPP = fcPerformance.pp;

            curPerformance.free();
            fcPerformance.free();

            this.previousBeatmap = key;
            this.resetReportCount('RSD(updatePerformance)');
        } catch (exc) {
            this.reportError(
                'RSD(updatePerformance)',
                10,
                `RSD(updatePerformance) ${(exc as any).message}`
            );
            wLogger.debug(exc);
        }
    }
}
