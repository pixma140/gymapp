import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { TrainingPage } from '@/pages/TrainingPage';
import { AnalysisPage } from '@/pages/AnalysisPage';
import { WorkoutPage } from '@/pages/WorkoutPage';
import { EditWorkoutPage } from '@/pages/EditWorkoutPage';
import { WorkoutDetailsPage } from '@/pages/WorkoutDetailsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ManageGymsPage } from '@/pages/ManageGymsPage';
import { ManageExercisesPage } from '@/pages/ManageExercisesPage';
import { AuthPage } from '@/pages/AuthPage';
import { AdminPage } from '@/pages/AdminPage';
import { SetupPage } from '@/pages/SetupPage';

import { RequireUser } from '@/components/RequireUser';
import { RequireAuth } from '@/components/RequireAuth';
import { RequireAdmin } from '@/components/RequireAdmin';
import { RequireSetup } from '@/components/RequireSetup';
import { OnboardingPage } from '@/pages/OnboardingPage';

import { LanguageProvider } from '@/i18n/LanguageContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SessionProvider } from '@/context/SessionContext';

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <SessionProvider>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />

          <Route element={<RequireSetup />}>
          <Route path="/auth" element={<AuthPage />} />

          <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />

          <Route element={<RequireUser />}>
            <Route element={<Layout />}>
              <Route path="/" element={<TrainingPage />} />
              <Route path="/workout/:gymId" element={<WorkoutPage />} />
              <Route path="/workout/:workoutId/edit" element={<EditWorkoutPage />} />
              <Route path="/workout/:workoutId/view" element={<WorkoutDetailsPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/gyms" element={<ManageGymsPage />} />
              <Route path="/settings/exercises" element={<ManageExercisesPage />} />
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>
          </Route>
          </Route>
        </Routes>
        </SessionProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
