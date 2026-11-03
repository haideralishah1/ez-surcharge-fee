import { redirect } from "react-router";

/** Plans live on the Settings → Pricing tab now. */
export const loader = () => redirect("/app/settings?tab=pricing");
