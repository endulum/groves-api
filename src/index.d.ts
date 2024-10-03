export {};

declare global {
  namespace Express {
    type User = Prisma.UserGetPayload<>;

    export interface Request {
      formErrors?: Record<string, string>,
      user: User,
      thisUser: User
    }
  }
}
