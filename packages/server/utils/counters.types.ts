export interface ISettings {
    uniqueID: string;
    type: ISettingsType;
    title: string;
    options?: any[];
    description: string;
    value: any;
}

export type ISettingsCompact = { [key: string]: any };

export type ISettingsType =
    | 'text'
    | 'number'
    | 'password'
    | 'checkbox'
    | 'options'
    | 'color'
    | 'note';

export interface ICounter {
    _downloaded?: boolean;
    _updatable?: boolean;
    _settings?: boolean;
    folderName: string;
    name: string;
    author: string;
    version: string;
    resolution: number[];
    authorlinks: string[];
    settings: ISettings[];

    usecase?: string;
    compatiblewith?: string;
    assets?: {
        type: string;
        url: string;
    }[];
    downloadLink?: string;
}

export interface bodyPayload {
    uniqueID: string;
    value: any;
}
