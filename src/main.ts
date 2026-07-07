import { Application, Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { parse, stringify } from "xml";
import { DuplicateChecker } from "./duplicateChecker.ts";
import { Datafield, SRUResponse, Subfield } from "./types.ts";
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
    const parsed = parse(sruResponseText) as unknown as SRUResponse;
    const sruResponse = structuredClone(parsed); // the object returend by parse is immutable, so we need to create a mutable copy of it to modify subfield 3
    const datafields = toArray<Datafield>(
      sruResponse.searchRetrieveResponse?.records?.record?.recordData?.record
        ?.datafield,
    );

    for (const field of datafields) {
      if (!field || field["@tag"] !== "856") {
        continue;
      }

      const subfields = toArray<Subfield>(field.subfield);
      const hasTocText = subfields.some((subfield) =>
        DuplicateChecker.containsTocText(subfield?.["#text"] ?? "")
      );

      if (!hasTocText) {
        continue;
      }

      const subfield3 = subfields.find((subfield) => subfield?.["@code"] === "3");
      if (subfield3) {
        subfield3["#text"] = "Inhaltsverzeichnis";
      }
    }
    return stringify(sruResponse as unknown as Record<string, unknown>);
  } catch (error) {
    console.error("Error normalizing TOC text:", error);
    return sruResponseText;
  }
}

function toArray<T>(item: T | T[] | undefined): T[] {
  if (!item) {
    return [];
  }
  if (Array.isArray(item)) {
    return item;
  }
  return [item];
}
