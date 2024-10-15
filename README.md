# Groves API
Groves is an arboreal clone of Reddit.

The units of interaction in Groves are Communities (likened to "groves"), Posts (likened to "trees" in a grove), and Replies (likened to "leaves" of a tree). Users can form Communities, create Posts in Communities, and write Replies to Posts, with Replies being nestable within other Replies. A user can "vote" positively or negatively on a Post or Reply. A user's "verdancy" (likened to "greenness") is a cumulation of positive votes, countered by negative votes, their content has gotten in total.

## Todo
- Reformat current tests, routers, and controllers to comply with modified route draft

## Rough draft of routes
### Auth
- [x] `POST /login`: accepts fields `username` and `password` and returns a token
- [x] `POST /signup`: accepts fields `username`, `password`, and `confirmPassword` and creates a User object with this information
### User
- [x] `GET /me`: returns the identity of the authenticated user
- [x] `POST /me`: edits the identity of the authenticated user with information provided in the request body
- [x] `GET /user/:userNameOrId`: returns the identity of the target user, if it exists
### Communities
- [ ] `GET /communities`: returns all existing active communities
  - Accept query params `sort` (`name`, `activity`, or `followers`) and `name` (any string)
  - Paginated by 20 results per "page"
- [x] `POST /communities`: creates a Community object with information provided in the request body
- [x] `GET /community/:communityNameOrId`: returns the details of the target Community
- [x] `PUT /community/:communityNameOrId`: edits the target Community with information provided in the request body
- [x] `POST /community/:communityNameOrId/follow`: based on `follow` being `true` or `false`, the authenticated user follows or unfollows the target Community
- [x] `POST /community/:communityNameOrId/promote`: if the authenticated user is admin of the target Community, a user with the provided `username` is appointed to a moderator of this Community
- [x] `POST /community/:communityNameOrId/demote`: if the authenticated user is admin of the target Community, a moderator with the provided `username` is removed from the moderator position of this Community
- [ ] `POST /community/:communityNameOrId/freeze`: if the authenticated user is admin of the target Community, this community will have its `status` set to "FROZEN"
<!-- ### Posts
- [ ] `GET /community/:communityNameOrId/posts`: shows all existing unhidden posts under this Community, filters using query params `name` and `sort` (Community moderators can see hidden posts)
- [ ] `POST /community/:communityNameOrId/posts`: accepts field `title` and `content` and creates a Post object under this Community with this information
- [ ] `GET /post/:postId`: shows a post (if not hidden) and its details
- [ ] `PUT /post/:postId`: accepts field `title` and `content` and edits the Post object with this information
- [ ] `POST /post/:postId/status`: toggles status of Post between
- - `ACTIVE`: can be replied to by anyone, voted by anyone, edited by author and moderators
- - `FROZEN`: can be replied to by moderators, not voted, edited by moderators
- - `HIDDEN`: same as `FROZEN` but cannot be seen by anyone except moderation
- [ ] `POST /post/:postId/vote`: accepts field `up` as boolean and increments Post's `upvote` or `downvote` count with this information
### Comments
- [ ] `GET /post/:postId/comments`: shows all existing comments under this Post, sort using query params `sort` (hidden posts are rendered as "hidden")
- [ ] `POST /post/:postId/comments`: accepts fields `content` and `parent` and creates a new Comment object as child under targeted Comment or under root of Post
- [ ] `GET /comment/:commentId`: shows all details of a comment
- [ ] `POST /comment/:commentId/status`: toggles status of Comment between
- - `ACTIVE`: can be replied to by anyone, voted by anyone
- - `FROZEN`: cannot be replied to or voted
- - `HIDDEN`: same as `FROZEN` but cannot be seen by anyone except moderation
- [ ] `POST /comment/:commentId/vote`: accepts field `up` as boolean and increments Comment's `upvote` or `downvote` count with this information -->