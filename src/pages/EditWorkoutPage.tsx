import { Navigate, useParams } from 'react-router-dom';
export function EditWorkoutPage() {
    const { workoutId } = useParams();
    return <Navigate to={`/workout/${workoutId}/view`} replace />;
}
