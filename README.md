# Groves API

Groves is an arboreal semiclone of Reddit.

[Project Spec](https://www.theodinproject.com/lessons/node-path-nodejs-odin-book)

The units of interaction in Groves are Communities (likened to "groves"), Posts (likened to "trees" in a grove), and Replies (likened to "leaves" of a tree). Users can form Communities, create Posts in Communities, and write Replies to Posts.

- A user can "vote" positively or negatively on a Post or Reply. A user's "verdancy" is a cumulation of positive votes, countered by negative votes, the content they authored has earned in total.
- Communities are managed by singular Admins with a variable team of Moderators.
  - Moderators can:
    - Freeze, hide, and pin Posts and Replies
    - Edit the Community Wiki
    - Mute users

  - Admins can:
    - Do anything Moderators can
    - Grant or remove Moderator privileges
    - Freeze the Community

- Communities have a public Action log wherein certain Community activites are recorded into Actions, such as new Posts and Replies, moderator demotions and additions, and editions to Community details.

Groves uses JSON Web Tokens to authenticate users for protected :key: routes. When making requests to protected routes, the JWT must be passed into the `Authorization` header, preceded with `Bearer` and a space.

### Todo

- In the server error handler, discern between API and database/Prisma errors
- For Communities, add logic for counting total votes made on all content in the Community
- Handle replies
- Handle actions

## Endpoint Overview

- :eye: - public routes
- :key: - requires any authenticated user
- :shield: - requires an authenticated user with certain privileges

### Errors

The API will return a `200 OK` on routes with actions that have completed successfully.

On routes where actions have failed, the API will accompany the response with status text describing what went wrong.

On routes requiring form input, if the input does not pass validation, the route returns a status of `400` without status text, but with an `errors` object consisting of an array of the described errors.

```js
{
  errors: [
    {
      path: 'username',
      value: '',
      msg: 'Please input a username.',
    },
    // ...
  ];
}
```

### Account

`POST /login` :eye:

Returns a signed JWT representing the user idenfitied by the credentials provided.

Accepts form inputs: `username` and `password`.

`POST /signup` :eye:

Creates a new User.

Accepts form inputs: `username`, `password`, and `confirmPassword`.

`GET /me` :key:

Returns the identity of the authenticated User.

```js
{
    id: 1,
    username: "demo-user",
    joined: '2024-10-17T03:06:39.758Z',
    bio: 'Demo user of Groves.'
    role: 'BASIC',
}
```

`PUT /me` :key:

Edits the identity of the authenticated User.

Accepts form inputs:

- `username`: Required. Must be between 2 and 32 characters in length. Can only consist of lowercase letters, numbers, and hyphens. If the provided `username` does not match the User's current `username`, there must not exist another User with the provided `username`.
- `bio`: Not required. Must not exceed 200 characters in length.
- `password`: Not required. Must be at least eight characters in length.
- `confirmPassword`: Required if `password` is provided. Must exactly match the `password` provided.
- `currentPassword`: Required if `password` is provided. Must match the User's own password.

`GET /user/:user` :eye:

Returns the identity of the User identified by the `:user` parameter, if there exists such a User with an `id` or `username` matching this parameter.

### Community

`GET /communities` :eye:

Returns a paginated list of Communities. A Community must have a status of `ACTIVE` to show up in this list.

```js
{
    communities: [
        {
            id: 1,
        	urlName: 'bestofgroves',
        	canonicalName: 'Best Of Groves',
        	description: 'The funniest and most memorable happenings on Groves.',
        	lastActivity: '2024-10-17T03:34:27.290Z',
            _count: {
                followers: 25,
                posts: 75
            }
        },
        // ...
    ],
    links: {
        nextPage: '/communities?after=12345',
        previousPage: null
    }
}
```

This endpoint accepts query parameters:

- `sort`: sorts by follower count (`=followers`), post count (`=posts`), or latest activity (`=activity`) descending.
- `name`: filters for any Communities whose `urlName` or `canonicalName` includes the string provided.
- `take`: how many results to show at once. By default, 15 results are shown.

This endpoint uses cursor-based pagination. A cursor "id" is passed into a `before` or `after` query parameter when visiting a previous or next page, respectively. Under `links`, this endpoint lists a "next" or "previous" page endpoint if present.

`POST /communities` :key:

Creates a new Community, with the authenticated user automatically given admin privileges over the Community.

- `urlName`: Required. Must be between 2 and 32 characters in length. Can only consist of lowercase letters and numbers. There must not exist another Community in the database with the provided `urlName`.
- `canonicalName`: Required. Must be between 2 and 32 characters in length.
- `description`: Not required. Cannot exceed 200 characters in length.

`GET /community/:community` :eye:

Returns the identity of the Community identified by the `:community` parameter, if there exists such a Community with an `id` or `urlName` matching this parameter.

```js
{
  id: 1,
  urlName: 'bestofgroves',
  canonicalName: 'Best Of Groves',
  description: 'The funniest and most memorable happenings on Groves.',
  status: 'ACTIVE',
  created: '2024-11-18T06:41:53.162Z',
  lastActivity: '2024-11-18T06:41:53.162Z',
  admin: { id: 1, username: 'admin' },
  moderators: [ 
      { id: 2, username: 'demo-1' }, 
      { id: 3, username: 'demo-2' } 
  ],
  _count: {
      followers: 75,
      posts: 125,
      totalVotes: 2125
  }
}
```

 `PUT /community/:community` :shield:

Edits the identity of the identified Community. Accepts the same form inputs and follows the same validation rules as `POST /communities`. The Community must be `ACTIVE` and the authenticated user must have admin privileges over the Community.

`GET /community/:community/wiki` :eye:

Returns a `content` string representing the Community's Wiki.

`PUT /community/:community/wiki`​ :shield:

Edits the Community's Wiki. Accepts a form input `content`, which can be a blank string, but cannot exceed 10,000 characters in length. The Community must be `ACTIVE` and the authenticated user must have moderator privileges over this Community.

`POST /community/:community/follow` :key: 

Adds or removes the authenticated User to the "followers" list of the identified Community. Accepts a form input `follow` which must be `true` (having the User follow the Community) or `false` (having the User unfollow the Community). The Community must be `ACTIVE`.

`POST /community/:community/promote`​ :shield: 

Grants a User moderator privileges over the identified Community. The Community must be `ACTIVE` and the authenticated User must have admin privileges over the Community.

- `username`: Required. There must exist a User with the provided `username` who does not already have moderator privileges over this Community.

`POST /community/:community/demote`​ :shield:

Removes moderator privileges over the identified Community from a User. The Community must be `ACTIVE` and the authenticated User must have admin privileges over the Community.

- `username`: Required. There must exist a User with the provided `username` who has moderator privileges over this Community.

`POST /community/:community/freeze` :shield:

Sets the `status` of the identified Community to `ACTIVE` or `FROZEN`. Accepts a form input `freeze` which must be `true` (having this Community be `FROZEN`) or `false` (having this Community no longer be `FROZEN`). The authenticated User must have admin privileges over this Community.

### Posts

`GET /community/:communityUrl/posts` :eye:

Returns a paginated list of Posts under the identified Community. A post must have a status of `ACTIVE` to show up in this list.

```js
{
	posts: [
        {
            id: 'cm3qc9dfs0004b1at6p5sdlqh',
            title: 'Lorem Ipsum',
            datePosted: '2024-10-17T03:34:27.290Z',
            author: {
                id: 1,
                username: 'demo-user'
            },
        	_count: {
        		replies: 50,
        		upvotes: 100,
        		downvotes: 20
        	},
            voted: {
                upvoted: true,
                voted: false
            }
        }
	],
	links: {
		nextPage: '/community/bestofgroves/?after=cm3oxnxwj00183jd6jl5g2icb',
        previousPage: null
	}
}
```

The `voted` property represents how the authenticated User voted on this post. It will be `null` if there is no authenticated User.

This endpoint accepts query parameters:

- `sort`: sorts by:
  - `=new`: the date of post creation.
  - `=comments`: the count of comments under this post.
  - `=hot`: voting popularity, relative to time.
  - `=top`: highest upvotes, countered by downvotes.
  - `=best`: specially rated "best" posts.
  - `=controversial`: highest vote count with the closest ratio of upvotes to downvotes.


- `name`: filters for any posts whose `title` includes the string provided.
- `take`: how many results to show at once. By default, 20 results are shown.

The `hot` and `controversial` rankings are based off of [Reddit's own implementation of those rankings.](https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx) The `best` ranking uses the SQL implementation of the Wilson score in [How Not To Sort By Average Rating.](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)

This endpoint uses cursor-based pagination. A cursor "id" is passed into a `before` or `after` query parameter when visiting a previous or next page, respectively. Under `links`, this endpoint lists a "next" or "previous" page endpoint if present.

`POST /community/:community/posts` :key:

Creates a new Post under the identified Community. The root Community must be `ACTIVE`.

- `title`: Required. Must be no longer than 64 characters in length.
- `content`: Required. Must be no longer than 10,000 characters in length.

This will change the `lastActivity` field of the identified Community.

`GET /post/:post` :eye:

Returns the identity of the Post identified by `:post`, if a Post exists with an `id` matching the value of this parameter. If the identified Post has a status of `HIDDEN`, there must be an authenticated User, and the User must have moderator privileges over the Community this post was posted under.

```js
{
  id: 'cm3nlsorx0001bw6jcoswmlvi',
  title: 'Title of Post',
  content: 'This is a post. Lorem ipsum dolor sit amet.',
  datePosted: '2024-11-18T22:34:49.582Z',
  lastEdited: null,
  status: 'ACTIVE',
  pinned: false,
  author: { id: 1, username: 'admin' },
  community: { id: 1, urlName: 'comm', canonicalName: 'Community' },
  _count: {
      upvotes: 100,
      downvotes: 50,
      replies: 10
  }
}
```

`PUT /post/:post`​ :shield:

Edits the identity of the identified Post. Accepts the same form inputs and follows the same validation rules as `POST /community/:community/posts`. The Community must be `ACTIVE`, the Post must be `ACTIVE`, and the authenticated User must either be the original author of this Post or have moderator privileges over the Community. This will change the `lastEdited` field of the identified Post.

`POST /post/:post/upvote` :key:

Adds or removes the authenticated User to the upvotes of the identified Post. The Post and its root Community must both be `ACTIVE`.

- `upvote`: Required. Must be a boolean. `true` adds an upvote if the User has not already done so, `false` removes the upvote if the User has upvoted.

`POST /post/:postId/downvote` :key:

Adds or removes the authenticated User to the downvotes of the identified Post. The Post and its root Community must both be `ACTIVE`.

- `downvote`: Required. Must be a boolean. `true` adds a downvote if the User has not already done so, `false` removes the downvote if the User has downvoted.

`POST /post/:postId/freeze` :shield:

Sets the `status` of the identified Post to `ACTIVE` or `FROZEN`. The authenticated User must either be the original author of this Post or have moderator privileges over the root Community of this post. The root Community of this post must be `ACTIVE`.

- `freeze`: Required. Must be a boolean. `true` freezes the Post `false` unfreezes it.

`POST /post/:postId/hide` :shield:

Sets the `status` of the identified Post to `ACTIVE` or `HIDDEN`. The authenticated User must either be the original author of this Post or have moderator privileges over the root Community of this post. The root Community of this post must be `ACTIVE`.

- `freeze`: Required. Must be a boolean. `true` hides the Post, `false` unhides it.

