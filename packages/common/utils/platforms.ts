export const platformResolver = (platform: string) => {
    let platformType = '';
    let platformFileType = '';
    let platformCommand = '';

    switch (platform) {
        case 'win32':
            platformType = 'windows';
            platformFileType = 'exe';
            platformCommand = 'start ""';
            break;

        case 'linux':
            platformType = 'linux';
            platformCommand = 'xdg-open';
            break;

        case 'darwin':
            platformType = 'macos';
            platformFileType = 'macos';
            platformCommand = 'open -R';
            break;
    }

    return { platformType, platformFileType, platformCommand };
};
