import { TABLE_COLUMNS } from '../../shared/syncSchema.js';

// Projects an arbitrary client-supplied object down to the whitelisted columns
// for a given table, dropping unknown keys and undefined values. Returns an
// empty object for unknown tables.
export function pickAllowedColumns(table, source) {
    const allowed = TABLE_COLUMNS[table];
    if (!allowed) {
        return {};
    }

    const entries = Object.entries(source ?? {}).filter(
        ([key, value]) => allowed.includes(key) && value !== undefined
    );
    return Object.fromEntries(entries);
}
