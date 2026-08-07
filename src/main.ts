import { Application, Context } from "oak";
import { DuplicateChecker } from "./duplicateChecker.ts";
import {
  BibDataProvider,
  NO_RECORDS_ERROR_MESSAGE,
} from "./bibDataProvider.ts";
import { BibData } from "./types.ts";

if (import.meta.main) {
  const app = new Application();

  app.use(async (ctx: Context) => {
    const shelfMark = ctx.request.url.searchParams.get("shelf_mark") ??
      parseShelfMarkFromSruQuery(ctx.request.url.searchParams.get("query"));
    const format = ctx.request.url.searchParams.get("format") || "xml";

    if (!shelfMark) {
      ctx.response.type = "html";
      ctx.response.body = await Deno.readTextFile("check.html");
      return;
    }

    const bibDataProvider = new BibDataProvider();
    const iCaptureCheck = new DuplicateChecker(bibDataProvider);

    try {
      const [tocInfo, resultJson] = await iCaptureCheck.check(shelfMark);
      console.log("TocInfo:", tocInfo);

      if (format === "json") {
        ctx.response.headers.set("Content-Type", "application/json");
        ctx.response.body = {
          ...resultJson,
          tocInfo,
        };
        return;
      }

      ctx.response.headers.set("Content-Type", "application/xml");
      ctx.response.body = iCaptureCheck.createSruXml(resultJson);
      return;
    } catch (error) {
      const message = getErrorMessage(error);
      const isNoRecordsError = message === NO_RECORDS_ERROR_MESSAGE;

      ctx.response.status = isNoRecordsError ? 404 : 500;

      if (format === "json") {
        ctx.response.headers.set("Content-Type", "application/json");
        ctx.response.body = { error: message };
        return;
      }

      ctx.response.type = "text/plain";
      ctx.response.body = message;
      return;
    }
  });

  app.addEventListener(
    "listen",
    ({ hostname, port }: { hostname: string; port: number }) => {
      console.log(
        `Server started on http://${hostname ?? "localhost"}:${port}`,
      );
    },
  );

  await app.listen({ port: 3000 });
}

function getErrorMessage(error: unknown): string {
  if (isBibDataError(error)) {
    return error.errorList?.error?.[0]?.errorMessage ?? "Unknown error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error occurred";
}

function isBibDataError(error: unknown): error is BibData {
  return typeof error === "object" && error !== null && "errorsExist" in error;
}

function parseShelfMarkFromSruQuery(query: string | null): string | null {
  if (!query) {
    return null;
  }

  const [field, ...valueParts] = query.split("=");
  if (field !== "shelf_mark" || valueParts.length === 0) {
    return null;
  }

  return valueParts.join("=").trim() || null;
}
