import { AppShell, Card, ErrorState } from "@app/ui";
import { useRouteError } from "react-router";
import { brand } from "../brand.ts";

/** What a page shows when it throws while rendering, instead of a blank screen. */
export function RouteError() {
  const error = useRouteError();
  console.error(error);
  return (
    <AppShell brand={brand}>
      <Card>
        <ErrorState title="This page hit a problem" message="Reload to try again. If it keeps happening, tell the team." onRetry={() => window.location.reload()} />
      </Card>
    </AppShell>
  );
}
