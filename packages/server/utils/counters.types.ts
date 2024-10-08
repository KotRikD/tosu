export interface ISettings {
    uniqueID: string;
    uniqueCheck?: string;
    type: ISettingsType;
    title: string;
    options?:
        | string[]
        | {
              required: boolean;
              type: 'text' | 'number' | 'checkbox' | 'options';
              name: string;
              title: string;
              description: string;
              values: string[];
              value: any;
          }[];
    description: string;
    value: any;
}

export type ISettingsCompact = { [key: string]: any };

export type ISettingsType =
    | 'text'
    | 'color'
    | 'number'
    | 'checkbox'
    | 'button'
    | 'options'
    | 'commands'
    | 'textarea'
    | 'password';

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
