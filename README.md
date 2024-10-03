# Groves API
Groves is an arboreal clone of Reddit.

## Rough draft of routes
### Auth
- [x] `POST /login`: accepts fields `username` and `password` and returns a token
- [x] `POST /signup`: accepts fields `username`, `password`, and `confirmPassword` and creates a User object with this information
- [x] `GET /`: returns `200` if valid token provided and `400` otherwise
### User
- [ ] `GET /user/:userNameOrId`: shows details of user if exists
- [ ] `POST /account`: accepts fields `username`, `bio`, `password`, `confirmPassword`, and `currentPassword` and edits the authenticated User with this information
- [ ] `DELETE /account`: accepts field `password` and deletes the authenticated User object
### Communities
- [ ] `GET /communities`: shows all existing unarchived communities, filters using query params `name` and `sort`
- [ ] `POST /communities`: accepts field `name` and creates a Community object with this information
- [ ] `GET /community/:communityNameOrId`: shows an Community and its details
- [ ] `POST /community/:communityNameOrId`: accepts fields `name` and `wiki` and edits the Community object with this information
- [ ] `POST /community/:communityNameOrId/promote`: accepts field `username` and appoints a User as "moderator" for this Community (admins also have mod powers)
- [ ] `POST /community/:communityNameOrId/demote`: accepts field `username` and removes a "moderator" of this Community from their position
- [ ] `POST /community/:communityNameOrId/status`: toggles status of Community between
- - `ACTIVE`: can be posted to by anyone, followed by anyone, edited by moderation only
- - `FROZEN`: "archived", cannot be interacted with by anyone, even admin
- - `HIDDEN`: (only site admins can do this) same as `FROZEN` but cannot be seen by anyone, not even admin
### Posts
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
- [ ] `POST /comment/:commentId/vote`: accepts field `up` as boolean and increments Comment's `upvote` or `downvote` count with this information