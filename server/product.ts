import { dirname, resolve } from "path";
import { fileURLToPath } from 'url'
import express from 'express';
import { Shopify } from "@shopify/shopify-api";
import formidable from 'formidable';
import Excel from 'exceljs';

interface IVariants {
  option1?: string
  option2?: string
  option3?: string
  price?: string
}

interface ITableData {
  handle: string
  title: string
  body_html: string
  product_type: string
  options: { [key: string]: any }
  variants: IVariants[]
  images: string[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const router = express.Router();
const workbook = new Excel.Workbook()

/** 产品列表 */
router.get("/", async (req, res) => {
  const session = await Shopify.Utils.loadCurrentSession(req, res, true);
  const { Product } = await import(
    `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
  );
  try {
    const data = await Product.all({ session, limit: 100 });
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

/** 添加产品产品 */
router.post("/", async (req, res) => {
  const session = await Shopify.Utils.loadCurrentSession(req, res, true);
  const { Product } = await import(
    `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
  );
  const product = new Product({ session })
  product.title = "有图片";
  product.body_html = "<strong>Good snowboard!</strong>";
  product.vendor = "Burton";
  product.product_type = "Snowboard";
  product.status = "draft";

  try {
    await product.save({});
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

/** 删除产品 */
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

/** 导入产品文件 */
router.post("/import", async (req, res) => {
  const session = await Shopify.Utils.loadCurrentSession(req, res, true);
  const { Product } = await import(
    `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
  );
  //认证通过，开始上传文件
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 2 * 1024 * 1024, // 2M
    uploadDir: resolve(__dirname, './public/images')
  });
  try {
    form.parse(req, async (err, fields, files) => {
      if (err) return err.message;
      const csvfile = files.csvfile as { filepath: string; mimetype: string }
      const fileType = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
      if (!fileType.includes(csvfile.mimetype)) return res.send({
        errorCode: 0,
        message: 'unsupported file type'
      })
      const filepath = resolve(__dirname, csvfile.filepath)
      //解析文件 
      //colNumber 第几列
      //cell.type 2：数字；3：字符串；9：布尔值
      //cell.value 内容
      try {
        if (csvfile.mimetype === 'text/csv') {
          await workbook.csv.readFile(filepath)
        } else {
          await workbook.xlsx.readFile(filepath)
        }
      } catch (err) {
        throw err;
      }
      const worksheet = workbook.getWorksheet(1);
      const aProduct: any[] = []
      let tableData: ITableData[] = []
      let option1 = ''
      let option2 = ''
      let option3 = ''
      worksheet.eachRow((row, rouwNumber) => {
        if (rouwNumber !== 1) {
          tableData.push({
            handle: '',
            title: '',
            body_html: '',
            product_type: '',
            options: {},
            variants: [],
            images: [],
          })
          const getCell = (n: number) => {
            // 获取指定单元格内容
            return row.getCell(n).value as string;
          }
          if (getCell(8) !== null) option1 = getCell(8)
          if (getCell(10) !== null) option2 = getCell(10)
          if (getCell(12) !== null) option3 = getCell(12)
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const index = rouwNumber - 2;
            const cellValue = <null | string>cell.value;
            colNumber === 1 && (tableData[index].handle = cellValue ?? '')
            colNumber === 2 && (tableData[index].title = cellValue ?? '')
            colNumber === 3 && (tableData[index].body_html = cellValue ?? '')
            colNumber === 5 && (tableData[index].product_type = cellValue ?? '')

            if (colNumber === 8) {
              if (getCell(9) !== null) {
                tableData[index].options[cellValue || option1] = [getCell(9)]
              }
              tableData[index].variants = [
                {
                  price: getCell(20),
                  ...getCell(9) !== null ? { option1: getCell(9) } : {}
                }
              ]
            }
            if (colNumber === 10) {
              if (getCell(11) !== null) {
                tableData[index].options[cellValue || option2] = [getCell(11)]
              }
              tableData[index].variants = [
                {
                  ...tableData[index].variants[0],
                  ...getCell(11) !== null ? { option2: getCell(11) } : {}
                }
              ]
            }
            if (colNumber === 12) {
              if (getCell(13) !== null) {
                tableData[index].options[cellValue || option3] = [getCell(13)]
              }
              tableData[index].variants = [
                {
                  ...tableData[index].variants[0],
                  ...getCell(13) !== null ? { option3: getCell(13) } : {}
                }
              ]
            }
            if (colNumber === 25) {
              cellValue !== null && tableData[index].images.push(cellValue)
            }
          })
        }
      })
      //同一个产品多种型号的合并 
      let data: any[] = JSON.parse(JSON.stringify(tableData))
      let n = 1//有多少列要合并
      data.forEach((item, index, arr) => {
        if (index !== 0 && item.handle === arr[index - n].handle && item.title.length === 0) {
          n++
          arr[index - n].variants.push({
            ...item.variants[0]
          })
          //以上代码经过验证，不要动
          for (const key in item.options) {
            // key:Size Color Type
            if (!arr[index - n].options[key].includes(...item.options[key])) {
              arr[index - n].options[key].push(...item.options[key])
            }
          }
        } else {
          n = 0
        }
      })
      data = data.filter(item => item.title !== '')
      data.forEach(item => {
        let arr = []
        const product = new Product({ session })
        product.title = item.title
        product.body_html = item.body_html
        product.product_type = item.product_type
        product.images = item.images.map((list: string) => ({ src: list }))
        for (const key in item.options) {
          arr.push({
            name: key,
            values: item.options[key]
          })
        }
        product.options = arr;
        product.variants = item.variants
        aProduct.push(product.save({}))
      })
      try {
        await Promise.allSettled(aProduct)
        res.send({
          data: {
            data,
            tableData
          },
          errorCode: 1,
          message: 'success'
        });
      } catch (err) {
        throw err
      }
    });
  } catch (err) {
    res.send({
      errorCode: 0,
      message: (err as Error).message
    });
  }
});

export {
  router as productRouter
}