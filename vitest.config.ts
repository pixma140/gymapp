import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@shared': path.resolve(__dirname, './shared'),
        },
    },
    test: {
        environment: 'node',
        include: ['server/**/*.test.{js,ts}', 'test/**/*.test.{js,ts}'],
        env: {
            NODE_ENV: 'test',
        },
    },
});
