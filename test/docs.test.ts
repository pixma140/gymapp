import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const agents = read('AGENTS.md');
const readme = read('README.md');
const scripts = Object.keys(JSON.parse(read('package.json')).scripts as Record<string, string>);

function walk(dir: string, match: (file: string) => boolean): string[] {
    return readdirSync(path.join(root, dir)).flatMap(entry => {
        const relative = path.posix.join(dir, entry);
        if (statSync(path.join(root, relative)).isDirectory()) return walk(relative, match);
        return match(relative) ? [relative] : [];
    });
}

describe('documentation stays in sync with the repository', () => {
    it('names every Vitest and Playwright file in the AGENTS.md test inventory', () => {
        const testFiles = [
            ...walk('server', file => /\.test\.js$/.test(file)),
            ...walk('test', file => /\.(test\.ts|spec\.ts)$/.test(file)),
        ];
        expect(testFiles.length).toBeGreaterThan(0);
        const missing = testFiles.filter(file => !agents.includes(`\`${file}\``));
        expect(missing, 'add these files to the Tests section of AGENTS.md').toEqual([]);
    });

    it('only documents npm scripts that exist in package.json', () => {
        for (const [name, doc] of [['AGENTS.md', agents], ['README.md', readme]]) {
            const referenced = [...doc.matchAll(/npm run ([a-z0-9:_-]+)/g)].map(match => match[1]);
            const unknown = referenced.filter(script => !scripts.includes(script));
            expect(unknown, `${name} references scripts missing from package.json`).toEqual([]);
        }
    });

    it('keeps only the leading Markdown documents in the tree', () => {
        const allowed = ['AGENTS.md', 'ARCHITECTURE.md', 'README.md', 'RELEASE_NOTES.md', 'THIRD_PARTY_NOTICES.md'];
        const rootMarkdown = readdirSync(root).filter(entry => entry.endsWith('.md'));
        expect(rootMarkdown.sort()).toEqual(allowed);
        expect(readdirSync(root)).not.toContain('docs');
    });
});
