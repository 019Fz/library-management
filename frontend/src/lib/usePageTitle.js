// Sets the browser tab title, e.g. "Books · Shelfwise". Without a title it shows just the app name.
import { useEffect } from "react";
import { APP_NAME } from "../config/app.js";

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
