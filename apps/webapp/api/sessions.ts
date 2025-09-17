import { Context, Hono } from "@hono/hono";
import { Env, User } from "./env.ts";
import { authenticateToken, JwtDecodeError, JwtPayload, JwtVerificationError } from "./auth.ts";
import { createMiddleware } from "@hono/hono/factory";
import { currentUser } from "./sessionUtils.ts";

class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
  }
}

const authMiddleware = createMiddleware<Env, "*", {}>(async (c, next) => {
  const session = c.var.session;
  const user = session.get('user');
  if (!user) {
    c.status(401);
    return c.json({ error: "Unauthorized" });
  }
  await next();
});

const app = new Hono<Env>()
  .post("/login", async (c) => {
    const dbClient = c.var.db;

    const userFn = async (payload: JwtPayload) => {
      const user = await dbClient.getUserByLoginProvider({
        providerType: 'google',
        remoteId: payload.sub,
      });

      if (!user) {
        throw new UserNotFoundError();
      }
      return user;
    }

    try {
      return await handleTokenRequest(c, userFn);
    } catch (e) {
      if (e instanceof UserNotFoundError) {
        c.status(401);
        return c.json({ error: e.message });
      }
      throw e;
    }
  })
  .post("/register", async (c) => {
    const dbClient = c.var.db;
 
    const userFn = async (payload: JwtPayload) => {
      return await dbClient.registerUser(
        {
          name: payload.name,
          email: payload.email,
        },
        {
          remoteId: payload.sub,
          providerType: 'google'
        }
      );
      // TODO: handle DB conflict by throwing 409
    };
    
    return await handleTokenRequest(c, userFn);
  })
  .use("/me", authMiddleware)
  .get("/me", (c) => c.json(currentUser(c)));


async function handleTokenRequest(
  c: Context<Env, "*", {}>,
  userFn: (payload: JwtPayload) => Promise<User>,
) {
  const { token } = await c.req.json();

  if (!token) {
    c.status(400);
    return c.json({ error: "Token is required" });
  }

  try {
    const payload = await authenticateToken(token);

    const user = await userFn(payload);

    const session = c.var.session;
    session.set('user', user);
    return c.json(user);
  } catch (e) {
   const error = e instanceof Error ? e : new Error(String(e));

    if (e instanceof JwtDecodeError) {
      c.status(400);
      return c.json({ error: `Invalid token: ${error.message}` });
    }

    c.status(401);

    if (e instanceof JwtVerificationError) {
      return c.json({ error: `Signature invalid: ${error.message}` });
    }

    return c.json({ error: `Unauthorized: ${error.message}` });
  }
}

export default app;
