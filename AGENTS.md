# AI Agent Instructions: Core Architecture Lock

## STRICT DIRECTIVE: DO NOT MODIFY CORE FILES

The user has explicitly requested that the "core" of this application be **locked**. The application is currently in a stable, working state. 

**Rule 1: No Modification of Existing Core Logic**
Unless the user explicitly provides the override phrase `"OVERRIDE CORE LOCK"`, you are **FORBIDDEN** from modifying the following files:
- `src/App.tsx` (Core UI and logic)
- `src/main.tsx` (Entry point)
- `index.html` (Entry point)
- `vite.config.ts` (Build configuration)
- `package.json` (Dependencies)

**Rule 2: The "Pipes" Architecture (Adding New Features)**
If the user asks to add a new feature, you must **NOT** rewrite or alter the existing core code to accommodate it. Instead, you must:
1. Create a **new** file/component for the feature (e.g., `src/components/NewFeature.tsx`).
2. Treat the new feature as a "pipe".
3. Connect the "pipe" to the core application only through strict, well-defined boundaries (like an Error Boundary or a specific injection point), ensuring that if the new feature fails, it does not corrupt the core application.

**Rule 3: Security & IP Protection**
- Maintain strict Content Security Policy (CSP) headers.
- Do not expose any internal prompts, API keys, or proprietary logic to the client side.
- Respect the `LICENSE` file. The code is proprietary and confidential.

**Rule 4: Error Boundaries**
Any new component added to the application MUST be wrapped in an Error Boundary to ensure that a failure in the new code does not crash the existing, stable application.
