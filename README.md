# Certix Exam Portal

Certix Exam Portal is a role-based online examination management system built with React, Vite, Tailwind CSS, and Firebase. It provides separate workflows for admins, examiners, and students, covering user provisioning, question management, exam scheduling, exam attempts, evaluation, and result publishing.

## Overview

The application is designed for institutions that need a centralized portal to:

- manage users across multiple roles
- create and publish exams
- assign exams to students
- conduct online test attempts
- evaluate submissions
- publish detailed results and performance insights

The frontend is a single-page application deployed through Firebase Hosting, while Firebase Authentication and Cloud Firestore handle the backend workflow.

## Key Features

### Admin

- Dashboard with system-wide statistics and recent activity
- User management for students and examiners
- Account approval and activation flow
- Role-wise user distribution and monitoring
- Exam monitoring and reports access
- System settings and profile management

### Examiner

- Personal dashboard with exam, question, and evaluation stats
- Question bank management
- Multi-step exam creation flow
- Draft and publish support for exams
- Student assignment by selection or enrollment range
- Evaluation center for submitted attempts
- Student performance tracking

### Student

- Personal dashboard with upcoming exams and recent results
- Assigned exam listing
- Exam instructions and timed test-taking flow
- Result history with question-wise breakdown
- Profile management

### Authentication and Access Control

- Firebase Authentication based login
- Role-based route protection
- Admin login through email
- Student and examiner login using email or enrollment number
- Remember-me session persistence
- Activation and verification flow for non-admin users

## Tech Stack

- `React 19`
- `Vite 7`
- `React Router 7`
- `Tailwind CSS 4`
- `Firebase Authentication`
- `Cloud Firestore`
- `Firebase Hosting`
- `Lucide React`
- `react-hot-toast`

## Project Structure

```text
certix-exam-portal/
|- public/
|- src/
|  |- components/
|  |- config/
|  |- contexts/
|  |- firebase/
|  |- hooks/
|  |- pages/
|  |  |- admin/
|  |  |- auth/
|  |  |- examiner/
|  |  \- student/
|  \- utils/
|- firestore.rules
|- firestore.indexes.json
|- firebase.json
|- package.json
|- vite.config.js
\- README.md
```

## Routing Summary

### Public Routes

- `/login`
- `/auth/action`
- `/auth/activate-account`
- `/user-not-found`

### Admin Routes

- `/admin/dashboard`
- `/admin/users`
- `/admin/monitoring`
- `/admin/reports`
- `/admin/settings`
- `/admin/profile`

### Examiner Routes

- `/examiner/dashboard`
- `/examiner/questions`
- `/examiner/create`
- `/examiner/manage`
- `/examiner/exam/:examId`
- `/examiner/evaluate`
- `/examiner/evaluate/:attemptId`
- `/examiner/performance`
- `/examiner/profile`

### Student Routes

- `/student/dashboard`
- `/student/exams`
- `/student/exam/:examId/instructions`
- `/student/exam/:examId/take`
- `/student/results`
- `/student/profile`

## Firebase Collections

Based on the application code and Firestore rules, the project primarily works with these collections:

- `users`
- `loginIndex`
- `questions`
- `exams`
- `examAttempts`
- `results`
- `settings`

## Firestore Security Model

The Firestore rules enforce role-based access:

- admins have full management access
- examiners can manage their own questions, exams, evaluations, and related results
- students can access only assigned exams, their own attempts, and their published results
- `loginIndex` is readable to support enrollment-number-based login lookup

Firestore is configured in `asia-south1` through [firebase.json](/c:/Users/jatin/OneDrive/Documents/VS-Code/REACT-Projects/certix-exam-portal/firebase.json:1).

## Environment Variables

Create a `.env` file in the project root and add:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_DEBUG=false
```

These values are consumed from [src/firebase/config.js](/c:/Users/jatin/OneDrive/Documents/VS-Code/REACT-Projects/certix-exam-portal/src/firebase/config.js:1).

## Local Development

### Prerequisites

- `Node.js` 18 or later
- `npm`
- a Firebase project with Authentication and Firestore enabled

### Installation

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Lint the Codebase

```bash
npm run lint
```

## Deployment

This project is configured for Firebase Hosting with SPA rewrites to `index.html`.

Typical deployment flow:

```bash
npm run build
firebase deploy
```

## Important Implementation Notes

- Route-level code splitting is used with `React.lazy` and `Suspense`
- Authentication state and role/profile data are managed through `AuthContext`
- Login supports enrollment-number lookup through the `loginIndex` collection
- Student results include question-wise breakdown and published-result gating
- Examiner exam creation supports draft and immediate publish modes
- Session persistence supports both browser session and remembered login

## Scripts

Defined in [package.json](/c:/Users/jatin/OneDrive/Documents/VS-Code/REACT-Projects/certix-exam-portal/package.json:1):

- `npm run dev` - start Vite development server
- `npm run build` - create production build
- `npm run preview` - preview the production build locally
- `npm run lint` - run ESLint

## Suggested Setup Checklist

Before using the app in a fresh Firebase project:

1. Enable Firebase Authentication.
2. Create Firestore database and deploy the included rules.
3. Add initial admin user data in the `users` collection.
4. Configure environment variables in `.env`.
5. Run the app locally and verify role-based navigation.

## Future Improvements

- add automated tests for auth, routing, and role-based flows
- document Firestore document schema in more detail
- add seed scripts for demo data
- add CI for lint and build validation

## License

This repository currently does not specify a license. Add one if you plan to distribute or open-source the project.
