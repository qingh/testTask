import { dirname, resolve } from "path";
import { fileURLToPath } from 'url'
import express from 'express';
import { Shopify } from "@shopify/shopify-api";
import formidable from 'formidable';
import Excel from 'exceljs';

interface IFilterList {
  handle: string
  src: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const router = express.Router();
const workbook = new Excel.Workbook()


router.post('/test', async (req, res) => {
  res.setHeader('content-type', 'application/json')
  console.log(req.body);
  res.end('test')
})
router.post("/one", async (req, res) => {
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

router.get("/", async (req, res) => {
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

router.post("/", async (req, res) => {
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

router.delete("/:id", async (req, res) => {
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

router.post("/import", async (req, res) => {
  const session = await Shopify.Utils.loadCurrentSession(req, res, true);
  const { Product, Image, Variant } = await import(
    `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
  );
  //认证通过，开始上传文件
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 2 * 1024 * 1024, // 2M
    uploadDir: resolve(__dirname, '../public/images')
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
    const aJumpRow = [1]//要跳过的行
    const aImg = <IFilterList[]>[]
    const aProduct: any[] = []
    const aImage: any[] = []
    worksheet.eachRow((row, rouwNumber) => {
      if (row.getCell(2).value === null) {
        aJumpRow.push(rouwNumber)
      }
      if (!aJumpRow.includes(rouwNumber)) {
        const product = new Product({ session })
        aImg.push({
          handle: row.getCell(1).value as string,
          src: row.getCell(25).value as string
        })
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          // console.log(`类型：:${cell.type}；${rouwNumber}行${colNumber}列:${cell.value}`);
          
          colNumber === 2 && (product.title = cell.value);
          colNumber === 3 && (product.body_html = cell.value);
          colNumber === 5 && (product.product_type = cell.value);
          colNumber === 6 && (product.tags = cell.value);
          colNumber === 7 && (product.status = cell.value ? 'active' : 'draft');
          if (colNumber === 20) {
            product.options = [
              {
                "name": "Color",
                "position": 0,
                "values": [
                  "红",
                  "蓝"
                ]
              },
              {
                "name": "Size",
                "position": 1,
                "values": [
                  "L",
                  "XL"
                ]
              },
            ]
            product.variants = [
              {
                "sku": "red_L",
                "title": "red,L",
                "price": "34.95",
                "presentment_prices": {
                  "compare_at_price": {
                    "amount": "34.95",
                    "currency_code": "EUR"
                  }
                },
                "weight": "700",
                "weight_unit": "",
                "option1": "红",
                "option2": "L",
              },
              {
                "sku": "red_XL",
                "title": "red,XL",
                "price": "35.95",
                "presentment_prices": {
                  "compare_at_price": {
                    "amount": "34.95",
                    "currency_code": "EUR"
                  }
                },
                "weight": "700",
                "weight_unit": "",
                "option1": "红",
                "option2": "XL",
              },
              {
                "sku": "blue_L",
                "title": "blue,L",
                "price": "34.95",
                "presentment_prices": {
                  "compare_at_price": {
                    "amount": "34.95",
                    "currency_code": "EUR"
                  }
                },
                "weight": "700",
                "weight_unit": "",
                "option1": "蓝",
                "option2": "L",
              },
              {
                "sku": "blue_XL",
                "title": "blue,XL",
                "price": "34.95",
                "presentment_prices": {
                  "compare_at_price": {
                    "amount": "34.95",
                    "currency_code": "EUR"
                  }
                },
                "weight": "700",
                "weight_unit": "",
                "option1": "蓝",
                "option2": "XL",
              },
            ]
          }
        })
        aProduct.push(product.save({}))
      }
    })
    try {
      await Promise.allSettled(aProduct)
      const count = await Product.count({ session });
      console.log('count', count);
      console.log('rowCount', worksheet.rowCount);
      const productList = await Product.all({ session });
      productList.forEach((item: { id: number } & IFilterList) => {
        aImg.forEach((list: IFilterList) => {
          if (item.handle === list.handle) {
            const image = new Image({ session })
            image.product_id = item.id;
            image.src = list.src
            aImage.push(image.save({}))
          }
        })
      });
      await Promise.allSettled(aImage)
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
});

router.get('/variants/:id', async (req, res) => {
  const session = await Shopify.Utils.loadCurrentSession(req, res, true);
  const { Variant } = await import(
    `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
  );
  const { id } = req.params
  console.log('id', id);
  try {
    const data = await Variant.find({ session, id, });
    console.log(data);
    res.send({
      errorCode: 1,
      message: 'success'
    })
  } catch (err) {
    res.send({
      errorCode: 0,
      message: (err as Error).message
    })
  }
})

router.post('/variants/:id', express.text(), async (req, res) => {
  const session = await Shopify.Utils.loadCurrentSession(req, res, true);
  const { Variant } = await import(
    `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
  );
  try {
    console.log(req.body);
    const variant = new Variant({ session });
    variant.product_id = req.params.id;
    variant.option1 = "Yellow";
    // variant.option2 = "传统样式";
    // variant.option3 = "很大哟";
    variant.price = "1.10";
    await variant.save({});
    res.send({
      errorCode: 1,
      message: 'success'
    })
  } catch (err) {
    res.send({
      errorCode: 0,
      message: (err as Error).message
    })
  }
})

export {
  router as productRouter
}
