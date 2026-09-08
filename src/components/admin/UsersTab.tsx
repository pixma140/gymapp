import { useEffect, useMemo, useState } from 'react';
import { Shield, ShieldOff, Trash2, User as UserIcon, KeyRound, UserPlus, Search } from 'lucide-react';
import {
    createAdminUser,
    deleteAdminUser,
    getAdminUsers,
    resetUserPassword,
    setUserAdmin,
    type AdminUser
} from '@/auth/admin';
import { useLanguage } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';

type RoleFilter = 'all' | 'admins' | 'users';

const labelClass = 'block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2';
const inputClass = 'w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors';

export function UsersTab() {
    const { t, language } = useLanguage();

    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [successKey, setSuccessKey] = useState<TranslationKey | null>(null);

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

    // Create-user form state.
    const [showCreate, setShowCreate] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newIsAdmin, setNewIsAdmin] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Inline password-reset state.
    const [resetId, setResetId] = useState<number | null>(null);
    const [resetPassword, setResetPassword] = useState('');

    const loadUsers = async () => {
        const result = await getAdminUsers();
        if (result.ok && result.users) {
            setUsers(result.users);
        } else {
            setErrorKey('admin.users.error.generic');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        void loadUsers();
    }, []);

    const errorKeyForCode = (code?: string): TranslationKey => {
        if (code === 'last_admin') return 'admin.users.error.last_admin';
        if (code === 'cannot_demote_self') return 'admin.users.error.cannot_demote_self';
        if (code === 'cannot_delete_self') return 'admin.users.error.cannot_delete_self';
        if (code === 'invalid_input') return 'admin.users.error.invalid_input';
        if (code === 'username_taken') return 'admin.users.error.username_taken';
        if (code === 'invalid_password') return 'admin.users.error.invalid_password';
        if (code === 'no_password_auth') return 'admin.users.error.no_password_auth';
        return 'admin.users.error.generic';
    };

    const formatDate = (ts: number | null) =>
        ts
            ? new Date(ts).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
              })
            : null;

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return users.filter((user) => {
            if (roleFilter === 'admins' && !user.isAdmin) return false;
            if (roleFilter === 'users' && user.isAdmin) return false;
            if (!query) return true;
            return [user.name, user.username, user.email]
                .filter(Boolean)
                .some((field) => String(field).toLowerCase().includes(query));
        });
    }, [users, search, roleFilter]);

    const resetMessages = () => {
        setErrorKey(null);
        setSuccessKey(null);
    };

    const handleToggleAdmin = async (user: AdminUser) => {
        resetMessages();
        setPendingId(user.id);

        try {
            const result = await setUserAdmin(user.id, !user.isAdmin);
            if (!result.ok) {
                setErrorKey(errorKeyForCode(result.error));
                return;
            }
            await loadUsers();
        } catch {
            setErrorKey('admin.users.error.generic');
        } finally {
            setPendingId(null);
        }
    };

    const handleDelete = async (user: AdminUser) => {
        if (!window.confirm(t('admin.users.delete.confirm'))) {
            return;
        }

        resetMessages();
        setPendingId(user.id);

        try {
            const result = await deleteAdminUser(user.id);
            if (!result.ok) {
                setErrorKey(errorKeyForCode(result.error));
                return;
            }
            await loadUsers();
        } catch {
            setErrorKey('admin.users.error.generic');
        } finally {
            setPendingId(null);
        }
    };

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        resetMessages();
        setIsCreating(true);

        try {
            const result = await createAdminUser({
                username: newUsername.trim(),
                password: newPassword,
                name: newName.trim(),
                email: newEmail.trim() || undefined,
                isAdmin: newIsAdmin
            });

            if (!result.ok) {
                setErrorKey(errorKeyForCode(result.error));
                return;
            }

            setNewUsername('');
            setNewPassword('');
            setNewName('');
            setNewEmail('');
            setNewIsAdmin(false);
            setShowCreate(false);
            setSuccessKey('admin.users.create.success');
            await loadUsers();
        } catch {
            setErrorKey('admin.users.error.generic');
        } finally {
            setIsCreating(false);
        }
    };

    const handleResetPassword = async (event: React.FormEvent, user: AdminUser) => {
        event.preventDefault();
        resetMessages();
        setPendingId(user.id);

        try {
            const result = await resetUserPassword(user.id, resetPassword);
            if (!result.ok) {
                setErrorKey(errorKeyForCode(result.error));
                return;
            }
            setResetId(null);
            setResetPassword('');
            setSuccessKey('admin.users.password.success');
        } catch {
            setErrorKey('admin.users.error.generic');
        } finally {
            setPendingId(null);
        }
    };

    if (isLoading) {
        return <div className="text-sm text-[var(--muted-foreground)] py-8 text-center">{t('common.loading')}</div>;
    }

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">{t('admin.users.title')}</h2>
                    <p className="text-sm text-[var(--muted-foreground)] mt-1">{t('admin.users.desc')}</p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        resetMessages();
                        setShowCreate((value) => !value);
                    }}
                    className="shrink-0 inline-flex items-center gap-2 bg-[var(--primary)] text-white rounded-xl px-3 py-2 text-sm font-semibold"
                >
                    <UserPlus className="size-4" />
                    {t('admin.users.create.toggle')}
                </button>
            </div>

            {errorKey && <p className="text-sm text-red-500">{t(errorKey)}</p>}
            {successKey && <p className="text-sm text-green-500">{t(successKey)}</p>}

            {showCreate && (
                <form
                    onSubmit={handleCreate}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-4"
                >
                    <h3 className="font-semibold text-[var(--foreground)]">{t('admin.users.create.title')}</h3>

                    <div>
                        <label className={labelClass}>{t('admin.users.create.name')}</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            className={inputClass}
                            autoComplete="off"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>{t('admin.users.create.username')}</label>
                        <input
                            type="text"
                            value={newUsername}
                            onChange={(event) => setNewUsername(event.target.value)}
                            className={inputClass}
                            autoComplete="off"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>{t('admin.users.create.password')}</label>
                        <input
                            type="text"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            className={inputClass}
                            autoComplete="off"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>
                            {t('admin.users.create.email')} <span className="lowercase font-normal">({t('common.optional')})</span>
                        </label>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(event) => setNewEmail(event.target.value)}
                            className={inputClass}
                            autoComplete="off"
                        />
                    </div>

                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                        <span className="text-sm font-medium text-[var(--foreground)]">
                            {t('admin.users.create.isAdmin')}
                        </span>
                        <input
                            type="checkbox"
                            checked={newIsAdmin}
                            onChange={(event) => setNewIsAdmin(event.target.checked)}
                            className="size-5 accent-[var(--primary)]"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={isCreating}
                        className="w-full bg-[var(--primary)] disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
                    >
                        {isCreating ? t('admin.users.create.creating') : t('admin.users.create.submit')}
                    </button>
                </form>
            )}

            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="size-4 text-[var(--muted-foreground)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('admin.users.search')}
                        className={`${inputClass} pl-9`}
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                    className="bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
                >
                    <option value="all">{t('admin.users.filter.all')}</option>
                    <option value="admins">{t('admin.users.filter.admins')}</option>
                    <option value="users">{t('admin.users.filter.users')}</option>
                </select>
            </div>

            <p className="text-xs text-[var(--muted-foreground)]">
                {filtered.length} {t('admin.users.count')}
            </p>

            {users.length === 0 ? (
                <div className="text-sm text-[var(--muted-foreground)] py-8 text-center">{t('admin.users.empty')}</div>
            ) : filtered.length === 0 ? (
                <div className="text-sm text-[var(--muted-foreground)] py-8 text-center">{t('admin.users.noResults')}</div>
            ) : (
                <ul className="space-y-3">
                    {filtered.map((user) => {
                        const isBusy = pendingId === user.id;
                        const lastLogin = formatDate(user.lastLoginAt);
                        const created = formatDate(user.createdAt);
                        return (
                            <li
                                key={user.id}
                                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-[var(--foreground)] truncate">
                                            {user.name || user.username || `#${user.id}`}
                                        </span>
                                        {user.isSelf && (
                                            <span className="text-xs text-[var(--muted-foreground)]">
                                                ({t('admin.users.you')})
                                            </span>
                                        )}
                                    </div>
                                    {user.username && (
                                        <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                                            @{user.username}
                                        </p>
                                    )}
                                    {user.email && (
                                        <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                                            {user.email}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span
                                            className={
                                                user.isAdmin
                                                    ? 'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--primary)] text-white'
                                                    : 'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]'
                                            }
                                        >
                                            {user.isAdmin ? <Shield className="size-3" /> : <UserIcon className="size-3" />}
                                            {user.isAdmin ? t('admin.users.role.admin') : t('admin.users.role.user')}
                                        </span>
                                        <span className="text-xs text-[var(--muted-foreground)]">
                                            {user.authType === 'oidc'
                                                ? t('admin.users.auth.oidc')
                                                : t('admin.users.auth.password')}
                                        </span>
                                    </div>
                                    <div className="mt-2 space-y-0.5">
                                        <p className="text-xs text-[var(--muted-foreground)]">
                                            {t('admin.users.lastLogin')}:{' '}
                                            {lastLogin ?? t('admin.users.lastLogin.never')}
                                        </p>
                                        <p className="text-xs text-[var(--muted-foreground)]">
                                            {t('admin.users.created')}: {created ?? '—'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleAdmin(user)}
                                        disabled={isBusy || (user.isSelf && user.isAdmin)}
                                        className="flex-1 inline-flex items-center justify-center gap-2 border border-[var(--border)] bg-[var(--input)] hover:bg-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-2 text-sm font-medium text-[var(--foreground)] transition-colors"
                                    >
                                        {user.isAdmin ? <ShieldOff className="size-4" /> : <Shield className="size-4" />}
                                        {user.isAdmin ? t('admin.users.demote') : t('admin.users.promote')}
                                    </button>
                                    {user.authType === 'password' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                resetMessages();
                                                setResetPassword('');
                                                setResetId((current) => (current === user.id ? null : user.id));
                                            }}
                                            title={t('admin.users.password.toggle')}
                                            className="shrink-0 border border-[var(--border)] bg-[var(--input)] hover:bg-[var(--accent)] rounded-xl p-2 text-[var(--muted-foreground)] transition-colors"
                                        >
                                            <KeyRound className="size-4" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(user)}
                                        disabled={isBusy || user.isSelf}
                                        title={t('admin.users.delete')}
                                        className="shrink-0 border border-[var(--border)] bg-[var(--input)] hover:bg-red-500/10 hover:border-red-500/40 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl p-2 text-red-500 transition-colors"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>

                                {resetId === user.id && (
                                    <form
                                        onSubmit={(event) => handleResetPassword(event, user)}
                                        className="flex items-center gap-2 pt-1"
                                    >
                                        <input
                                            type="text"
                                            value={resetPassword}
                                            onChange={(event) => setResetPassword(event.target.value)}
                                            placeholder={t('admin.users.password.placeholder')}
                                            className={inputClass}
                                            autoComplete="off"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isBusy}
                                            className="shrink-0 bg-[var(--primary)] disabled:opacity-50 text-white rounded-xl px-3 py-3 text-sm font-semibold"
                                        >
                                            {t('admin.users.password.submit')}
                                        </button>
                                    </form>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
