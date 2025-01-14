import { parse, stringify } from "https://deno.land/x/xml@6.0.4/mod.ts";

import { BibResponse, ItemData, MarcData, Subfield } from "./Types.ts";

export class DuplicateChecker {
  private readonly apiUrl =
    "https://api-eu.hosted.exlibrisgroup.com/almaws/v1/";

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
    const response: Response | null = identifier.startsWith("99")
      ? await this.callApi(this.byMmsid, identifier)
      : await this.callApi(this.byBarcode, identifier);
    if (!response) {
      return { success: false, shelf_mark: identifier };
    }
    const bibResponse: BibResponse = await response.json();
    if (!bibResponse || this.checkForErrors(bibResponse)) {
      return { success: false, shelf_mark: identifier };
    }
    const marcData: MarcData = this.extractMarc(bibResponse);
    return this.collectData(
      bibResponse,
      marcData,
      identifier.startsWith("99") ? null : identifier,
    );
  }

  private callApi(
    by: (value: string) => Promise<Response | null>,
    value: string,
  ): Promise<Response | null> {
    return by.bind(this)(value);
  }

  private async byBarcode(barcode: string): Promise<Response | null> {
    const path = `items?item_barcode=${barcode}&format=json`;
    const url = this.apiUrl + path;
    console.info("calling:", url);
    const response: Response = await fetch(url, {
      headers: this.getHeaders(this.apikey),
    });
    const responseJson = await response.json();
    const mmsid = responseJson?.bib_data?.mms_id;
    if (!mmsid) {
      return null;
    }
    return this.byMmsid(mmsid);
  }

  private byMmsid(mmsId: string): Promise<Response | null> {
    const path = `bibs/${mmsId}?view=full&expand=None&format=json`;
    const url = this.apiUrl + path;
    console.info("calling:", url);
    const response: Promise<Response | null> = fetch(url, {
      headers: this.getHeaders(this.apikey),
    });
    return response;
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
      isbn: isbn,
      author: author,
      title: title,
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
    const author: string = this.toSubfieldArray(
      marcData.record.datafield.find((field) => field["@tag"] === "100")
        ?.subfield,
    )
      .find((subfield) => subfield["@code"] === "a")?.["#text"] ?? "";

    const otherAuthors: string[] = this.toSubfieldArray(
      marcData.record.datafield.find((field) => field["@tag"] === "700")
        ?.subfield,
    )
      .filter((subfield) => subfield["@code"] === "a")
      .map((subfield) => subfield["#text"]);

    return [author, ...otherAuthors];
  }

  private extractIsbn(marcData: MarcData): string[] {
    const isbn: string[] = this.toSubfieldArray(
      marcData.record.datafield.filter((field) => field["@tag"] === "020").map(
        (dataFiled) => dataFiled.subfield,
      ),
    )
      .filter((subfield) => subfield["@code"] === "a").map((subfield) =>
        subfield["#text"]
      );

    return isbn;
  }

  private exctractLanguage(marcData: MarcData): string {
    const c008: string =
      marcData.record.controlfield.find((field) => field["@tag"] === "008")
        ?.["#text"] ?? "";
    return c008.substring(35, 38);
  }

  private extractDuplicateInfo(marcData: MarcData): string {
    const tocList = ["Inhaltsverzeichnis", "Table of contents", "Indice"];
    //datafield tag="856" 	subfield code="3" 	enthält den Begriff 'Inhaltsverzeichnis' oder 'Table of contents' oder 'Indice'
    const d856Subfield: Subfield[] = this.toSubfieldArray(
      marcData.record.datafield.find((field) => field["@tag"] === "856")
        ?.subfield,
    );
    const d856$3: string =
      d856Subfield?.find((subfield) => subfield["@code"] === "3")?.["#text"] ??
        "";
    const hasToc856$3: boolean = tocList.includes(d856$3);
    //datafield tag = "856" 	subfield code = "z" 	enthält den Begriff 'Inhaltsverzeichnis' oder 'Table of contents' oder 'Indice'
    const d856$z: string =
      d856Subfield?.find((subfield) => subfield["@code"] === "z")?.["#text"] ??
        "";
    const hasToc856$z: boolean = tocList.includes(d856$z);

    if (hasToc856$3 || hasToc856$z) {
      //datafield tag="856" 	subfield code="u" 	Inhalt anzeigen (URL zum anklicken)
      const d856$u: string = d856Subfield?.find((subfield) =>
        subfield["@code"] === "u"
      )?.["#text"] ??
        "";
      return d856$u;
    }
    return "";
  }

  private checkForErrors(bibResponse: BibResponse): boolean {
    return bibResponse?.errorsExist ?? false;
  }

  private getHeaders(apikey: string): Headers {
    return new Headers({
      "Authorization": `apikey ${apikey}`,
    });
  }

  private toSubfieldArray(subfield: unknown): Subfield[] {
    if (Array.isArray(subfield)) {
      return subfield;
    }
    return [subfield as Subfield];
  }
}
