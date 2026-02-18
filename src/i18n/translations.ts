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
        'settings.subtitle': 'App configuration',
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
        'settings.accentColor': 'Accent Color',
        'settings.accentColor.desc': 'Customize your main color',
        'settings.reminders.never': 'Never',
        'settings.reminders.daily': 'Daily',
        'settings.reminders.weekly': 'Weekly',
        'settings.reminders.monthly': 'Monthly',
        'settings.appVersion': 'Gym App',
        'settings.madeBy': 'made with ❤ by',

        // Language names
        'language.english': 'English',
        'language.german': 'German',

        // Colors
        'color.blue': 'Blue',
        'color.green': 'Green',
        'color.red': 'Red',
        'color.orange': 'Orange',
        'color.purple': 'Purple',
        'color.pink': 'Pink',
        'color.cyan': 'Cyan',
        'color.yellow': 'Yellow',

        // Training
        'training.title': 'Training',
        'training.subtitle.add': 'Add a new location',
        'training.subtitle.select': 'Select a gym to start',
        'training.activeWorkoutConfirmPrefix': 'You have an active workout at',
        'training.activeWorkoutConfirmSuffix': 'You must finish it before starting a new one. Go to active workout?',

        // Analysis
        'analysis.title': 'Analysis',
        'analysis.subtitle': 'Track your progress',
        'analysis.tab.workout': 'Workout Analysis',
        'analysis.tab.body': 'Body Analysis',
        'analysis.section.progress': 'Progress',
        'analysis.section.recent': 'Recent Workouts',
        'analysis.section.bodyMetrics': 'Body Metrics',
        'analysis.section.bodyMetrics.desc': 'Track your weight and body fat over time.',

        // Onboarding
        'onboarding.welcome': 'Welcome',
        'onboarding.subtitle': 'Let\'s set up your profile to start tracking your progress',
        'onboarding.name': 'My Name is',
        'onboarding.weight': 'Weight (kg)',
        'onboarding.height': 'Height (cm)',
        'onboarding.bodyFat': 'Body Fat % (Optional)',
        'onboarding.age': 'Age',
        'onboarding.gender': 'Gender',
        'onboarding.gender.male': 'Male',
        'onboarding.gender.female': 'Female',
        'onboarding.gender.other': 'Other',
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
        'profile.subtitle': 'Manage your stats',
        'profile.save': 'Save Profile',
        'profile.saving': 'Saving...',

        'profile.saveSuccess': 'Profile saved.',
        'profile.displayName': 'Display Name',
        'profile.weight': 'Weight',
        'profile.bodyFat': 'Body Fat',
        'profile.height': 'Height',
        'profile.age': 'Age',
        'profile.gender': 'Gender',
        'profile.gender.male': 'Male',
        'profile.gender.female': 'Female',
        'profile.gender.other': 'Other',

        // Exercises
        'exercises.loading': 'Loading exercises...',
        'exercises.searchPlaceholder': 'Search exercises...',
        'exercises.empty.noMatchesTitle': 'No matches found',
        'exercises.empty.noneTitle': 'No exercises yet',
        'exercises.empty.noMatchesBody': 'Try a different search term or add a new one.',
        'exercises.empty.noneBody': 'Add your favorite exercises to get started.',
        'exercises.add': 'Add',
        'exercises.new': 'New Exercise',
        'exercises.cantFindAdd': 'Can\'t find it? Add New',

        // Exercise
        'exercise.history': 'History',
        'exercise.weight': 'Weight',
        'exercise.reps': 'Reps',
        'exercise.type.warmup': 'Warmup',
        'exercise.type.working': 'Working',

        // Gyms
        'gyms.loading': 'Loading gyms...',
        'gyms.empty.title': 'No gyms added',
        'gyms.empty.subtitle': 'Add your first gym to start tracking workouts.',
        'gyms.addNew': 'Add New Gym',
        'gyms.addAnother': 'Add Another Gym',
        'gyms.visits': 'Visits',
        'gyms.noLocation': 'No location',

        // Workout history
        'history.loading': 'Loading ...',
        'history.empty': 'No completed workouts yet.',
        'history.edit': 'Edit workout',
        'history.delete': 'Delete workout',
        'history.view': 'View details',
        'history.deleteConfirm': 'Are you sure you want to delete this workout?',

        // Workout
        'workout.initializing': 'Initializing workout...',
        'workout.finish': 'Finish',
        'workout.cancel': 'Cancel',
        'workout.cancelConfirm': 'Cancel this workout? All sets will be deleted.',
        'workout.addExercise': 'Add Exercise',
        'editWorkout.loading': 'Loading workout...',

        // Workout details
        'workoutDetails.loading': 'Loading details...',
        'workoutDetails.edit': 'Edit',
        'workoutDetails.delete': 'Delete workout',
        'workoutDetails.deleteConfirm': 'Are you sure you want to delete this workout?',
        'workoutDetails.noExercises': 'No exercises recorded.',
        'workoutDetails.sets': 'sets',

        // Manage exercises
        'manageExercises.title': 'Manage Exercises',
        'manageExercises.searchPlaceholder': 'Search exercises...',
        'manageExercises.newPlaceholder': 'New exercise name',
        'manageExercises.deleteConfirm': 'Delete this exercise?',
        'manageExercises.general': 'General',

        // Manage gyms
        'manageGyms.title': 'Manage Gyms',
        'manageGyms.deleteConfirm': 'Delete this gym? This will NOT delete workout history associated with it, but functionality might be affected.',
        'manageGyms.empty': 'No gyms added yet.',
        'manageGyms.noLocation': 'No location',

        // Add exercise
        'addExercise.title': 'Add New Exercise',
        'addExercise.nameLabel': 'Exercise Name',
        'addExercise.namePlaceholder': 'e.g. Bench Press',
        'addExercise.muscleGroupLabel': 'Muscle Group',
        'addExercise.cancel': 'Cancel',
        'addExercise.save': 'Save Exercise',
        'addExercise.saving': 'Saving...',
        'addExercise.muscle.chest': 'Chest',
        'addExercise.muscle.back': 'Back',
        'addExercise.muscle.legs': 'Legs',
        'addExercise.muscle.shoulders': 'Shoulders',
        'addExercise.muscle.arms': 'Arms',
        'addExercise.muscle.core': 'Core',
        'addExercise.muscle.cardio': 'Cardio',
        'addExercise.muscle.fullBody': 'Full Body',

        // Add gym
        'addGym.title': 'Add New Gym',
        'addGym.nameLabel': 'Gym Name',
        'addGym.namePlaceholder': 'e.g. Gold\'s Gym',
        'addGym.locationLabel': 'Location',
        'addGym.locationPlaceholder': 'e.g. Venice Beach',
        'addGym.cancel': 'Cancel',
        'addGym.save': 'Save Gym',
        'addGym.saving': 'Saving...',

        // Exercise selector
        'exerciseSelector.title': 'Select Exercise',
        'exerciseSelector.close': 'Close',

        // Charts
        'charts.loading': 'Loading charts...',
        'charts.noDataExercise': 'No data for this exercise yet.',
        'charts.selectExercise': 'Select an exercise to view progress.',
        'charts.weightHistory': 'Weight History',
        'charts.bodyFatHistory': 'Body Fat History',
        'charts.noWeight': 'No weight data. Update your profile to track history.',
        'charts.noBodyFat': 'No body fat data.',
        'charts.rangeLabel': 'Range',
        'charts.range.7': 'Last 7 days',
        'charts.range.30': 'Last 30 days',
        'charts.range.90': 'Last 90 days',
        'charts.range.180': 'Last 180 days',
        'charts.range.365': 'Last 365 days',

        // Layout
        'layout.workoutActiveTitle': 'Workout session active',
        'layout.tapToResume': 'Tap to resume',

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
        'common.optional': 'Optional',
        'common.unknownGym': 'Unknown Gym',
        'common.unit.kg': 'kg',
        'common.unit.cm': 'cm',
        'common.unit.reps': 'reps',
    },
    de: {
        // Navigation
        'nav.training': 'Training',
        'nav.analysis': 'Analyse',
        'nav.profile': 'Profil',
        'nav.settings': 'Einstellungen',

        // Settings
        'settings.title': 'Einstellungen',
        'settings.subtitle': 'App Konfiguration',
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
        'settings.accentColor': 'Akzentfarbe',
        'settings.accentColor.desc': 'Hauptfarbe anpassen',
        'settings.reminders.never': 'Nie',
        'settings.reminders.daily': 'Täglich',
        'settings.reminders.weekly': 'Wöchentlich',
        'settings.reminders.monthly': 'Monatlich',
        'settings.appVersion': 'Gym App',
        'settings.madeBy': 'gemacht mit ❤ von',

        // Language names
        'language.english': 'Englisch',
        'language.german': 'Deutsch',

        // Colors
        'color.blue': 'Blau',
        'color.green': 'Grün',
        'color.red': 'Rot',
        'color.orange': 'Orange',
        'color.purple': 'Violett',
        'color.pink': 'Pink',
        'color.cyan': 'Cyan',
        'color.yellow': 'Gelb',

        // Training
        'training.title': 'Training',
        'training.subtitle.add': 'Neuen Ort hinzufügen',
        'training.subtitle.select': 'Wähle ein Studio, um zu starten',
        'training.activeWorkoutConfirmPrefix': 'Du hast ein aktives Workout bei',
        'training.activeWorkoutConfirmSuffix': 'Du musst es beenden, bevor du ein neues startest. Zum aktiven Workout gehen?',

        // Analysis
        'analysis.title': 'Analyse',
        'analysis.subtitle': 'Verfolge deinen Fortschritt',
        'analysis.tab.workout': 'Workout Analyse',
        'analysis.tab.body': 'Körperanalyse',
        'analysis.section.progress': 'Fortschritt',
        'analysis.section.recent': 'Letzte Workouts',
        'analysis.section.bodyMetrics': 'Körperwerte',
        'analysis.section.bodyMetrics.desc': 'Verfolge dein Gewicht und Körperfett im Verlauf.',

        // Onboarding
        'onboarding.welcome': 'Willkommen',
        'onboarding.subtitle': 'Lass uns dein Profil einrichten, um deinen Fortschritt zu verfolgen',
        'onboarding.name': 'Mein Name ist',
        'onboarding.weight': 'Gewicht (kg)',
        'onboarding.height': 'Größe (cm)',
        'onboarding.bodyFat': 'Körperfett % (Optional)',
        'onboarding.age': 'Alter',
        'onboarding.gender': 'Geschlecht',
        'onboarding.gender.male': 'Männlich',
        'onboarding.gender.female': 'Weiblich',
        'onboarding.gender.other': 'Divers',
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
        'profile.subtitle': 'Verwalte deine Statistiken',
        'profile.save': 'Profil speichern',
        'profile.saving': 'Speichert...',

        'profile.saveSuccess': 'Profil gespeichert.',
        'profile.displayName': 'Anzeigename',
        'profile.weight': 'Gewicht',
        'profile.bodyFat': 'Körperfett',
        'profile.height': 'Größe',
        'profile.age': 'Alter',
        'profile.gender': 'Geschlecht',
        'profile.gender.male': 'Männlich',
        'profile.gender.female': 'Weiblich',
        'profile.gender.other': 'Divers',

        // Exercises
        'exercises.loading': 'Übungen werden geladen...',
        'exercises.searchPlaceholder': 'Übungen suchen...',
        'exercises.empty.noMatchesTitle': 'Keine Treffer',
        'exercises.empty.noneTitle': 'Noch keine Übungen',
        'exercises.empty.noMatchesBody': 'Versuch einen anderen Suchbegriff oder füge eine neue hinzu.',
        'exercises.empty.noneBody': 'Füge deine Lieblingsübungen hinzu, um loszulegen.',
        'exercises.add': 'Hinzufügen',
        'exercises.new': 'Neue Übung',
        'exercises.cantFindAdd': 'Nicht gefunden? Neu hinzufügen',

        // Exercise
        'exercise.history': 'Verlauf',
        'exercise.weight': 'Gewicht',
        'exercise.reps': 'Wiederholungen',
        'exercise.type.warmup': 'Aufwärmen',
        'exercise.type.working': 'Arbeitssatz',

        // Gyms
        'gyms.loading': 'Studios werden geladen...',
        'gyms.empty.title': 'Keine Studios hinzugefügt',
        'gyms.empty.subtitle': 'Füge dein erstes Studio hinzu, um Workouts zu tracken',
        'gyms.addNew': 'Neues Studio hinzufügen',
        'gyms.addAnother': 'Weiteres Studio hinzufügen',
        'gyms.visits': 'Besuche',
        'gyms.noLocation': 'Kein Standort',

        // Workout history
        'history.loading': 'Laden ...',
        'history.empty': 'Noch keine abgeschlossenen Workouts.',
        'history.edit': 'Workout bearbeiten',
        'history.delete': 'Workout löschen',
        'history.view': 'Details anzeigen',
        'history.deleteConfirm': 'Möchtest du dieses Workout wirklich löschen?',

        // Workout
        'workout.initializing': 'Workout wird gestartet...',
        'workout.finish': 'Beenden',
        'workout.cancel': 'Abbrechen',
        'workout.cancelConfirm': 'Workout abbrechen? Alle Saetze werden geloescht.',
        'workout.addExercise': 'Übung hinzufügen',
        'editWorkout.loading': 'Workout wird geladen...',

        // Workout details
        'workoutDetails.loading': 'Details werden geladen...',
        'workoutDetails.edit': 'Bearbeiten',
        'workoutDetails.delete': 'Workout löschen',
        'workoutDetails.deleteConfirm': 'Möchtest du dieses Workout wirklich löschen?',
        'workoutDetails.noExercises': 'Keine Übungen aufgezeichnet.',
        'workoutDetails.sets': 'Sätze',

        // Manage exercises
        'manageExercises.title': 'Übungen verwalten',
        'manageExercises.searchPlaceholder': 'Übungen suchen...',
        'manageExercises.newPlaceholder': 'Neuer Übungsname',
        'manageExercises.deleteConfirm': 'Diese Übung löschen?',
        'manageExercises.general': 'Allgemein',

        // Manage gyms
        'manageGyms.title': 'Studios verwalten',
        'manageGyms.deleteConfirm': 'Dieses Studio löschen? Das löscht NICHT die zugehörige Workout-Historie, aber Funktionen könnten beeinträchtigt werden.',
        'manageGyms.empty': 'Noch keine Studios hinzugefügt.',
        'manageGyms.noLocation': 'Kein Standort',

        // Add exercise
        'addExercise.title': 'Neue Übung hinzufügen',
        'addExercise.nameLabel': 'Übungsname',
        'addExercise.namePlaceholder': 'z.B. Bankdrücken',
        'addExercise.muscleGroupLabel': 'Muskelgruppe',
        'addExercise.cancel': 'Abbrechen',
        'addExercise.save': 'Übung speichern',
        'addExercise.saving': 'Speichern...',
        'addExercise.muscle.chest': 'Brust',
        'addExercise.muscle.back': 'Rücken',
        'addExercise.muscle.legs': 'Beine',
        'addExercise.muscle.shoulders': 'Schultern',
        'addExercise.muscle.arms': 'Arme',
        'addExercise.muscle.core': 'Rumpf',
        'addExercise.muscle.cardio': 'Cardio',
        'addExercise.muscle.fullBody': 'Ganzkörper',

        // Add gym
        'addGym.title': 'Neues Studio hinzufügen',
        'addGym.nameLabel': 'Studioname',
        'addGym.namePlaceholder': 'z.B. Gold\'s Gym',
        'addGym.locationLabel': 'Standort',
        'addGym.locationPlaceholder': 'z.B. Venice Beach',
        'addGym.cancel': 'Abbrechen',
        'addGym.save': 'Studio speichern',
        'addGym.saving': 'Speichern...',

        // Exercise selector
        'exerciseSelector.title': 'Übung auswählen',
        'exerciseSelector.close': 'Schließen',

        // Charts
        'charts.loading': 'Diagramme werden geladen...',
        'charts.noDataExercise': 'Noch keine Daten für diese Übung.',
        'charts.selectExercise': 'Wähle eine Übung, um den Fortschritt zu sehen.',
        'charts.weightHistory': 'Gewichtsverlauf',
        'charts.bodyFatHistory': 'Körperfettverlauf',
        'charts.noWeight': 'Keine Gewichtsdaten. Aktualisiere dein Profil, um den Verlauf zu sehen.',
        'charts.noBodyFat': 'Keine Körperfettdaten.',
        'charts.rangeLabel': 'Zeitraum',
        'charts.range.7': 'Letzte 7 Tage',
        'charts.range.30': 'Letzte 30 Tage',
        'charts.range.90': 'Letzte 90 Tage',
        'charts.range.180': 'Letzte 180 Tage',
        'charts.range.365': 'Letzte 365 Tage',

        // Layout
        'layout.workoutActiveTitle': 'Workout läuft',
        'layout.tapToResume': 'Tippe zum Fortsetzen',

        // Reminders
        'reminder.title': 'Zeit deine Statistiken zu aktualisieren!',
        'reminder.subtitle': 'Deine letzte Messung ist schon eine Weile her',
        'reminder.action': 'Aktualisieren',

        // Generic
        'common.save': 'Speichern',
        'common.cancel': 'Abbrechen',
        'common.delete': 'Löschen',
        'common.edit': 'Bearbeiten',
        'common.loading': 'Laden...',
        'common.optional': 'Optional',
        'common.unknownGym': 'Unbekanntes Studio',
        'common.unit.kg': 'kg',
        'common.unit.cm': 'cm',
        'common.unit.reps': 'Wdh.',
    }
};
