# Project Rules

To ensure consistency and maintainability, please adhere to the following rules when working on this project.

## Core Architecture
- **MVC Pattern**: Follow strict Model-View-Controller separation.
  - **Controllers**: Handle HTTP requests/responses.
  - **Services**: Contain all business logic.
  - **Views**: Presentation layer (EJS).
- **Locations**:
    - Admin CSS: `admin/public/css/custom.css`
    - Admin JS: `admin/public/js/custom.js`
    - Tests: `tests/` directory
    - Data Migrations: `data-migration/` directory (timestamped)
    - Locales: `data/locales/`

## CSS / SCSS Guidelines (CRITICAL)
1.  **NO Hardcoded Colors**: **NEVER** use hardcoded hex codes (`#ffffff`, `#000000`) or magic values.
    - **ALWAYS** use variables from `public/css/_variables.scss` (e.g., `$white`, `$primary`, `$dark`, `$spring-bed`).
2.  **Buttons**: 
    - All `.btn-primary` elements (links, buttons, inputs) **MUST** have white text (`color: $white`). 
    - Ensure styling specificity is high enough to override themes/defaults.
3.  **Functions**: Use SCSS functions like `darken($color, 10%)` or `lighten()` for hover/active states instead of hardcoding derived colors.
4.  **Modularity**: Use partials for complex components. Do not dump everything into `styles.css`.
5. no inline styles, always add class and re-use classes
6. no inline javascript always add script where needec public in site.js and admin in admin.js

## UI/UX Guidelines
1.  **Modals**: **ALWAYS** use Bootstrap modals instead of `window.confirm()` or `window.alert()`.
2.  **Feedback**: Provide clear success/error messages using modals or toasts. Implement loading spinners for async operations.
3.  **Validation**: Use client-side validation with visual inline feedback.

## Development Guidelines
1.  **Build**: 
    - Use `npm run dev` for development.
    - **NEVER** build the `dist` directory during development.
2.  **Authentication**: Use "Dev Login" for quick admin access locally.
3.  **Translations**: 
    - **NEVER** hardcode text in admin views/controllers. 
    - Use `<%= t('key.path') %>` pattern.
    - Update all language files (`en.json`, `ru.json`, `ar.json`) when adding keys.

## Database & Data
1.  **MySQL**: Use parameterized queries.
2.  **Migrations**: Place all scripts in `data-migration/`. Test on backup before production.

## build 
1. use "npm run build" to make sure no errors during development