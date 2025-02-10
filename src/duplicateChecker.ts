import { stringify } from "https://deno.land/x/xml@6.0.4/mod.ts";

import { BibData, Datafield, ItemData, MarcData, Subfield } from "./types.ts";
import { BibDataProvider } from "./bibDataProvider.ts";

export class DuplicateChecker {
  public constructor(private bibDataProvider: BibDataProvider) {}

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
    try {
      const bibData: BibData = await this.bibDataProvider
        .getBibData(identifier);
      return this.collectData(
        bibData,
        identifier.startsWith("99") ? null : identifier,
      );
    } catch (error) {
      console.log(error);
      return error as ItemData;
    }
  }

  private collectData(
    bibData: BibData,
    barcode: string | null,
  ): ItemData {
    if (!bibData?.marcData) {
      throw Error("No MarcData available");
    }
    const shelfMark = barcode;
    const sysNr = bibData?.mms_id;
    const isbn = this.extractIsbn(bibData.marcData);
    const author = this.extractAuthors(bibData.marcData);
    const title = this.extractTitle(bibData.marcData);
    const language = this.exctractLanguage(bibData.marcData);
    const duplicateInformation = this.extractDuplicateInfo(bibData.marcData);

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

  private extractTitle(marcData: MarcData): string {
    const title: string = this
      .toArray<Subfield>(
        this.toArray<Datafield>(marcData.record.datafield).find((field) =>
          field["@tag"] === "245"
        )
          ?.subfield,
      )
      .find((subfield) => subfield && subfield["@code"] === "a")?.["#text"] ??
      "";
    const subtitle: string = this
      .toArray<Subfield>(
        this.toArray<Datafield>(marcData.record.datafield).find((field) =>
          field["@tag"] === "245"
        )
          ?.subfield,
      )
      .find((subfield) => subfield && subfield["@code"] === "b")?.["#text"] ??
      "";
    return title.concat(" ", subtitle).trim();
  }

  private extractAuthors(marcData: MarcData): string[] {
    const author: string = this
      .toArray<Subfield>(
        this.toArray<Datafield>(marcData.record.datafield).find((field) =>
          field["@tag"] === "100"
        )
          ?.subfield,
      )
      .find((subfield) => subfield && subfield["@code"] === "a")?.["#text"] ??
      "";

    const otherAuthors: string[] = this.toArray<Subfield>(
      this.toArray<Datafield>(marcData.record.datafield).find((field) =>
        field["@tag"] === "700"
      )
        ?.subfield,
    )
      .filter((subfield) => subfield && subfield["@code"] === "a")
      .map((subfield) => subfield["#text"] ?? "");

    return [author, ...otherAuthors].filter((author) => author);
  }

  private extractIsbn(marcData: MarcData): string[] {
    const isbn: string[] = this
      .toArray<Subfield>(
        this.toArray<Datafield>(marcData.record.datafield).filter((field) =>
          field["@tag"] === "020"
        )
          .flatMap(
            (dataField) => dataField.subfield,
          ),
      ).filter((subfield) => subfield && subfield["@code"] === "a").map((
        subfield,
      ) => subfield["#text"] ?? "");

    return isbn.filter((isbn) => isbn).sort((a: string, b: string) => {
      if (a.length < b.length) {
        return 1;
      }
      if (a.length > b.length) {
        return -1;
      }
      return 0;
    });
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
    const d856: string = this.toArray<Datafield>(marcData.record.datafield)
      .filter((field) => field && field["@tag"] === "856")
      .flatMap((field) => this.toArray<Subfield>(field.subfield))
      .map((subfield) => subfield["#text"] ?? "")
      .join(" ");

    const hasToc856: boolean = tocList.some((toc) =>
      d856.toLowerCase().includes(toc.toLowerCase())
    );

    if (hasToc856) {
      return d856.trim();
    }

    return "";
  }

  private toArray<T>(item: unknown): T[] {
    if (Array.isArray(item)) {
      return item;
    }
    return [item as T];
  }
}
