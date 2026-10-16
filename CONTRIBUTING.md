# Contributing to Karavali-Transit

Thank you for contributing to **Karavali-Transit**—the real-time coastal smart transit platform for Karnataka.

---

## 1. Development Workflow

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sanath-labs/Karavali-Transit.git
   cd Karavali-Transit
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the backend server**:
   ```bash
   npm run server
   ```
   *The server starts on port 5000 and connects to SQLite `transit.db` automatically.*

4. **Start the frontend client**:
   ```bash
   npm run dev
   ```
   *Vite opens on `http://localhost:5173`.*

---

## 2. Commit Message Convention

We follow conventional commits:
- `feat(...)`: New user-facing or platform features.
- `fix(...)`: Bug fixes.
- `docs(...)`: Documentation and architectural guides.
- `style(...)`: UI, CSS, and aesthetic improvements.
- `test(...)`: Unit, integration, or smoke tests.
- `refactor(...)`: Code refactoring without behavior changes.

---

## 3. Code Standards & Verification

Before submitting PRs, ensure all checks pass:
```bash
npm run lint    # Oxlint inspection (0 warnings, 0 errors)
npm run build   # Production Vite bundle test
npm test        # Smoke test suite
```
