/**
 * pages.config.js — Page registry for auto-generated routes in App.jsx.
 *
 * Routing source of truth: see docs/frontend-routing.md
 * - Role-based and manual routes live in App.jsx
 * - Path helpers and guards live in lib/routing.js
 *
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import StudentDashboard from './pages/StudentDashboard';
import StudentDetail from './pages/StudentDetail';
import StudentLessons from './pages/StudentLessons';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherSchedule from './pages/TeacherSchedule';
import TutorDashboard from './pages/TutorDashboard';
import Welcome from './pages/Welcome';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Profile": Profile,
    "Schedule": Schedule,
    "Settings": Settings,
    "StudentDashboard": StudentDashboard,
    "StudentDetail": StudentDetail,
    "StudentLessons": StudentLessons,
    "TeacherDashboard": TeacherDashboard,
    "TeacherSchedule": TeacherSchedule,
    "TutorDashboard": TutorDashboard,
    "Welcome": Welcome,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};