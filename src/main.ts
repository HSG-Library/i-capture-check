import { Application, Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { DuplicateChecker } from "./duplicateChecker.ts";
import { BibDataProvider } from "./bibDataProvider.ts";

if (import.meta.main) {
  const apikey = await Deno.readTextFile("apikey").then((text) => text.trim());

  if (!apikey) {
    throw Error(
      "ERROR: no apikey present. Provide an Alma apikey as parameter.",
    );
  }

  const app = new Application();

  app.use(async (ctx: Context) => {
    const shelfMark = ctx.request.url.searchParams.get("shelf_mark");
    const format = ctx.request.url.searchParams.get("format") || "xml";

    if (!shelfMark) {
      ctx.response.type = "html";
      ctx.response.body = await Deno.readTextFile("check.html");
      return;
    }

    const bibDataProvider = new BibDataProvider(apikey);
    const iCaptureCheck = new DuplicateChecker(bibDataProvider);
    const resultJson = await iCaptureCheck.check(shelfMark);

    if (format === "json") {
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.body = resultJson;
      return;
    }

    ctx.response.headers.set("Content-Type", "application/xml");
    ctx.response.body = iCaptureCheck.createXml(resultJson);
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
