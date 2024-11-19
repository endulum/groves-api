# Groves API

Groves is an arboreal semiclone of Reddit.

[Project Spec](https://www.theodinproject.com/lessons/node-path-nodejs-odin-book)

The units of interaction in Groves are Communities (likened to "groves"), Posts (likened to "trees" in a grove), and Replies (likened to "leaves" of a tree). Users can form Communities, create Posts in Communities, and write Replies to Posts, with Replies being nestable within other Replies.

- A user can "vote" positively or negatively on a Post or Reply. A user's "verdancy" (likened to "greenness") is a cumulation of positive votes, countered by negative votes, their content has gotten in total.
- Communities are managed by singular Admins with a variable team of Moderators. Both Admins and Moderators can freeze or hide Posts and Replies, pin Posts, silence users, and edit the community wiki. Admins can appoint or remove Moderators, and change basic details of the Community.
- Communities have a public Action log wherein certain Community activites are recorded into Actions, such as new Posts and Replies, moderator demotions and additions, and editions to Community details.

Groves uses JSON Web Tokens to authenticate users for protected routes. When making requests to protected routes, the JWT must be passed into the `Authorization` header, preceded with `Bearer` and a space.

### Todos

- Go through this document and fix up missing features in the codebase
- Pinning and unpinning Posts
- Paginated search for Posts
- Add voting to schema and manage voting

## Endpoint Overview

### Errors

On routes requiring form input, if the input does not pass validation, the route returns a status of `400` as well as an `errors` object consisting of an array of the described errors.

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

> `POST /login`

Returns a signed JWT representing the user identified by the provided credentials.

- `username`: Required. There must exist a user in the database with the provided `username`.
- `password`: Required. Assuming the user record was identified with the `username`, the `password` must match the user record's own `password`.

> `POST /signup`

Creates a new user in the database.

- `username`: Required. Must be between 2 and 32 characters in length. Can only consist of lowercase letters, numbers, and hyphens. There must not exist a user in the database with the provided `username`.
- `password`: Required. Must be at least eight characters in length.
- `confirmPassword`: Required. Must exactly match the `password` provided.

> `GET /me` <sub>protected</sub>

Returns the identity of the authenticated user.

```js
{
    id: 1,
    username: "demo-user",
    joined: '2024-10-17T03:06:39.758Z',
    bio: 'Demo user of Groves.'
    role: 'BASIC',
}
```

> `PUT /me` <sub>protected</sub>

Edits the identity of the authenticated user.

- `username`: Required. Must be between 2 and 32 characters in length. Can only consist of lowercase letters, numbers, and hyphens. If the provided `username` does not match the user's current `username`, there must exist another user in the database with the provided `username`.
- `bio`: Not required. Must not exceed 200 characters in length.
- `password`: Not required. Must be at least eight characters in length.
- `confirmPassword`: Required if `password` is provided. Must exactly match the `password` provided.
- `currentPassword`: Required if `password` is provided. Must match the user record's own `password`.

> `GET /user/:userNameOrId`

Similarly to `GET /me`, returns the identity of the user identified by the parameter `userNameOrId`, if a user exists with an `id` or `username` matching the value of this parameter.

### Community

> `GET /communities`

Returns a paginated list of communities. A community must have a status of `ACTIVE` to show up in this endpoint.

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
- `name`: filters for any communities whose `urlName` or `canonicalName` includes the string provided.
- `take`: how many results to show at once. By default, 15 results are shown.

This endpoint uses cursor-based pagination. A cursor "id" is passed into a `before` or `after` query parameter when visiting a previous or next page, respectively. Under `links`, this endpoint lists a "next" or "previous" page endpoint if present.

> `POST /communities` <sub>protected</sub>

Creates a new community in the database, with the authenticated user automatically given admin privileges over the community.

- `urlName`: Required. Must be between 2 and 32 characters in length. Can only consist of lowercase letters and numbers. There must not exist another community in the database with the provided `urlName`.
- `canonicalName`: Required. Must be between 2 and 32 characters in length.
- `description`: Not required. Cannot exceed 200 characters in length.

> `GET /community/:communityNameOrId`

Returns the identity of the community identified by `:communityNameOrId`, if a community exists with an `id` or `urlName` matching the value of this parameter. If the identified community has a status of `HIDDEN`, there must be an authenticated user, and the user must have admin privileges over this community.

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
  moderators: [ { id: 2, username: 'demo-1' }, { id: 3, username: 'demo-2' } ]
}
```

> `PUT /community/:communityNameOrId` <sub>protected</sub>

Edits the record of the identified community. Follows the same validation rules as `POST /communities`. The community must be `ACTIVE` and the authenticated user must have admin privileges over the community.

> `POST /community/:communityNameOrId/follow` <sub>protected</sub>

Adds or removes the authenticated user to the "followers" list of the identified community. The community must be `ACTIVE`.

- `follow`: Required. Must be a boolean. `true` follows the community, `false` unfollows it.

> `POST /community/:communityNameOrId/promote` <sub>protected</sub>

Grants a user moderator privileges of the identified community. The community must be `ACTIVE` and the authenticated user must have admin privileges over the community.

- `username`: Required. There must exist a user in the database with the provided `username` who does not already have moderator privileges over this community.

> `POST /community/:communityNameOrId/demote` <sub>protected</sub>

Removes moderator privileges of the identified community from a user. The community must be `ACTIVE` and the authenticated user must have admin privileges over the community.

- `username`: Required. There must exist a user in the database with the provided `username` who has moderator privileges over this community.

> `GET /community/:communityNameOrId/wiki`

Returns a `content` Markdown-supported string consisting of the community's wiki text. If the identified community has a status of `HIDDEN`, there must be an authenticated user, and the user must have admin privileges over this community.

> `PUT /community/:communityNameOrId/wiki` <sub>protected</sub>

Edits the community wiki. The community must be `ACTIVE` and the authenticated user must have moderator privileges over this community.

- `content`: Not required. Can be an empty string to "clear" the wiki.

> `POST /community/:communityNameOrId/freeze` <sub>protected</sub>

Sets the `status` of the identified community to `ACTIVE` or `FROZEN`. The authenticated user must have admin privileges over this community.

- `freeze`: Required. Must be a boolean. `true` freezes the community, `false` unfreezes it.

### Posts

> `GET /post/:postId`

Returns the details of the post identified by `:postId`, if a post exists with an `id` matching the value of this parameter. If the identified post has a status of `HIDDEN`, there must be an authenticated user, and the user must have moderator privileges over the community this post was posted under.

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
  replies: [],
  voting: {
      upvotes: 0,
      downvotes: 0,
      voted: false
  }
}
```

- The `replies` property should host an array of reply trees.
- The `voted` property under `voting` will be `null` if there is no authenticated user, and `true` or `false` depending on whether the authenticated user added a vote to this post.

> `POST /community/:communityId/posts` <sub>protected</sub>

Creates a new post in the database, with the root community identified through the `communityId` parameter. The root community must be `ACTIVE`.

- `title`: Required. Must be no longer than 64 characters in length.
- `content`: Required. Must be no longer than 10,000 characters in length. Supports markdown.

> `PUT /post/:postId` <sub>protected</sub>

Edits the identified post. Follows the same validation rules as `POST /community/:communityId/posts`. The root community must be `ACTIVE` and the authenticated user must be the original author of this post.

> `POST /post/:postId/freeze` <sub>protected</sub>

Sets the `status` of the identified post to `ACTIVE` or `FROZEN`. The authenticated user must either be the original author of this post, or have moderator privileges over the root community of this post. The root community of this post must be `ACTIVE`.

- `freeze`: Required. Must be a boolean. `true` freezes the post `false` unfreezes it.

> `POST /post/:postId/hide` <sub>protected</sub>

Sets the `status` of the identified post to `ACTIVE` or `HIDDEN`. The authenticated user must either be the original author of this post, or have moderator privileges over the root community of this post. The root community of this post must be `ACTIVE`.

- `freeze`: Required. Must be a boolean. `true` hides the post, `false` unhides it.

### Actions

> `GET /community/:communityNameOrId/actions`

Returns a list of actions done in the identified community, paginated by 50 entries per page.

```js
[
  {
    activity: 'User #1 promoted User #3 to Moderator.',
    date: '2024-10-17T20:36:28.391Z',
  },
  // ...
];
```

- `activity`: a string describing the action. User `id`s identify the users involved.
- `date`: the creation date of this record.

This endpoint accepts query parameters:

- `actionName`: filters for any actions whose `activity` text contains the provided string.
- `before` and `after`: filters for any actions whose `date` lies in between the provided values. The string must be in ISO format, e.g. `2024-01-01`.
- `page`: fetches the page represented by the provided integer.
