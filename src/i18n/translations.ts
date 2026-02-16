export type Language = 'en' | 'de';

export const translations = {
    en: {
        // Navigation
        'nav.training': 'Training',
        'nav.analysis': 'Analysis',
        'nav.profile': 'Profile',
        'nav.settings': 'Settings',

        // Settings
        'settings.title': 'Settings',
        'settings.subtitle': 'App configuration.',
        'settings.appearance': 'Appearance',
        'settings.appearance.desc': 'Dark mode enabled',
        'settings.language': 'Language',
        'settings.language.desc': 'Select your preferred language',
        'settings.theme': 'Theme',
        'settings.theme.desc': 'Customize app appearance',
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'theme.oled': 'OLED',
        'theme.system': 'System',
        'settings.reminders': 'Body Reminders',
        'settings.reminders.desc': 'How often to update stats',
        'settings.manage_gyms': 'Manage Gyms',
        'settings.manage_gyms.desc': 'Edit or remove gyms',
        'settings.manage_exercises': 'Manage Exercises',
        'settings.manage_exercises.desc': 'Add or edit exercises',
        'settings.reset': 'Reset Application',
        'settings.reset.desc': 'Clear all local data',
        'settings.reset.confirm': 'Are you sure? This will delete ALL workouts, stats, and gyms. This cannot be undone.',
        'settings.export': 'Export Data',
        'settings.export.desc': 'Download all data as JSON',

        // Onboarding
        'onboarding.welcome': 'Welcome',
        'onboarding.subtitle': 'Let\'s set up your profile to start tracking your progress.',
        'onboarding.name': 'My Name is',
        'onboarding.weight': 'Weight (kg)',
        'onboarding.height': 'Height (cm)',
        'onboarding.bodyFat': 'Body Fat % (Optional)',
        'onboarding.submit': 'Get Started',
        'onboarding.creating': 'Creating Profile...',
        'onboarding.language': 'Language',
        'onboarding.reminders': 'Body Measurement Reminders',
        'onboarding.reminders.desc': 'How often ensuring you update your stats?',
        'onboarding.reminders.never': 'Never',
        'onboarding.reminders.daily': 'Daily',
        'onboarding.reminders.weekly': 'Weekly',
        'onboarding.reminders.monthly': 'Monthly',

        // Profile
        'profile.title': 'Profile',
        'profile.subtitle': 'Manage your stats.',
        'profile.save': 'Save Profile',
        'profile.saving': 'Saving...',

        // Reminders
        'reminder.title': 'Time to update your stats!',
        'reminder.subtitle': 'It\'s been a while since your last measurement.',
        'reminder.action': 'Update',

        // Generic
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.loading': 'Loading...',
    },
    de: {
        // Navigation
        'nav.training': 'Training',
        'nav.analysis': 'Analyse',
        'nav.profile': 'Profil',
        'nav.settings': 'Einstellungen',

        // Settings
        'settings.title': 'Einstellungen',
        'settings.subtitle': 'App Konfiguration.',
        'settings.appearance': 'Erscheinungsbild',
        'settings.appearance.desc': 'Dunkelmodus aktiviert',
        'settings.language': 'Sprache',
        'settings.language.desc': 'Wähle deine bevorzugte Sprache',
        'settings.theme': 'Design',
        'settings.theme.desc': 'App-Erscheinungsbild anpassen',
        'theme.light': 'Hell',
        'theme.dark': 'Dunkel',
        'theme.oled': 'OLED',
        'theme.system': 'System',
        'settings.reminders': 'Körper-Erinnerungen',
        'settings.reminders.desc': 'Wie oft Statistiken aktualisieren',
        'settings.manage_gyms': 'Fitnessstudios verwalten',
        'settings.manage_gyms.desc': 'Studios bearbeiten oder löschen',
        'settings.manage_exercises': 'Übungen verwalten',
        'settings.manage_exercises.desc': 'Übungen hinzufügen oder bearbeiten',
        'settings.reset': 'App zurücksetzen',
        'settings.reset.desc': 'Alle lokalen Daten löschen',
        'settings.reset.confirm': 'Bist du sicher? Dies löscht ALLE Workouts, Statistiken und Studios. Dies kann nicht rückgängig gemacht werden.',
        'settings.export': 'Daten exportieren',
        'settings.export.desc': 'Alle Daten als JSON herunterladen',

        // Onboarding
        'onboarding.welcome': 'Willkommen',
        'onboarding.subtitle': 'Lass uns dein Profil einrichten, um deinen Fortschritt zu verfolgen.',
        'onboarding.name': 'Mein Name ist',
        'onboarding.weight': 'Gewicht (kg)',
        'onboarding.height': 'Größe (cm)',
        'onboarding.bodyFat': 'Körperfett % (Optional)',
        'onboarding.submit': 'Los geht\'s',
        'onboarding.creating': 'Profil wird erstellt...',
        'onboarding.language': 'Sprache',
        'onboarding.reminders': 'Körper-Erinnerungen',
        'onboarding.reminders.desc': 'Wie oft möchtest du daran erinnert werden?',
        'onboarding.reminders.never': 'Nie',
        'onboarding.reminders.daily': 'Täglich',
        'onboarding.reminders.weekly': 'Wöchentlich',
        'onboarding.reminders.monthly': 'Monatlich',

        // Profile
        'profile.title': 'Profil',
        'profile.subtitle': 'Verwalte deine Statistiken.',
        'profile.save': 'Profil speichern',
        'profile.saving': 'Speichert...',

        // Reminders
        'reminder.title': 'Zeit deine Statistiken zu aktualisieren!',
        'reminder.subtitle': 'Deine letzte Messung ist schon eine Weile her.',
        'reminder.action': 'Aktualisieren',

        // Generic
        'common.save': 'Speichern',
        'common.cancel': 'Abbrechen',
        'common.delete': 'Löschen',
        'common.edit': 'Bearbeiten',
        'common.loading': 'Laden...',
    }
};
