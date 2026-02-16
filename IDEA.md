# Gym App with Training & Analysis Modes

This guide outlines the requirements for a gym app with two primary modes: "Training" and "Analysis." The app should prioritize user experience during workouts and provide insightful post-workout feedback and historical data. Also there should be a Settings and Profile page for the user.

## 0. Core Principles & Design Considerations

* **User-Centric UI:** Simple, intuitive interface, especially during workouts. Minimal taps for core actions.
* **Data Persistence:** All user data (gyms, exercises, workouts, progress) must be securely stored and easily retrievable.
* **Offline Capability:** Workouts should ideally function offline, with data syncing when connectivity is restored.
* **Scalability:** The architecture should allow for future features (e.g., custom workout plans, sharing).

## 1. Database Schema (Conceptual)

The AI should design a database schema that can store all necessary information. Here's a suggested structure:

* **User:**
  * `userId` (PK)
  * `name`
  * `email`
* **Gym:**
  * `gymId` (PK)
  * `name`
  * `location` (optional)
  * `lastVisited` (timestamp)
  * `visitCount`
* **Exercise:**
  * `exerciseId` (PK)
  * `name` (e.g., "Bench Press," "Squat")
  * `muscleGroup` (optional, for filtering/categorization)
* **GymSpecificExerciseEquipment:**
  * `gymSpecificEquipmentId` (PK)
  * `gymId` (FK)
  * `exerciseId` (FK)
  * `equipmentName` (e.g., "Technogym Chest Press," "Hammer Strength Leg Press")
  * `conversionFactor` (decimal, for cross-gym weight adjustment) - *This is crucial for the "speciality" feature.*
* **Workout:**
  * `workoutId` (PK)
  * `userId` (FK)
  * `gymId` (FK)
  * `startTime`
  * `endTime`
  * `duration`
* **Set:**
  * `setId` (PK)
  * `workoutId` (FK)
  * `gymSpecificEquipmentId` (FK) - *Link to specific machine at a specific gym*
  * `exerciseId` (FK) - *Redundant but useful for queries, can be derived*
  * `setType` (e.g., "Warmup," "Working")
  * `setNumber` (e.g., 1, 2, 3)
  * `weight` (e.g., 80.5)
  * `reps` (e.g., 10)
  * `rpe` (Rate of Perceived Exertion, optional for advanced tracking)
  * `timestamp` (for precise set timing, optional)

## 2. Analyze Mode

This mode is focussed on previous workouts. There should be two analyze modes:

### 2.1. view past workouts (sorted by date)

   1. gym name
   2. exercise by exersiese with warm up and full sets

### 2.2. view diagrams

* categorized by exersise
  * past 7, 30, 90 or individual days

## 3. Training Mode

This mode is focused on the live workout experience.

### 3.1. Start New Training Flow

1. **"New Training" Button:**

* Triggers the start of a new workout session.

2. **Gym Selection Screen:**

* **"Select Existing Gym" (a):**
  * Display a list of previously added gyms.
  * **Sorting:** Gyms should be sorted by `visitCount` in descending order (most frequently visited first).
  * Each gym entry should show its name.
  * Upon selection, proceed to Exercise Selection.
* **"Add New Gym" (b):**
  * Provide an input field for the new gym's name.
  * Optionally, a field for location.
  * Upon saving, add the new gym to the database and proceed to Exercise Selection.

### 3.2. Workout Session Screen

Once a gym is selected/added, the workout begins.

1. **Exercise Selection:**

* Display a scrollable list of all known `Exercise`s.
* **"Add New Exercise" Button:**
  * Allows the user to input a new exercise name (e.g., "Barbell Squat").
  * Optionally, categorize by muscle group.
  * Once added, it appears in the list.
* Upon selecting an exercise from the list, it's added to the current workout session.

2. **Active Exercise Tracking:**

  * For each selected exercise:
    * **Exercise Name Display:** Clearly show the current exercise name.
    * **Gym-Specific Equipment Input (Specialty Feature):**
      * Below the exercise name, provide a text input field or a selection dropdown for "Machine Name / Equipment Used."
      * This input should associate with `GymSpecificExerciseEquipment` for the selected `gymId` and `exerciseId`.
      * If the user has previously used this exercise at this gym, pre-populate or suggest known `equipmentName`s.
    * **Set Tracking Interface:**
      * **Warm-up Sets:**
        * Display `Weight` and `Reps` fields.
        * **Previous Data Display:** Show the `Weight` and `Reps` from the *last completed warm-up set for this `GymSpecificExerciseEquipment`*.
      * **Working Sets:**
        * Display `Weight` and `Reps` fields.
        * **Previous Data Display (Crucial!):**
          * **DO NOT show previous `Reps` for working sets.**
          * **DO show previous `Weight` and `Number of Sets`** for this `GymSpecificExerciseEquipment`. This provides context without influencing current performance.
      * **Set Buttons:**
        * **`+` Button:** Adds a new set entry (either Warm-up or Working, based on the previous set type or a toggle).
        * **`✓` (Checkmark) Button:** Saves the current set data (`weight`, `reps`, `setType`) and moves to the next set or exercise.
        * **`x` (Delete) Button:** Removes the last added set.
    * **Conversion (Specialty Feature - *during workout guidance*):**
      * **Goal:** When starting a working set for an exercise at a *new or unfamiliar `GymSpecificExerciseEquipment`*, the app *could* suggest an *adjusted starting weight* based on the user's performance on *similar exercises at other gyms with established `conversionFactor`s*.
    * **AI's Role:** The AI should suggest an algorithm to calculate this `conversionFactor` over time. Initially, it might be a simple average, but it should adapt as more data is collected for specific equipment.
        * **Display:** A small, unobtrusive suggestion (e.g., "Based on your last bench press at Gym X, try ~75kg here").
    * **Exercise Completion:** A button to mark the exercise as complete, moving to the next selected exercise or allowing the user to add more exercises.

3. **Workout End:**

* **"Finish Workout" Button:**
* Confirms the end of the session, logs `endTime`, and calculates `duration`.
* Triggers the "Post-Workout Summary" (described in Analysis Mode).

## 4. Analysis Mode

This mode provides historical data and insights.

### 4.1. General Evaluation/Training History Display

1. **Workout History List:**

* Display a chronological list of all past workouts.
* Each entry should show: Date, Gym Name, Duration, and a summary (e.g., "5 exercises, 20 sets").
* Tapping on a workout entry should navigate to a detailed workout summary.

1. **Detailed Workout Summary:**

* Date, Gym Name, Start/End Time, Duration.
* List all exercises performed in that workout.
* For each exercise:
  * Exercise Name, Equipment Used.
  * Detailed list of all sets (Warm-up and Working) with `Weight` and `Reps`.

1. **Exercise Progress View (Overall):**

* A view where users can select an `Exercise` and see its progress over time.
* Graph visualization of `Weight` vs. `Date` for working sets.
* Graph visualization of `Reps` vs. `Date` for working sets.
* Ability to filter by `Gym` or `GymSpecificExerciseEquipment` to see progress on a particular machine.

### 4.2. Post-Workout Summary (Immediate Analysis)

Immediately after finishing a workout:

1. **"Progress Made" Section:**
    * For *each exercise* performed in the just-completed workout, compare the `Weight` and `Reps` of the working sets to the *previous workout's working sets for the same `GymSpecificExerciseEquipment`*.
    * **Indicators:** Clearly show if `Progress` was made (increased weight, increased reps at same weight, more sets), `Maintained` (similar performance), or `Regressed` (decreased performance).
    * **Visual Cues:** Use icons or color-coding (e.g., green for progress, yellow for maintained, red for regression).
    * **Example:**
        * **Bench Press (Technogym Chest Press @ Gym A):**
            * `+` 5kg on working sets!
            * `✓` Maintained reps (3x8 at 70kg).
        * **Squats (Barbell @ Gym B):**
            * `-` 2 reps on last set. Need to check form next time.
2. **Workout Statistics:**
    * Total number of sets.
    * Total weight lifted (sum of all `weight` * `reps` for all sets).
    * Duration.

## 5. Specialty Feature: Cross-Gym Weight Conversion

This is the most complex but most valuable feature.

### 5.1. AI's Role in Conversion Factor Calculation

* **Initial State:** When a new `GymSpecificExerciseEquipment` is first used, its `conversionFactor` is `1.0`. There's no data to compare it to.
* **Data Collection:** As the user performs more workouts using different `GymSpecificExerciseEquipment` for the *same base `Exercise`*, the system collects data points (weight, reps, RPE if tracked).
* **Algorithm (AI/Statistical Model):**
    * The AI needs to develop an algorithm to compare performance on similar exercises across different machines/gyms.
    * **Input:** For a given `Exercise` (e.g., "Bench Press"), and two `GymSpecificExerciseEquipment` instances (e.g., "Technogym Chest Press" vs. "Hammer Strength Incline Press"), compare working set data.
    * **Logic:** If a user consistently lifts `X` kg for `Y` reps on Machine A, and `Z` kg for `Y` reps on Machine B for the *same perceived effort (or proximity to failure)*, then a `conversionFactor` can be derived.
        * Example: If 80kg on Technogym feels like 70kg on Hammer Strength, the Hammer Strength might have a conversion factor of `80/70 = ~1.14` relative to Technogym (or vice versa).
    * **Update Mechanism:** The `conversionFactor` for `GymSpecificExerciseEquipment` should be dynamically updated or refined after each relevant workout.
    * **Considerations:**
        * **Rep Range:** Comparing a 5-rep max to a 12-rep max is harder than comparing similar rep ranges.
        * **Effort:** RPE (Rate of Perceived Exertion) can be a strong indicator if the user consistently logs it.
        * **Confidence Score:** The AI could also maintain a "confidence score" for each `conversionFactor`, which increases with more data points.

### 5.2. Integration into Training Mode

* **During Workout:** As described above, when selecting an `Exercise` at a new `GymSpecificExerciseEquipment` for which a `conversionFactor` has been established (even if weak), the app should display a *suggested adjusted weight* based on the user's historical performance on that `Exercise` at their *most frequently visited gym* or a *reference equipment*.
* **Initial Message:** "First time on this machine? Based on your last bench press at [Reference Gym/Machine], you might start with ~[Calculated Weight]kg."
* **Refinement:** After the first few workouts on a new machine, the suggestions will become more accurate.

## 6. Technical Stack Suggestions (for AI to consider)

* **Frontend:** React Native (for cross-platform iOS/Android), Flutter, or native (SwiftUI/Kotlin Compose).
* **Backend (if complex logic/sync needed):** Firebase (Firestore/Realtime Database + Cloud Functions), AWS Amplify, Supabase.
* **Database:** SQLite (for local persistence), Firestore/PostgreSQL (for cloud).

## 7. AI Development Workflow

1. **Clarify Requirements:** Ask clarifying questions about edge cases or specific user interactions.
2. **Database Design:** Generate detailed SQL or NoSQL schema based on the conceptual design.
3. **API Design:** Outline necessary API endpoints for creating, reading, updating, deleting (CRUD) data.
4. **UI/UX Wireframes:** Suggest basic wireframes for each screen described (Gym Selection, Workout, Post-Workout, History).
5. **Frontend Component Breakdown:** List the individual UI components needed for each screen.
6. **Backend Logic (Conversion Factor):** Propose the mathematical model/algorithm for calculating and refining `conversionFactor`.
7. **Code Snippets:** Provide example code snippets for key functionalities (e.g., saving a workout, querying progress, calculating conversion).
8. **Testing Strategy:** Suggest unit tests and integration tests for core features.
