import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { TrainingPage } from '@/pages/TrainingPage';
import { AnalysisPage } from '@/pages/AnalysisPage';
import { WorkoutPage } from '@/pages/WorkoutPage';
import { EditWorkoutPage } from '@/pages/EditWorkoutPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ManageGymsPage } from '@/pages/ManageGymsPage';
import { ManageExercisesPage } from '@/pages/ManageExercisesPage';

import { RequireUser } from '@/components/RequireUser';
import { OnboardingPage } from '@/pages/OnboardingPage';

import { LanguageProvider } from '@/i18n/LanguageContext';
import { ThemeProvider } from '@/context/ThemeContext';

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />

          <Route element={<RequireUser />}>
            <Route element={<Layout />}>
              <Route path="/" element={<TrainingPage />} />
              <Route path="/workout/:gymId" element={<WorkoutPage />} />
              <Route path="/workout/:workoutId/edit" element={<EditWorkoutPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/gyms" element={<ManageGymsPage />} />
              <Route path="/settings/exercises" element={<ManageExercisesPage />} />
            </Route>
          </Route>
        </Routes>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
