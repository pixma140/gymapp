/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GIT_COMMIT: string;
    readonly VITE_RELEASE_TAG: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
