export {};

declare global {
  namespace Express {
    type User = Prisma.UserGetPayload<{
      include: {
        communitiesFollowing: true;
        communitiesAdminOf: true;
        communitiesModeratorOf: true;
        posts: true;
        replies: true;
      };
    }>;

    type Community = Prisma.CommunityGetPayload<{
      include: {
        followers: true;
        admin: true;
        moderators: true;
        posts: true;
        replies: true;
      };
    }>;

    export interface Request {
      formErrors?: Record<string, string>;
      user: User;
      thisUser: User;
      thisCommunity: Community;
    }
  }
}
