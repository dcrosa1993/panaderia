<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Backend API

NestJS API for the Panadería Costing Platform. The API is versioned under
`/api/v1`; PostgreSQL access uses the generated Prisma Client and the
`@prisma/adapter-pg` adapter.

## Project setup

```bash
npm install
Copy-Item .env.example .env
npx prisma generate
```

Set `DATABASE_URL` in the ignored `.env` file to the local PostgreSQL instance
on `localhost:5433`. `PORT` defaults to `3000`. `FRONTEND_ORIGIN` must be one
HTTP(S) origin; in development it defaults to `http://localhost:4200`.
`JWT_SECRET` is required and must contain at least 32 bytes. Generate a fresh
value locally, for example with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`,
and keep it only in `.env`.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

Liveness is available at `/api/v1/health/liveness`. Readiness at
`/api/v1/health/readiness` runs `SELECT 1` against PostgreSQL and returns
HTTP 503 if the database is unavailable. Swagger is not configured in this
backend yet.

## Materials catalog

`GET /api/v1/measurement-units` lists active global units and does not require
a bakery context. The materials and price-history endpoints require an
authenticated user, an active membership selected through `X-Bakery-Id`, and
the appropriate membership role. The existing `prisma/seed.ts` contains
idempotent measurement-unit upserts. After reviewing the seed and choosing the
intended database, run `npx prisma db seed` from this directory to populate the
catalog; it is intentionally not run as part of build or startup.

Historical prices are accepted chronologically and an open prior period is
closed to the day before the new period starts. The database schema has no
exclusion constraint for overlapping date ranges, so the transaction and
unique material/start-date key do not guarantee exclusion under every
concurrent interleaving. Avoid concurrent price-history writes for the same
material until the database model can provide that guarantee.

## Products and recipe versions

The product API is scoped to the authenticated bakery selected with
`X-Bakery-Id`. `ADMIN` and `EDITOR` can write; `VIEWER` is read-only.

- `GET /api/v1/products?search=&status=&page=1&pageSize=20` lists products
  with pagination and a recipe summary.
- `POST /api/v1/products` accepts `name`, optional `description`, and
  `salesUnitId`.
- `GET` and `PATCH /api/v1/products/:productId` read and update a product.
- `GET /api/v1/products/:productId/recipe-versions` lists recipe history;
  `POST` creates a server-numbered draft, cloning the most recently effective
  published recipe where one exists.
- `GET` and `PATCH /api/v1/products/:productId/recipe-versions/:versionId`
  read or update a draft.
- `PUT /api/v1/products/:productId/recipe-versions/:versionId/materials`
  replaces the full draft ingredient list atomically.
- `POST /api/v1/products/:productId/recipe-versions/:versionId/publish`
  accepts `{ "effectiveFrom": "YYYY-MM-DD" }` and publishes the draft.

Recipe quantities and yields are decimal strings. Published versions are
read-only, and a later publication closes an open prior period on the preceding
calendar day. Serializable transactions detect many concurrent changes, but
the schema has no exclusion constraint for date-range overlap; this does not
guarantee protection from every concurrent publication interleaving. Material
prices are informational and are not required to save or publish a recipe.

## Authentication and bakery access

- `POST /api/v1/auth/login` accepts `{ "email": "...", "password": "..." }`
  and returns a 15-minute JWT Bearer access token.
- `GET /api/v1/auth/me` and `GET /api/v1/bakeries` require that access token.
- Future bakery-scoped routes can use `@RequireBakeryContext(...)`,
  `@CurrentUser()` and `@CurrentBakeryId()`. The guard validates the
  `X-Bakery-Id` UUID against the authenticated user's active membership and
  the bakery's active status; roles are scoped to that membership.

No public signup is provided. To create the initial bakery administrator,
configure `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (at least 12
UTF-8 bytes), `BOOTSTRAP_ADMIN_NAME` and `BOOTSTRAP_BAKERY_NAME` in the ignored
`.env`, then explicitly run `npm run bootstrap:admin`. The command refuses an
existing normalized email or any existing account/bakery and does not run as
part of application startup.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/overview) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
