# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.2.

## Development server

Start the backend on port `3000`, then start the Angular development server:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.
The development proxy in `proxy.conf.json` forwards `/api/v1/**` to the
backend. Production hosting must route the same API path to the NestJS service.

## Products and recipes

After signing in and selecting a bakery, open `/products` to search and filter
products. An `ADMIN` or `EDITOR` can create a product, open its detail page,
create a recipe draft, add active materials and compatible units, save, and
publish with a calendar effective date. Published recipes are read-only; create
a new draft to make later changes. `VIEWER` accounts can browse products and
recipe history but do not see write actions.

The UI uses the real `/api/v1` endpoints and does not calculate recipe costs.
An active material with no current price remains available; the editor shows
that missing price as an informational warning.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Session storage

The MVP keeps the short-lived access token in `sessionStorage`, cleared when
the browser tab session ends. This is a practical persistence choice, not
protection against cross-site scripting (XSS): JavaScript executing on the
origin can read it. Avoid unsafe HTML APIs such as `innerHTML` with untrusted
data, and do not store passwords in browser storage.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
