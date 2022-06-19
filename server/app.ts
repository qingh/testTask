import { fileURLToPath } from 'url'
import { dirname, resolve } from "path";
import { URLSearchParams } from 'url';
import express, { Express } from "express";
import cookieParser from "cookie-parser";
import { Shopify } from "@shopify/shopify-api";
import "dotenv/config";
import { shopInit } from './shopifyInit.js';
import applyAuthMiddleware from "./middleware/auth.js";
import verifyRequest from "./middleware/verify-request.js";
import formidable from 'formidable';
import Excel from 'exceljs';

interface IFilterList {
  handle: string
  src: string
}

const PORT = 8081;
const { NODE_ENV, VITE_TEST_BUILD } = process.env
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workbook = new Excel.Workbook()
const isTest = NODE_ENV === "test" || !!VITE_TEST_BUILD;

shopInit()

export async function createServer(
  root = process.cwd(),
  isProd = NODE_ENV === "production"
) {
  const app: Express = express();
  app.set("top-level-oauth-cookie", "shopify_top_level_oauth");
  app.set("active-shopify-shops", {});
  app.set("use-online-tokens", true);

  //静态文件访问
  app.use(express.static(resolve(__dirname, 'public')))
  app.use(cookieParser(Shopify.Context.API_SECRET_KEY));

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

  app.post("/one", verifyRequest(app), async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    const { Product, Variant } = await import(
      `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );
    console.log(Shopify.Context.API_VERSION);
    const product = new Product({ session })
    product.title = "增加一个没有图片的";
    product.body_html = "<strong>Good snowboard!</strong>";
    product.vendor = "Burton";
    product.product_type = "Snowboard";
    product.status = "draft";
    /* product.options = [{
      name: '尺寸',
      value: ['大']
    },
    {
      name: '颜色',
      value: ['绿色']
    },
    {
      name: '材料',
      value: ['橡胶']
    }] */
    await product.save({});
    const data = await Product.all({ session });
    data.forEach(async (item: { id: number }) => {
      if (item.id !== 8002044231920) {
        const variant = new Variant({ session })
        variant.product_id = item.id;
        variant.option1 = "Yellow";
        variant.price = "111111.00";
        await variant.save({});
      }
    })
    res.send({
      errorCode: 1,
      message: 'success'
    });
  })

  app.get("/product", verifyRequest(app), async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    const { Product } = await import(
      `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );
    try {
      const data = await Product.all({ session });
      res.send({
        errorCode: 1,
        message: 'success',
        data
      });
    } catch (err) {
      res.send({
        errorCode: 0,
        message: (<Error>err).message
      });
    }
  });

  app.post("/product", verifyRequest(app), async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    const { Product, Image } = await import(
      `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );
    const product = new Product({ session })
    product.title = "有图片";
    product.body_html = "<strong>Good snowboard!</strong>";
    product.vendor = "Burton";
    product.product_type = "Snowboard";
    product.status = "draft";
    await product.save({});

    const data = await Product.all({ session });
    data.forEach(async (item: { id: number, images: any[] }) => {
      console.log(item.id, item.images);
      if (item.images.length === 0) {
        const image = new Image({ session });
        image.product_id = item.id;
        image.src = "https://burst.shopifycdn.com/photos/dark-wall-bedside-table_925x.jpg"
        await image.save({})
      }
    })
    res.send({
      errorCode: 1,
      message: 'success'
    });
  });

  app.delete("/product/:id", verifyRequest(app), async (req, res) => {
    const { id } = req.params
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    const { Product } = await import(
      `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );
    try {
      await Product.delete({ session, id })
      res.send({
        errorCode: 1,
        message: 'success'
      });
    } catch (err) {
      res.send({
        errorCode: 0,
        message: (err as Error).message
      });
    }
  });

  app.post("/product/import", verifyRequest(app), async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    const { Product, Image } = await import(
      `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );
    //认证通过，开始上传文件
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 2 * 1024 * 1024, // 2M
      uploadDir: resolve(__dirname, 'public/images')
    });
    form.parse(req, async (err, fields, files) => {
      if (err) return err.message;
      const csvfile = files.csvfile as { filepath: string; mimetype: string }
      if (csvfile.mimetype !== 'text/csv') return res.send({
        errorCode: 0,
        message: 'unsupported file type'
      })
      const filepath = resolve(__dirname, csvfile.filepath)
      //解析文件 
      //colNumber 第几列
      //cell.type 2：数字；3：字符串；9：布尔值
      //cell.value 内容
      await workbook.csv.readFile(filepath)
      const worksheet = workbook.getWorksheet(1);
      const jumpRow = [1]
      const aImg = <IFilterList[]>[]
      let flag = false;
      worksheet.eachRow(async (row, rouwNumber) => {
        if (row.getCell(2).value === null) {
          jumpRow.push(rouwNumber)
        }
        if (!jumpRow.includes(rouwNumber)) {
          const product = new Product({ session })
          aImg.push({
            handle: row.getCell(1).value as string,
            src: row.getCell(25).value as string
          })
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            // console.log(`类型：:${cell.type}；${rouwNumber}行${colNumber}列:${cell.value}`);
            // colNumber === 2 && (product.title = cell.value || '默认标题2');
            colNumber === 2 && (product.title = cell.value);
            colNumber === 3 && (product.body_html = cell.value);
            colNumber === 5 && (product.product_type = cell.value);
            colNumber === 6 && (product.tags = cell.value);
            colNumber === 7 && (product.status = cell.value ? 'active' : 'draft');
            // if (colNumber === 8) {
            //   product.options = [
            //     { "name": "Size" },
            //     { "name": "Colour" },
            //     { "name": "Material" }
            //   ]
            // }
            if (colNumber === 20) {
              product.variants = [];
              product.variants.push({
                price: cell.value || '0.00'
              })
            }
          })
          // await product.save({})
          product.save({})
          const count = await Product.count({ session });
          console.log('1=>', count);
          if (!flag) {
            console.log('2=>', count);
            flag = true;
            const data = await Product.all({ session });
            data.forEach(async (item: { id: number } & IFilterList) => {
              const image = new Image({ session })
              image.product_id = item.id;
              aImg.forEach((list: IFilterList) => {
                if (item.handle === list.handle) {
                  image.src = list.src
                  // image.src = 'https://cdn.shopify.com/s/files/1/0650/9815/4224/files/31ebc4370166f179d3bfdc3e4fceb5b0.jpg?v=1655537367'
                }
              })
              await image.save({})
            })
            res.send({
              errorCode: 1,
              message: 'success'
            });
          }
        }
      })
    });
  });

  app.use(express.json());

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

  /**
   * @type {import('vite').ViteDevServer}
   */
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
