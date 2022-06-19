import { useAppBridge } from "@shopify/app-bridge-react";
import { userLoggedInFetch } from '../App';

interface IHttp {
  url: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: { [key: string]: any }
  headers?: { [key: string]: any }
}

export function useHttp() {
  const app = useAppBridge();
  const fetch = userLoggedInFetch(app);
  return ({ url, method = 'GET', body = {} }: IHttp) => {
    let bodyData: string | FormData = ''
    let hasBody = true;
    if (method === 'GET' || method === 'DELETE') {
      hasBody = false;
      let params = ''
      for (const key in body) {
        if (typeof body[key] !== 'undefined') params += `&${key}=${body[key]}`
      }
      if (params !== '') url = `${url}?` + params.substring(1)
    } else {
      bodyData = body instanceof FormData ? body : JSON.stringify(body)
    }
    return fetch(url, {
      method,
      ...hasBody ? { body: bodyData } : {}
    }).then(res => res?.json()).then(res => [null, res]).catch(error => [error])
  }
}