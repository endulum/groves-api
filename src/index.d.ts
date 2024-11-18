export {};

declare global {
  namespace Express {
    export interface Request {
      formErrors?: Record<string, string>;
      user: Prisma.User;
      thisUser: Prisma.User;
      thisCommunity: Prisma.Community;
    }
  }
}
