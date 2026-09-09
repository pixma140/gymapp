import { version } from '../../package.json';

export const APP_VERSION = version;
export const APP_COMMIT = import.meta.env.VITE_GIT_COMMIT.slice(0, 7);
export const APP_RELEASE_TAG = import.meta.env.VITE_RELEASE_TAG || `v${APP_VERSION}`;
export const APP_RELEASE_URL = `https://github.com/pixma140/gymapp/releases/tag/${encodeURIComponent(APP_RELEASE_TAG)}`;
