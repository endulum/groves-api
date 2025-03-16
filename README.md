# Groves API

Groves is a semiclone of Reddit with an arboreal flavor.

This is the API repo. See the [repo for the frontend here](https://github.com/endulum/groves).

### Installation and environment

This is a Node.js project, so you will need Node installed.

Navigate to the root directory where you'd like this project to be, and clone this repo:

```sh
git clone https://github.com/endulum/groves-api
```

Navigate to the root of the newly created `/groves-api`, and install all required packages:

```sh
npm install
```

### Integrations and environment

This project uses three env files: `test`, `development`, and `production`. Groves supplies a file `.env.example` with the variables necessary for the project to run. Copy this file to the three envs described. A handy script for this is provided for you, `npm run envinit`.

As you can find in `.env.example`, this project uses the following integrations:

- PostgreSQL, as a database to store account, community, post, reply, and activity information. Needs `DATABASE_URL`.
- GitHub App, to authorize accounts through GitHub. Needs `GH_CLIENT_ID` and `GH_SECRET`.
- Redis, to cache initial-load reply trees for posts. Needs `REDIS_URL`.

#### PostgreSQL

You need an existing PostgreSQL database somewhere and its connection URI.

Note that an independent Postgres database for testing is provided by Docker in this project, so for your `.env.test`, you can have the URI point to that database:

```env
DATABASE_URL=postgresql://prisma:prisma@localhost:5433/tests
```

The script `npm run test` handles bringing up the container, applying any migrations present, and running the tests.

#### GitHub App

Groves needs the client ID and secret of an active GitHub app.

Note that GitHub authentication is not utilized in the `test` environment.

#### Redis

Groves needs the URI of a Redis database. This project provides a Docker image for a Redis cache for your convenience, so for your `.env.development`, you can have the URI point to that cache:

```env
REDIS_URL=redis://localhost:6379
```

Note that Redis caching is not utilized in the `test` environment.

#### Other

If developing with a frontend, Groves needs to know the `FRONTEND_URL` for CORS and to complete the callback URL for GitHub authentication.

Groves uses JSON Web Token and needs a `JWT_SECRET` to sign tokens. It can be any string.

### Starter Data

Groves supplies a reset script featuring a `seed` function, the options of which are customizable. On invocation, `seed` always:

- Truncates the `User` Postgres table, emptying all possible database records by cascade.
- Creates one admin account.

It is able to populate community, post, reply, and vote data as well, if told to; examine the parameters in `seed`.

### PostgreSQL Views

This project takes advantage of Postgresql Views to apply a variety of scores to posts and replies. See `./prisma/sql/` for the SQL required to create those views. Views are not directly supported in Prisma, so they would have to be copied in to a migration file as custom SQL, like so:

```
cat ./prisma/sql/ReplyRating.sql >> ./prisma/migrations/20250110211416_squashed_migration/migration.sql
cat ./prisma/sql/PostRating.sql >> ./prisma/migrations/20250110211416_squashed_migration/migration.sql
```

If doing this in tandem with squashing, this step must be done _before_ running `npx prisma migrate reset`.

### Endpoint overview

### Endpoint overview

| Endpoint                               | Description                                                  |
| -------------------------------------- | ------------------------------------------------------------ |
| `POST /login`                          | Log in to a user account. This returns a JWT representing the user on success. |
| `POST /signup`                         | Create a user account.                                       |
| `GET /github`                          | Authenticate using a GitHub App.<br />- `?code=<string>`: token string for authentication, required. |
| `GET /me`                              | Get the user data of the authenticated user (yourself).      |
| `PUT /me`                              | Edit the user data of the authenticated user (yourself).     |
| `GET /user/:user`                      | Get the user data of the identified user.                    |
| `GET /user/:user/actions`              | Get content activity of the identified user in a paginated list.<br />- `?before=<id string>`: get results before the post or reply indicated by the id string.<br />- `?after=<id string>`: same as above, but after, and cannot be used with above.<br />- `?take=<int>`: limits max list size by the indicated amount. |
| `GET /all`                             | Get post activity of all communities in the database in a paginated list.<br />- `?before=<id string>`: get results before the postindicated by the id string.<br />- `?after=<id string>`: same as above, but after, and cannot be used with above.<br />- `?take=<int>`: limits max list size by the indicated amount. |
| `GET /feed`                            | Get post activity of only the communities the authenticated user follows, in a paginated list.<br />- `?before=<id string>`: get results before the post indicated by the id string.<br />- `?after=<id string>`: same as above, but after, and cannot be used with above.<br />- `?take=<int>`: limits max list size by the indicated amount. |
| `GET /following`                       | Get communities the authenticated user is following in a paginated list.<br />- `?before=<id string>`: get results before the community indicated by the id string.<br />- `?after=<id string>`: same as above, but after, and cannot be used with above.<br />- `?take=<int>`: limits max list size by the indicated amount.<br />- `?name=<string>`: filter for communities whose URL name or canonical name include the given string. |
| `GET /communities`                     | Get all unfrozen communities in the database in a paginated list.<br />- `?before=<id string>`: get results before the community indicated by the id string.<br />- `?after=<id string>`: same as above, but after, and cannot be used with above.<br />- `?take=<int>`: limits max list size by the indicated amount.<br />- `?name=<string>`: filter for communities whose URL name or canonical name include the given string.<br />- `?sort=<string>`: sort communities by `followers`, `posts`, or `activity`. |
| `POST /communities`                    | Create a community, with the authenticated user being its admin. |
| `GET /community/:community`            | Get information about the identified community.              |
| `PUT /community/:community`            | Edit information about the identified community.             |
| `PUT /community/:community/moderators` | Edit the moderator list of the community.                    |
| `PUT /community/:community/admin`      | Change the admin of the community.                           |
| `GET /community/:community/wiki`       | Get the community's wiki in a text string.                   |
| `PUT /community/:community/wiki`       | Edit the community's wiki.                                   |
| `PUT /community/:community/followers`  | Follow or unfollow the community.                            |
| `PUT /community/:community/status`     | Freeze (mark readonly) or unfreeze the community.            |
| `GET /community/:community/actions`    | Get the recorded actions of the community in a paginated list.<br />- `?before=<id string>`: get results before the action ndicated by the id string.<br />- `?after=<id string>`: same as above, but after, and cannot be used with above.<br />- `?take=<int>`: limits max list size by the indicated amount.<br />- `?type=<string>`: filter for actions of a given type. |
| `GET /community/:community/pinned`     | Get the pinned posts of a community.                         |
| `GET /community/:community/posts`      | Get the posts belonging to the community in a paginated list.<br />- `?before=<id string>`: get results before the post indicated by the id string.<br />- `?after=<id string>`: same as above, but after, and cannot be used with above.<br />- `?take=<int>`: limits max list size by the indicated amount.<br />- `?title=<string>`: filter for posts whose title includes the indicated string.<br />- `?sort=<string>`: sort results by `newest`, `replies`, or a vote-based score<br />- `?includeFrozen=<boolean>`: include frozen (marked readonly) posts |
| `GET /post/:post`                      | Get information about the identified post.                   |
| `PUT /post/:post`                      | Edit information about the identified post.                  |
| `PUT /post/:post/vote`                 | Add or remove an upvote or downvote for the post.            |
| `PUT /post/:post/status`               | Freeze (mark readonly) or unfreeze the post.                 |
| `PUT /post/:post/pin`                  | Pin or unpin the post to its belonging community.            |
| `GET /post/:post/replies`              | Get the replies belonging to this post in an expandable array of expandable reply trees.<br />- `?parentId=<id string>`: get replies nested under the reply identified by the id. If null, gets root-level replies.<br />- `?cursor=<id string>`: get replies after the reply identified by the id.<br />- `?levels=<int>`: get replies up to a set level. By default, this endpoint gets the root level and three more levels.<br />- `?takePerLevel=<int>`: limits max replies per level by a given amount.<br />- `?takeAtRoot=<int>`: separate max level limit for root-level replies.<br />- `?sort=<string>`: sort results by latest posted or a vote-based score |
| `POST /post/:post/replies`             | Create a reply for the post.                                 |
| `GET /reply/:reply`                    | Get information about the identified reply.                  |
| `GET /reply/:reply/replies`            | Same behavior as `GET /post/:post/replies`, wherein the parent is the identified reply. |
| `PUT /reply/:reply/vote`               | Add or remove an upvote or downvote for the reply.           |
| `PUT reply/:reply/status`              | Hide or unhide the reply.                                    |
| `PUT /reply/:reply/pin`                | Pin or unpin the reply to its belonging post.                |
