import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";
import { poweredBy } from "@hono/hono/powered-by";
import { extract } from '@extractus/article-extractor';
import { serveStatic } from "@hono/hono/serve-static";
import { trimTrailingSlash } from '@hono/hono/trailing-slash'
import { createMiddleware } from '@hono/hono/factory'
import BasicDbRepo from "./basicDbRepo.ts";

type Env = {
  Variables: {
    db: BasicDbRepo
  },
};

const app = new Hono<Env>();

app.get("/api/transformedHeadline", async (c) => {
  const url = c.req.query("url");
  const author = c.req.query("author");

  if (!url || !author) {
    c.status(400);
    return c.json({ error: "URL and author are required" });
  }

  try {
    // First parse the article
    const parsed = await extract(url);
    if (!parsed || !parsed.title || !parsed.content) {
      c.status(400);
      return c.json({ error: "Could not parse article" });
    }

    // Prepare the command to transform the headline
    const command = new Deno.Command("transform-headline", {
      args: [
        "--headline", parsed.title,
        "--author", author,
        "--body", parsed.content,
        "--output-format", "json",
        "--provider", "openai"
      ]
    });

    // Run the command and get the output
    const { stdout, stderr, success } = await command.output();

    if (!success) {
      const errorMessage = new TextDecoder().decode(stderr);
      c.status(500);
      return c.json({ error: `Headline transformation failed: ${errorMessage}` });
    }

    // Parse the JSON output from the command
    const result = JSON.parse(new TextDecoder().decode(stdout));
    return c.json(result);
  } catch (error) {
    c.status(500);
    return c.json({ error: `Error processing request: ${error.message}` });
  }
});

const dbMiddleware = createMiddleware(async (c, next) => {
  using db = await BasicDbRepo.create();
  c.set('db', db);
  await next()
})

app.use("/api/*", dbMiddleware);

const corsPolicy = cors({
  origin: ["*"], // TODO: Change this to trust-assembly.org, or whatever URL we're using frontend URL
  allowMethods: ["POST", "GET", "OPTIONS"],
  allowHeaders: ["Content-Type"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
});

app.use("*", logger(), poweredBy());
app.use(
  "*",
  corsPolicy,
);

app.use(trimTrailingSlash());

app.get("/api", (c) => {
  return c.text("Hello Deno!");
});

app.get("/api/parsedArticle", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    c.status(400);
    return c.json({ error: "URL is required" });
  }
  const parsed = await extract(url);
  return c.json(parsed);
});

app.get("/api/db-test", async (c) => {
  const dbClient = c.var.db;
  const result = await dbClient.getAllCreatorEdits("https://www.cnn.com/2024/12/05/politics/john-roberts-transgender-skrmetti-analysis");
  return c.json(result);
});

const v1Api = new Hono<Env>();
v1Api.use(
  "*",
  corsPolicy
);

type HeadlineData = {
  headline: string;
  creator: string;
}

function cleanUrl(url: string) {
  return url.replace(/\/(index.html)?\/?$/, "");
}

v1Api.post("/headlines", async (c) => {
  const { url } = await c.req.json();
  const dbClient = c.var.db;

  const headlineData = await dbClient.getAllCreatorEdits(cleanUrl(url));
  return c.json(headlineData);
});

app.route("/api/v1", v1Api);

app.use("/api/*", async (c) => {
  c.status(404);
  return c.json({ error: "Not found" });
});

// all non-api routes are served from the dist folder where
// the Vite build output is located (react frontend)
app.use("*", serveStatic({
  root: "./dist",
  getContent: async (path) => {
    console.log("Reading file", path);
    try {
      return await Deno.readFile(path);
    } catch {
      return await Deno.readFile("dist/index.html");
    }
  }
}));

Deno.serve(app.fetch);
