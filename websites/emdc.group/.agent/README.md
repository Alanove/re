# Antigravity AI Assistant Configuration

This directory contains configuration files for the Antigravity AI assistant.

## Files

### `rules.md`
Comprehensive project rules and conventions for the EMDC website project. This file consolidates rules from:
- `.cursorrules` - Cursor IDE rules
- `.github/copilot-instructions.md` - GitHub Copilot instructions
- `readme/project-rules.md` - Main project rule set
- `readme/page-structure-rules.md` - Page structure conventions
- `readme/scss-styling-rules.md` - SCSS styling guidelines
- `readme/javascript-modules.md` - JavaScript architecture
- `readme/scss-structure.md` - SCSS compilation and structure
- `readme/menu-management.md` - Menu system documentation

## Purpose

The rules file ensures that Antigravity AI assistant:
1. Follows the project's MVC architecture
2. Uses correct SCSS compilation workflow
3. Adheres to naming conventions
4. Follows page creation workflows
5. Respects build verification requirements
6. Maintains code quality and consistency

## Key Highlights

### Critical Rules
- **Always run `npm run build`** after TypeScript changes
- **Never edit compiled CSS files** - only modify SCSS source files
- **Follow MVC pattern** - business logic in services, presentation in controllers
- **Use kebab-case for page keys** across all systems

### Common Workflows
- **New Page**: JSON → SCSS → Import → Template → Menu
- **Styling**: Edit SCSS → Compile → Test
- **Build**: TypeScript compile → Run → Verify

## Usage

These rules are automatically loaded by Antigravity when working on this project. You don't need to manually reference them, but they're here for transparency and manual review if needed.
