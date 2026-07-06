import { Application, Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { DuplicateChecker } from "./duplicateChecker.ts";
import { BibDataProvider } from "./bibDataProvider.ts";

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
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(sruResponseText, "text/html");
    const record = xmlDoc?.querySelector("record");
    const marcFields856 = record?.querySelectorAll('datafield[tag="856"]');
    if (marcFields856) {
      for (const field of marcFields856) {
        const subfields = field.querySelectorAll("subfield");
        const hasTocText = Array.from(subfields).some((subfield) =>
          DuplicateChecker.containsTocText(subfield.textContent ?? "")
        );

        if (hasTocText) {
          const subfield3 = field.querySelector('subfield[code="3"]');
          if (subfield3) {
            subfield3.textContent = "Inhaltsverzeichnis";
          }
        }
      }
    }
    return xmlDoc?.body?.innerHTML ?? sruResponseText;
  } catch (error) {
    console.error("Error normalizing TOC text:", error);
    return sruResponseText;
  }
}
