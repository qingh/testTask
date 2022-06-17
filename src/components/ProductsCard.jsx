import { useEffect, useState, useCallback } from "react";
import { Toast, useAppBridge } from "@shopify/app-bridge-react";
import { userLoggedInFetch } from "../App";



export function ProductsCard() {
  const app = useAppBridge();
  const fetch = userLoggedInFetch(app);
  return (
    <button type="button" onClick={async () => {
      const { count } = await fetch("/list").then((res) => res.json());
    }}>aa</button>
  );
}

