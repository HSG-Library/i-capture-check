import { parse, stringify } from "https://deno.land/x/xml@6.0.4/mod.ts";

import { BibResponse, ItemData, MarcData, Subfield } from "./Types.ts";
import { BibDataProvider } from "./BibDataProvider.ts";

export class DuplicateChecker {
  public constructor(private readonly apikey: string) {}

  public createXml(data: ItemData): string {
    return stringify({
      "@version": "1.0",
      "@standalone": "yes",
      cata: {
        ...data,
      },
    });
  }

  public async check(identifier: string): Promise<ItemData> {
    const bibResponse: BibResponse = await new BibDataProvider(this.apikey)
      .getBibData(identifier);
    const marcData: MarcData = this.extractMarc(bibResponse);
    return this.collectData(
      bibResponse,
      marcData,
      identifier.startsWith("99") ? null : identifier,
    );
  }

  private extractMarc(jsonResponse: BibResponse): MarcData {
    const marcXml: string = jsonResponse?.anies?.[0] ?? "";
    return parse(marcXml) as unknown as MarcData;
  }

  private collectData(
    bibResponse: BibResponse,
    marcData: MarcData,
    barcode: string | null,
  ): ItemData {
    const shelfMark = barcode;
    const sysNr = bibResponse?.mms_id;
    const isbn = this.extractIsbn(marcData);
    const author = this.extractAuthors(marcData);
    const title = bibResponse?.title;
    const language = this.exctractLanguage(marcData);
    const duplicateInformation = this.extractDuplicateInfo(marcData);

    let itemData: ItemData = {
      success: true,
      shelf_mark: shelfMark,
      sys_nr: sysNr,
      title: title,
      author: author,
      isbn: isbn,
      language: language,
    };

    if (duplicateInformation) {
      itemData = {
        ...itemData,
        duplicateInformation: duplicateInformation,
      };
    }

    return itemData;
  }

  private extractAuthors(marcData: MarcData): string[] {
    const author: string = this
      .toSubfieldArray(
        marcData.record.datafield.find((field) => field["@tag"] === "100")
          ?.subfield,
      )
      .find((subfield) => subfield["@code"] === "a")?.["#text"] ?? "";

    const otherAuthors: string[] = this.toSubfieldArray(
      marcData.record.datafield.find((field) => field["@tag"] === "700")
        ?.subfield,
    )
      .filter((subfield) => subfield && subfield["@code"] === "a")
      .map((subfield) => subfield["#text"] ?? "");

    return [author, ...otherAuthors];
  }

  private extractIsbn(marcData: MarcData): string[] {
    const isbn: string[] = this
      .toSubfieldArray(
        marcData.record.datafield.filter((field) => field["@tag"] === "020")
          .flatMap(
            (dataField) => dataField.subfield,
          ),
      ).filter((subfield) => subfield && subfield["@code"] === "a").map((
        subfield,
      ) => subfield["#text"] ?? "");

    return isbn;
  }

  private exctractLanguage(marcData: MarcData): string {
    const c008: string =
      marcData.record.controlfield.find((field) => field["@tag"] === "008")
        ?.["#text"] ?? "";
    return c008.substring(35, 38);
  }

  private extractDuplicateInfo(marcData: MarcData): string {
    const tocList = [
      "Inhaltsverzeichnis",
      "Table of contents",
      "Indice",
      "Table des matières",
      "Indice dei contenuti",
    ];
    const d856: string = marcData.record.datafield.filter((field) =>
      field && field["@tag"] === "856"
    )
      .flatMap((field) => this.toSubfieldArray(field.subfield))
      .map((subfield) => subfield["#text"] ?? "")
      .join(" ");

    const hasToc856: boolean = tocList.some((toc) =>
      d856.toLowerCase().includes(toc.toLowerCase())
    );

    if (hasToc856) {
      return d856.trim();
    }

    return "";

    //datafield tag="856" 	subfield code="3" 	enthält den Begriff 'Inhaltsverzeichnis' oder 'Table of contents' oder 'Indice'
    // const urls: string[] = marcData.record.datafield.filter((field) => field["@tag"] === "856")
    //   .map((field) => {
    //     const isToc: boolean = this.toSubfieldArray(field.subfield)
    //       .filter((subfield) =>
    //         subfield["@code"] === "3" || subfield["@code"] === "z"
    //       )
    //       .some((subfield) => {
    //         return tocList.some((toc) =>
    //           subfield["#text"].toLowerCase().includes(toc.toLowerCase())
    //         );
    //       });
    //     if (isToc) {
    //       return this.toSubfieldArray(field.subfield).find((subfield) => subfield["@code"] === "u")?.["#text"] ?? "";
    //     }
    //     return "";
    //   });

    // return urls.join(" ").trim();
  }

  private toSubfieldArray(subfield: unknown): Subfield[] {
    if (Array.isArray(subfield)) {
      return subfield;
    }
    return [subfield as Subfield];
  }
}
