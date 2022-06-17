import { http } from './axios'



const productService = {
  list: () => http({ url: '/list' })
}

export { productService }
