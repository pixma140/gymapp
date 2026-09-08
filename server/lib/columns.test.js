import { describe, it, expect } from 'vitest';
import { pickAllowedColumns } from './columns.js';

describe('pickAllowedColumns', () => {
    it('keeps only whitelisted columns for a table', () => {
        const result = pickAllowedColumns('gyms', {
            id: 5,
            userId: 1,
            name: 'Main Gym',
            location: 'Downtown',
            lastVisited: 123,
            visitCount: 4,
            isAdmin: 1, // not a gym column
            passwordHash: 'secret', // must never leak through
        });

        expect(result).toEqual({
            id: 5,
            userId: 1,
            name: 'Main Gym',
            location: 'Downtown',
            lastVisited: 123,
            visitCount: 4,
        });
        expect(result).not.toHaveProperty('isAdmin');
        expect(result).not.toHaveProperty('passwordHash');
    });

    it('drops undefined values but keeps null/0/empty string', () => {
        const result = pickAllowedColumns('userMeasurements', {
            id: 1,
            userId: 2,
            weight: 0,
            bodyFat: undefined,
            timestamp: 1000,
        });

        expect(result).toEqual({ id: 1, userId: 2, weight: 0, timestamp: 1000 });
        expect(result).not.toHaveProperty('bodyFat');
    });

    it('returns an empty object for unknown tables', () => {
        expect(pickAllowedColumns('sessions', { id: 1 })).toEqual({});
        expect(pickAllowedColumns('nope', { a: 1 })).toEqual({});
    });

    it('tolerates a null/undefined source', () => {
        expect(pickAllowedColumns('gyms', null)).toEqual({});
        expect(pickAllowedColumns('gyms', undefined)).toEqual({});
    });
});
