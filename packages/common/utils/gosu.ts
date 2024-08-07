import fs from 'fs';
import path from 'path';

import { getProgramPath } from './directories';

export const checkGameOverlayConfig = () => {
    const configPath = path.join(getProgramPath(), 'config.ini');
    if (fs.existsSync(configPath)) return;
    fs.writeFileSync(
        configPath,
        `[GameOverlay]; https://github.com/l3lackShark/gosumemory/wiki/GameOverlay
gameWidth = 1920
gameHeight = 1080
overlayURL = 
overlayWidth = 380
overlayHeight = 110
overlayOffsetX = 0
overlayOffsetY = 0
overlayScale = 10`
    );
};
