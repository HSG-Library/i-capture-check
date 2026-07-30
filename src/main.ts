import { Application, Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { DuplicateChecker } from "./duplicateChecker.ts";
import { BibDataProvider } from "./bibDataProvider.ts";
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
      console.error("Lookup failed:", error);

      if (format === "json") {
        const fallback: BibData = {
          errorsExist: true,
          errorList: {
            error: [{
              errorMessage: error instanceof Error
                ? error.message
                : "Lookup failed",
            }],
          },
        };
        ctx.response.headers.set("Content-Type", "application/json");
        ctx.response.body = {
          ...fallback,
          tocInfo: "",
        };
        return;
      }

      // Keep SRU clients on a valid SRU response even when upstream lookup fails.
      ctx.response.headers.set("Content-Type", "application/xml");
      ctx.response.body = iCaptureCheck.createSruXml({ errorsExist: false });
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
