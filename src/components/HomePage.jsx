import { useAppBridge } from "@shopify/app-bridge-react";
import { userLoggedInFetch } from '../App';

console.log(userLoggedInFetch);
export function HomePage() {
  const app = useAppBridge();
  const fetch = userLoggedInFetch(app);
  return (
    <button type="button" onClick={async () => {
      const { count } = await fetch("/list").then((res) => res.json());
    }}>test2a</button>
  )
}
