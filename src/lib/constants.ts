import { version } from '../../package.json';

export const APP_VERSION = version;
export const APP_COMMIT = import.meta.env.VITE_GIT_COMMIT;
export const APP_RELEASE_URL = `https://github.com/pixma140/gymapp/releases/tag/v${APP_VERSION}`;
