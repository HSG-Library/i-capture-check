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

function normalizeTocTextForiCapture(sruResponseText: string): string {
    sruResponseText = sruResponseText.replace(
      /(<(?:\w+:)?datafield\b[^>]*\btag="856"[^>]*>)([\s\S]*?)(<\/(?:\w+:)?datafield>)/g,
      (_match, openTag, innerContent, closeTag) => {
        const updatedInnerContent = innerContent.replace(
          /(<(?:\w+:)?subfield\b[^>]*\bcode="3"[^>]*>)([\s\S]*?)(<\/(?:\w+:)?subfield>)/g,
          (
            _subfieldMatch: string,
            subfieldOpenTag: string,
            subfieldText: string,
            subfieldCloseTag: string,
          ) => {
            if (!DuplicateChecker.containsTocText(subfieldText)) {
              return `${subfieldOpenTag}${subfieldText}${subfieldCloseTag}`;
            }
            return `${subfieldOpenTag}Inhaltsverzeichnis${subfieldCloseTag}`;
          },
        );
        return `${openTag}${updatedInnerContent}${closeTag}`;
      },
    );
    return sruResponseText;
}


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
    const resultJson = await iCaptureCheck.check(shelfMark);

    if (format === "json") {
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.body = resultJson;
      return;
    }

    ctx.response.headers.set("Content-Type", "application/xml");
    const sruResponse = await bibDataProvider.fetchResponse(shelfMark);
    let sruResponseText = await sruResponse.text();
    if (resultJson.duplicateInformation) {
      sruResponseText = normalizeTocTextForiCapture(sruResponseText);
    }
    ctx.response.body = sruResponseText;
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
