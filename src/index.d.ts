export {};

declare global {
  namespace Express {
    type User = Prisma.UserGetPayload<{
      include: {
        communitiesFollowed: true,
        adminOf: true,
        moderatorOf: true,
        posts: true,
        comments: true
      }
    }>;

    type Community = Prisma.CommunityGetPayload<{
      include: {
        followers: true,
        admin: true,
        moderators: true,
        posts: true,
        comments: true
      }
    }>;

    export interface Request {
      formErrors?: Record<string, string>,
      user: User,
      thisUser: User,
      thisCommunity: Community
    }
  }
}
