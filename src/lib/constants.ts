import { version } from '../../package.json';

export const APP_VERSION = version;
const APP_COMMIT_SHA = import.meta.env.VITE_GIT_COMMIT;
export const APP_COMMIT = APP_COMMIT_SHA.slice(0, 7);
export const APP_RELEASE_TAG = import.meta.env.VITE_RELEASE_TAG || `v${APP_VERSION}`;
export const APP_RELEASE_URL = `https://github.com/pixma140/gymapp/releases/tag/${encodeURIComponent(APP_RELEASE_TAG)}`;
export const APP_COMMIT_URL = `https://github.com/pixma140/gymapp/commit/${encodeURIComponent(APP_COMMIT_SHA)}`;
