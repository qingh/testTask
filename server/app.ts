import { fileURLToPath } from 'url'
import { dirname, resolve } from "path";
import { URLSearchParams } from 'url';
import express, { Express } from "express";
import cookieParser from "cookie-parser";
import { Shopify } from "@shopify/shopify-api";
import "dotenv/config";
import { shopInit } from './shopifyInit.js';
import applyAuthMiddleware from "./middleware/auth.js";
import { productRouter } from './product.js';

const PORT = 8081
const { NODE_ENV, VITE_TEST_BUILD } = process.env
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isTest = NODE_ENV === "test" || !!VITE_TEST_BUILD;
shopInit()
export async function createServer(
  root = process.cwd(),
  isProd = NODE_ENV === "production"
) {
  const app: Express = express()
  app.set("top-level-oauth-cookie", "shopify_top_level_oauth");
  app.set("active-shopify-shops", {});
  app.set("use-online-tokens", true);

  //静态文件访问
  app.use(express.static(resolve(__dirname, 'public')))
  app.use(cookieParser(Shopify.Context.API_SECRET_KEY));
  app.use(express.json());
  applyAuthMiddleware(app);

  app.post("/webhooks", async (req, res) => {
    try {
      await Shopify.Webhooks.Registry.process(req, res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
      if (!res.headersSent) {
        res.status(500).send((error as Error).message);
      }
    }
  });

  //product 路由
  app.use('/product', productRouter)

  app.use((req, res, next) => {
    const shop = req.query.shop;
    if (Shopify.Context.IS_EMBEDDED_APP && shop) {
      res.setHeader(
        "Content-Security-Policy",
        `frame-ancestors https://${shop} https://admin.shopify.com;`
      );
    } else {
      res.setHeader("Content-Security-Policy", `frame-ancestors 'none';`);
    }
    next();
  });

  app.use("/*", (req, res, next) => {
    const { shop } = req.query;

    // Detect whether we need to reinstall the app, any request from Shopify will
    // include a shop in the query parameters.
    if (app.get("active-shopify-shops")[shop as string] === undefined && shop) {
      const params = JSON.parse(JSON.stringify(req.query))
      res.redirect(`/auth?${new URLSearchParams(params).toString()}`);

    } else {
      next();
    }
  });

  let vite;
  if (!isProd) {
    vite = await import("vite").then(({ createServer }) =>
      createServer({
        root,
        logLevel: isTest ? "error" : "info",
        server: {
          port: PORT,
          hmr: {
            protocol: "ws",
            host: "localhost",
            port: 64999,
            clientPort: 64999,
          },
          middlewareMode: "html",
        },
      })
    );
    app.use(vite.middlewares);
  } else {
    const compression = await import("compression").then(
      ({ default: fn }) => fn
    );
    const serveStatic = await import("serve-static").then(
      ({ default: fn }) => fn
    );
    const fs = await import("fs");
    app.use(compression());
    app.use(serveStatic(resolve("dist/client")));
    app.use("/*", (req, res, next) => {
      // Client-side routing will pick up on the correct route to render, so we always render the index here
      res
        .status(200)
        .set("Content-Type", "text/html")
        .send(fs.readFileSync(`${process.cwd()}/dist/client/index.html`));
    });
  }
  return { app, vite };
}

if (!isTest) {
  createServer().then(({ app }) => app.listen(PORT));
}
