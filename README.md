# Groves API
Groves is an arboreal clone of Reddit.

[Project Spec](https://www.theodinproject.com/lessons/node-path-nodejs-odin-book)

The units of interaction in Groves are Communities (likened to "groves"), Posts (likened to "trees" in a grove), and Replies (likened to "leaves" of a tree). Users can form Communities, create Posts in Communities, and write Replies to Posts, with Replies being nestable within other Replies. 

- A user can "vote" positively or negatively on a Post or Reply. A user's "verdancy" (likened to "greenness") is a cumulation of positive votes, countered by negative votes, their content has gotten in total.
- Communities are managed by singular Admins with a variable team of Moderators. Both Admins and Moderators can freeze or hide Posts and Replies, pin Posts, silence users, and edit the community wiki. Admins can appoint or remove Moderators, and change basic details of the Community.
- Communities have a public Action log wherein certain Community activites are recorded into Actions, such as new Posts and Replies, moderator demotions and additions, and editions to Community details.

Groves uses JSON Web Tokens to authenticate users for protected routes. When making requests to protected routes, the JWT must be passed into the `Authorization` header, preceded with `Bearer` and a space.

### Todo

- Modularize the pagination process

## Endpoint Overview

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
    verdancy: 0,
    role: 'BASIC'
}
```

- `id`: a unique integer identifying this user in the database.
- `username`: a unique, human-named string identifying this user across the site.
- `joined`: the creation date of this user's record in the database.
- `bio`: a human-customized string describing the user.
- `verdancy`: a single integer total of positive votes from this user's content.
- `role`: an enumerated string describing this user's site role. Most users are `BASIC`. Accounts belonging to site developers have the role `ADMIN`.

> `PUT /me` <sub>protected</sub> 

Edits the record of the authenticated user.

- `username`: Required. Must be between 2 and 32 characters in length. Can only consist of lowercase letters, numbers, and hyphens. If the provided `username` does not match the user's current `username`, there must exist another user in the database with the provided `username`.
- `bio`: Not required. Must not exceed 200 characters in length.
- `password`: Not required. Must be at least eight characters in length.
- `confirmPassword`: Required if `password` is provided. Must exactly match the `password` provided.
- `currentPassword`: Required if `password` is provided. Must match the user record's own `password`.

> `GET /user/:userNameOrId`

Similarly to `GET /me`, returns the identity of the user identified by the parameter `userNameOrId`, if a user exists with an `id` or `username` matching the value of this parameter.

### Community

> `GET /communities`

Returns a list of communities, paginated by 20 entries per page.

```js
{
    page: 1,
    pages: 10,
    communities: [
    	{
        	id: 1,
        	urlName: 'bestofgroves',
        	canonicalName: 'Best Of Groves',
        	description: 'The funniest and most memorable happenings on Groves.',
        	created: '2024-09-17T03:34:27.290Z',
        	lastActivity: '2024-10-17T03:34:27.290Z',
        	_count: {
            	followers: 100,
            	posts: 1000,
        	}
    	},
    	// ...
	]
}
```

- `page`: an integer representing the current page.
- `pages`: the total amount of pages in this query.
- `id`: a unique integer identifying this community in the database.
- `urlName`: a unique, human-names string identifying this community across the site.
- `canonicalName`: an informal, human-customized name for this community.
- `description`: a human-customized string describing the community.
- `created`: the creation date of this community's record in the database.
- `lastActivity`: the creation date of the latest post or reply written within this community.
- `_count`: this community's content totals.

This endpoint accepts query parameters:

- `sort`: sorts by follower count (`=followers`), post count (`=posts`), or latest activity (`=activity`) descending.
- `name`: filters for any communities whose `urlName` or `canonicalName` includes the string provided.
- `page`: fetches the page represented by the provided integer.

> `POST /communities` <sub>protected</sub> 

Creates a new community in the database, with the authenticated user automatically given admin privileges over the community.

- `urlName`: Required. Must be between 2 and 32 characters in length. Can only consist of lowercase letters and numbers. There must not exist another community in the database with the provided `urlName`.
- `canonicalName`: Required. Must be between 2 and 32 characters in length.
- `description`: Required. Cannot exceed 200 characters in length.

> `GET /community/:communityNameOrId`

Similarly to an individual item in the list provided in `GET /communities`, returns the identity of the community identified by `:communityNameOrId`, if a community exists with an `id` or `urlName` matching the value of this parameter. If the identified community has a status of `HIDDEN`, there must be an authenticated user, and the user must have admin privileges

> `PUT /community/:communityNameOrId`  <sub>protected</sub> 

Edits the record of the identified community. Follows the same validation rules as `POST /communities`. The authenticated user must have admin privileges over the community.

> `POST /community/:communityNameOrId/follow` <sub>protected</sub> 

Adds or removes the authenticated user to the "followers" list of the identified community.

- `follow`: Required. Must be a boolean. `true` follows the community, `false` unfollows it.

> `POST /community/:communityNameOrId/promote` <sub>protected</sub> 

Grants a user moderator privileges of the identified community. The authenticated user must have admin privileges over the community.

- `username`: Required. There must exist a user in the database with the provided `username` who does not already have moderator privileges over this community.

> `POST /community/:communityNameOrId/demote` <sub>protected</sub> 

Removes moderator privileges of the identified community from a user. The authenticated user must have admin privileges over the community.

- `username`: Required. There must exist a user in the database with the provided `username` who has moderator privileges over this community.

> `PUT /community/:communityNameOrId/wiki` <sub>protected</sub> 

Edits the community wiki. The authenticated user must have moderator privileges over this community.

- `wiki`: Required, but can be an empty string.

> `POST /community/:communityNameOrId/freeze` <sub>protected</sub> 

Toggles the `status` of the identified community between `ACTIVE` and `FROZEN`. The authenticated user must have admin privileges over this community.

- `password`: Required. Must match the user record's own password.

> When a community is `FROZEN`, it is in "readonly" mode. No further activity can be conducted on this community until it is thawed. This includes:
>
> - Creating, editing, freezing, hiding, or pinning Posts or Replies
> - Demoting or promoting moderators
> - Editing community details or the wiki
> - Following the community

> `GET /community/:communityNameOrId/actions`

Returns a list of actions done in the identified community, paginated by 50 entries per page.

```js
[
    {
        activity: "User #1 promoted User #3 to Moderator.",
        date: "2024-10-17T20:36:28.391Z"
    },
    // ...
]
```

- `activity`: a string describing the action. User `id`s identify the users involved.
- `date`: the creation date of this record.

This endpoint accepts query parameters:

- `actionName`: filters for any actions whose `activity` text contains the provided string.
- `before` and `after`: filters for any actions whose `date` lies in between the provided values. The string must be in ISO format, e.g. `2024-01-01`.
- `page`: fetches the page represented by the provided integer.