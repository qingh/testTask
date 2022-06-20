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

  /** 产品列表 */
  async function getProductList() {
    const [err, res] = await http({ url: '/product' })
    if (err) return console.log(err);
    const { errorCode, message, data } = res
    if (!errorCode) return console.log(message);
    setList(data)
  }

  /** 从附件导入产品 */
  async function importProductsFromFile(ev: ChangeEvent) {
    const target = ev.target as HTMLInputElement
    const body = new FormData()
    const file = target.files![0]
    const fileType = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!fileType.includes(file.type)) return console.log('unsupported file type')
    body.append('csvfile', file)
    const [err, res] = await http({ url: '/product/import', method: 'POST', body })
    target.value = ''
    if (err) return console.log(err);
    const { errorCode, message } = res
    if (!errorCode) return console.log(message);
    getProductList()
  }

  /** 删除产品 */
  async function deleteProduct(id: number) {
    const isDelete = confirm('确定删除商品吗')
    if (isDelete) {
      const [err, res] = await http({ url: `/product/${id}`, method: 'DELETE' })
      if (err) return console.log(err);
      const { errorCode, message } = res
      if (!errorCode) return console.log(message);
      getProductList()
    }
  }

  useEffect(() => {
    getProductList()
  }, [])

  return (
    <>
      <div>
        <input type="file" onChange={(ev) => importProductsFromFile(ev)} accept="text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        <button type="button" onClick={() => getProductList()}>获取商品列表</button>
      </div>
      <ul className={css.list}>
        {
          list.map(item => <li key={item.id} onClick={() => deleteProduct(item.id)} title={item.title}>
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
