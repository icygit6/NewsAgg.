import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { RouteFallback } from "./app/components/RouteFallback";
import { initSentry } from "./app/lib/sentry";
import { loadRuntimeConfig } from "./app/lib/runtimeConfig";
import "./styles/index.css";

void initSentry();

async function bootstrap() {
  const root = createRoot(document.getElementById("root")!);
  // Paint useful structure immediately while runtime auth/captcha configuration
  // is fetched. This avoids a blank screen on slow or temporarily unavailable APIs.
  root.render(<RouteFallback />);
  await loadRuntimeConfig();
  root.render(
    <App />
  );
}

void bootstrap();
