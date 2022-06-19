
import { Shopify, ApiVersion } from "@shopify/shopify-api";
export function shopInit() {
  Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY as string,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET as string,
    SCOPES: process.env.SCOPES!.split(","),
    HOST_NAME: process.env.HOST!.replace(/https:\/\//, ""),
    API_VERSION: ApiVersion.April22,
    IS_EMBEDDED_APP: true,
    SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
  });

  const ACTIVE_SHOPIFY_SHOPS: { [key: string]: any } = {};
  Shopify.Webhooks.Registry.addHandler("APP_UNINSTALLED", {
    path: "/webhooks",
    webhookHandler: async (topic, shop, body) => {
      delete ACTIVE_SHOPIFY_SHOPS[shop];
    },
  });
}