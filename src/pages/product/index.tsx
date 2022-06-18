import { ChangeEvent, useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { userLoggedInFetch } from '../../App';
import defaultImg from '../../asset/images/default.png';
import css from './index.module.less';

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
  const [list, setList] = useState<IProduct[]>([])
  const app = useAppBridge();
  const fetch = userLoggedInFetch(app);

  async function getProductList() {
    const data = await fetch("/getProductList").then((res) => res!.json())
    setList(data)
  }

  async function addProduct() {
    const data = await fetch("/addProduct", {
      method: 'POST'
    }).then((res) => res!.json())
    console.log(data);
    getProductList()
  }

  async function one() {
    const data = await fetch("/one", {
      method: 'POST'
    }).then((res) => res!.json())
    console.log(data);
    getProductList()
  }

  async function exportProducts(ev: ChangeEvent) {
    const target = ev.target as HTMLInputElement
    console.log(target.files);
    const fd = new FormData()
    fd.append('csvfile', target.files![0])
    const data = await fetch("/exportProducts", {
      method: 'POST',
      body: fd
    }).then((res) => res!.json())
    console.log(data);
    getProductList()
  }

  async function deleteProduct(id: number) {
    const res = confirm('确定删除商品吗')
    if (res) {
      const data = await fetch(`/deleteProduct?id=${id}`, { method: 'DELETE' }).then((res) => res!.json())
      getProductList()
    }
  }

  useEffect(() => {
    getProductList()
  }, [])

  return (
    <>
      <input type="file" onChange={(ev) => exportProducts(ev)} />
      <button type="button" onClick={() => one()}>添加商品，没有图片</button>
      <button type="button" onClick={() => addProduct()}>添加商品，有图片</button>
      <button type="button" onClick={() => getProductList()}>重新获取商品列表</button>
      {/* <button type="button" onClick={() => exportProducts()}>批量导入商品</button> */}
      <ul className={css.list}>
        {
          list.map(item => <li key={item.id} onClick={() => deleteProduct(item.id)}>
            <div>
              <img src={item.image ? item.image.src : defaultImg} width="225" height="225" alt="" />
              <div>
                <strong style={{ color: 'red' }}>￥{item.variants[0].price}</strong>
                <p>{item.title}</p>
              </div>
              <div dangerouslySetInnerHTML={{ __html: item.body_html }}></div>
            </div>
          </li>)
        }
      </ul>
    </>
  )
}
