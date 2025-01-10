# Groves API

Groves is an arboreal semiclone of Reddit.

[Project Spec](https://www.theodinproject.com/lessons/node-path-nodejs-odin-book)

## Installation

Navigate to the root directory where you'd like this project to be, and clone this repo:

```
git clone https://github.com/endulum/groves-api
```

Install all required packages:

```
npm install
```

### Environment

This project uses three env files: `test`, `development`, and `production`. The repo supplies a file `.env.example` with the variables necessary for the project to run. Copy this file to the three envs described. A handy script for this is provided for you:

```
npm run initenv
```

For development, at minimum you need:

- `DATABASE_URL`
- `JWT_SECRET` for Groves' JWT-based authentication to work.
- `FRONTEND_URL` for CORS.
  Following that, you should be ready to `npm run dev`.

### Testing

This project uses Docker to provide an independent Postgres database for testing. For your `.env.test`, make sure the database URL points to that database:

```
DATABASE_URL=postgresql://prisma:prisma@localhost:5433/tests
```

The script `npm run test` handles bringing up the container, applying any migrations present, and running the tests.

### Github App

Groves can let users authenticate using their GitHub accounts. This project can be run without the necessary env vars for a GitHub app, but the `/github` route will not be functional. You'll need a [GitHub app](https://github.com/settings/apps) of your own to fill in the missing vars and have this functionality complete.

### Database

#### Squashing (development)

```
rm -r ./prisma/migrations/*
npx dotenv -e .env.development -- npx prisma migrate dev --name squashed_migration
npx dotenv -e .env.development -- npx prisma migrate reset
```

`npm run docker:reset` can be executed afterwards to have testing work with the squashed migration.

#### Views

This project takes advantage of Postgresql Views to apply a variety of scores to posts and replies. See `./prisma/sql/` for the SQL required to create those views. Views are not directly supported in Prisma, so they would have to be copied in to a migration file as custom SQL, like so:

```
cat ./prisma/sql/ReplyRating.sql >> ./prisma/migrations/20250110211416_squashed_migration/migration.sql
cat ./prisma/sql/PostRating.sql >> ./prisma/migrations/20250110211416_squashed_migration/migration.sql
```

If doing this in tandem with squashing, this step must be done _before_ running `npx prisma migrate reset`.
