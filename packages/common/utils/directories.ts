import fs from 'fs';
import path from 'path';

import { config } from './config';

export function recursiveFilesSearch({
    _ignoreFileName,
    dir,
    filename,
    fileList
}: {
    _ignoreFileName?: string;
    dir: string;
    filename: string;
    fileList: { filePath: string; created: number }[];
}) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        if (file.startsWith('.')) return;

        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            if (_ignoreFileName) {
                const ignoreFilePath = path.join(filePath, _ignoreFileName);
                if (fs.existsSync(ignoreFilePath)) {
                    return;
                }
            }

            recursiveFilesSearch({ dir: filePath, filename, fileList });
        } else if (filePath.includes(filename)) {
            const stats = fs.statSync(filePath);

            fileList.push({ filePath, created: stats.mtimeMs });
        }
    });

    fileList.sort((a, b) => a.created - b.created);

    return fileList.map((r) => r.filePath);
}

export function getStaticPath() {
    let staticPath =
        config.staticFolderPath || path.join(getProgramPath(), 'static');

    // replace ./static with normal path to the static with program path
    if (
        staticPath.toLowerCase() === './static' ||
        staticPath.toLowerCase() === '.\\static'
    )
        staticPath = path.join(getProgramPath(), 'static');

    return path.resolve(staticPath);
}

export function getCachePath() {
    return path.join(getProgramPath(), '.cache');
}

export function getProgramPath() {
    if ('pkg' in process) return path.dirname(process.execPath);
    return process.cwd();
}

export function getSettingsPath(folderName: string) {
    if (!folderName) return '';

    const settingsFolderPath = path.join(getProgramPath(), 'settings');
    if (!fs.existsSync(settingsFolderPath))
        fs.mkdirSync(settingsFolderPath, { recursive: true });

    const folderPath = path.join(
        settingsFolderPath,
        `${folderName}.values.json`
    );
    return folderPath;
}
