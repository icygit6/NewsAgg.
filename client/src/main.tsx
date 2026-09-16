import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from "./app/App.tsx";
import { initSentry } from "./app/lib/sentry";
import { loadRuntimeConfig } from "./app/lib/runtimeConfig";
import "./styles/index.css";

initSentry();

async function bootstrap() {
  const { googleClientId } = await loadRuntimeConfig();
  const root = createRoot(document.getElementById("root")!);
  root.render(
    googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}><App /></GoogleOAuthProvider>
    ) : (
      <App />
    )
  );
}

void bootstrap();
