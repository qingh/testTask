import { ClientApplication } from "@shopify/app-bridge";
import {
  Provider as AppBridgeProvider
} from "@shopify/app-bridge-react";
import { authenticatedFetch } from "@shopify/app-bridge-utils";
import { Redirect } from "@shopify/app-bridge/actions";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";
import { HomePage } from "./HomePage";

console.log(process.env);
export default function App() {
  return (
    <PolarisProvider i18n={translations}>
      <AppBridgeProvider
        config={{
          apiKey: process.env.SHOPIFY_API_KEY as string,
          host: new URL(location.href).searchParams.get("host") as string,
          forceRedirect: true,
        }}
      >
        <HomePage />
      </AppBridgeProvider>
    </PolarisProvider>
  );
}


export function userLoggedInFetch(app: ClientApplication) {
  const fetchFunction = authenticatedFetch(app);
  return async (uri: RequestInfo, options?: RequestInit) => {
    const response = await fetchFunction(uri, options);
    if (
      response.headers.get("X-Shopify-API-Request-Failure-Reauthorize") === "1"
    ) {
      const authUrlHeader = response.headers.get(
        "X-Shopify-API-Request-Failure-Reauthorize-Url"
      );
      const redirect = Redirect.create(app);
      redirect.dispatch(Redirect.Action.APP, authUrlHeader || `/auth`);
      return null;
    }
    return response;
  };
}
