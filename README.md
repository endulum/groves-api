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

### Testing

This project uses Docker to provide an independent Postgres database for testing. For your `.env.test`, make sure the database URL points to that database:

```
DATABASE_URL=postgresql://prisma:prisma@localhost:5433/tests
```
