# JSON Server Template
- **Lang:** TypeScript + Express.js Framework
- **Database:** Postgresql + Prisma ORM
- **Protection method:** JSON Web Token
- **Testing:** Jest with Docker for the temp database
- **Linting:** ESLint with the Airbnb style guide

## Rationale
**Why TypeScript?**
TypeScript alone has several general benefits to the codebase.
- Peace of mind and ease of testing with type safety
- Usage of module importing
- IntelliSense provided by the IDE

**Why Express.js?**
Express is lightweight and flexible. Although more, newer options exist, Express's age lends to its stability, extensive documentation, and ease of researching issues and tutorials.

**Why Postgresql?**
It was just the first SQL database I'd been exposed to. It meets my needs, so I don't have a lot of incentive to look at other SQL databases. As to why SQL alone should be used over non-relational databases such as MongoDB, SQL's age lends to stability, documentation, and robust research. Plus, at personal project size, the difference in development and performance between SQL and NoSQL is somewhat negligible.

**Why Prisma?**
Likewise, Prisma is the first ORM I'd been exposed to. As to why an ORM should be used in general, ORMs can define database schemas, standardize migrations, and greatly reduce written raw SQL.

## Todo
- ...