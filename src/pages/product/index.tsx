import { ChangeEvent, useEffect, useState } from "react";
import defaultImg from '../../asset/images/default.png';
import css from './index.module.less';
import { useHttp } from '../../utils/useHttp';
interface IProduct {
  id: number
  title: string
  body_html: string
  variants: { price: string }[]
  image: {
    src: string
  }
}

export function Product() {
  const http = useHttp()
  const [list, setList] = useState<IProduct[]>([])

  async function getProductList() {
    const [err, res] = await http({ url: '/product' })
    if (err) return console.log(err);
    const { errorCode, message, data } = res
    if (!errorCode) return console.log(message);
    setList(data)
  }

  async function addProduct() {
    const [err, res] = await http({ url: '/product', method: 'POST' })
    if (err) return console.log(err);
    const { errorCode, message } = res
    if (!errorCode) return console.log(message);
    getProductList()
  }

  async function one() {
    const [err, res] = await http({ url: '/product/one', method: 'POST' })
    if (err) return console.log(err);
    const { errorCode, message } = res
    if (!errorCode) return console.log(message);
    getProductList()
  }

  async function exportProducts(ev: ChangeEvent) {
    const target = ev.target as HTMLInputElement
    const body = new FormData()
    const file = target.files![0]
    if (file.type !== 'text/csv') return console.log('unsupported file type')
    body.append('csvfile', file)
    const [err, res] = await http({ url: '/product/import', method: 'POST', body })
    target.value = ''
    if (err) return console.log(err);
    const { errorCode, message } = res
    if (!errorCode) return console.log(message);
    getProductList()
  }

  async function deleteProduct(id: number) {
    const isDelete = confirm('确定删除商品吗')
    if (isDelete) {
      const [err, res] = await http({ url: `/product/${id}`, method: 'DELETE' })
      // const [err, res] = await http({ url: `/product/variants/${id}` })
      if (err) return console.log(err);
      const { errorCode, message } = res
      if (!errorCode) return console.log(message);
      getProductList()
    }
  }

  async function addProductAttr(id: number) {
    const [err, res] = await http({ url: `/product/variants/${id}`, method: 'POST', body: { user: 'zhang' } })
    if (err) return console.log(err);
    const { errorCode, message } = res
    if (!errorCode) return console.log(message);
    getProductList()
  }

  useEffect(() => {
    getProductList()
  }, [])

  return (
    <>
      <input type="file" accept="text/csv" onChange={(ev) => exportProducts(ev)} />
      {/* <button type="button" onClick={() => {
        http({ url: '/product/variants/8002642706672', body: { user: 'qingh' } })
      }}>test</button> */}
      <button type="button" onClick={() => one()}>添加商品，没有图片</button>
      <button type="button" onClick={() => addProduct()}>添加商品，有图片</button>
      <button type="button" onClick={() => getProductList()}>重新获取商品列表</button>
      {/* <button type="button" onClick={() => exportProducts()}>批量导入商品</button> */}
      <ul className={css.list}>
        {
          list.map(item => <li key={item.id} onClick={() => addProductAttr(item.id)} title={item.title}>
            <div>
              <img src={item.image ? item.image.src : defaultImg} width="225" height="225" alt="" />
              <div>
                <strong className={css.price}>￥{item.variants[0].price}</strong>
                <strong className={css.title}>{item.title}</strong>
              </div>
              <div dangerouslySetInnerHTML={{ __html: item.body_html }}></div>
            </div>
          </li>)
        }
      </ul>
    </>
  )
}
