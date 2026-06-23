import { Application, Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { DuplicateChecker } from "./duplicateChecker.ts";
import { BibDataProvider } from "./bibDataProvider.ts";

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

if (import.meta.main) {
  //const apikey = await Deno.readTextFile("apikey").then((text) => text.trim());

  /*if (!apikey) {
    throw Error(
      "ERROR: no apikey present. Provide an Alma apikey as parameter.",
    );
  }*/

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
    const resultJson = await iCaptureCheck.check(shelfMark);

    if (format === "json") {
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.body = resultJson;
      return;
    }

    ctx.response.headers.set("Content-Type", "application/xml");
    const sruResponse = await bibDataProvider.fetchResponse(shelfMark);
    ctx.response.body = await sruResponse.text();
    return;
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
