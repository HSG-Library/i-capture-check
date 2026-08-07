import { stringify } from "xml";
import { BibData, Datafield, Subfield } from "./types.ts";
import { BibDataProvider } from "./bibDataProvider.ts";

export class DuplicateChecker {
  public constructor(private bibDataProvider: BibDataProvider) {}

  public createSruXml(bibData: BibData): string {
    return stringify({
      "@version": "1.0",
      "@standalone": "yes",
      searchRetrieveResponse: {
        "@xmlns": "http://www.loc.gov/zing/srw/",
        version: "1.2",
        numberOfRecords: 1,
        records: {
          record: {
            recordSchema: "marcxml",
            recordPacking: "xml",
            recordData: {
              ...bibData.marcData,
            },
            recordIdentifier: bibData.mms_id,
            recordPosition: 1,
          },
        },
        extraResponseData: bibData.extraResponseData,
      },
    });
  }

  public async check(identifier: string): Promise<[string, BibData]> {
    const bibData: BibData = await this.bibDataProvider
      .getBibData(identifier);

    const [tocInfo, modifiedBibData] = this.extractDuplicateInfo(bibData);
    return [tocInfo, modifiedBibData];

  }

  private extractDuplicateInfo(bibData: BibData): [string, BibData] {
    if (!bibData?.marcData) {
      throw Error("No MarcData available");
    }
    const clonedBibData = structuredClone(bibData); // the object returend by parse is immutable, so we need to create a mutable copy of it to modify subfield 3

    //check all 856 subfield for toc text
    const d856: string = this.toArray<Datafield>(
      clonedBibData.marcData?.record.datafield,
    )
      .filter((field) => field && field["@tag"] === "856")
      .flatMap((field) => this.toArray<Subfield>(field.subfield))
      .map((subfield) => subfield["#text"] ?? "")
      .join(" ");

    const hasToc856: boolean = this.containsTocText(d856);

    if (hasToc856) {
      //replace only the subfield 3 of the 856 fields (if containing toc text) because that is what iCapture cares about.
      const d856s3 = this.toArray<Datafield>(
        clonedBibData.marcData?.record.datafield,
      )
        .filter((field) => field && field["@tag"] === "856")
        .flatMap((field) => this.toArray<Subfield>(field.subfield))
        .filter((subfield) => subfield && subfield["@code"] === "3");

      d856s3.forEach((subfield) => {
        if (this.containsTocText(subfield["#text"] ?? "")) {
          subfield["#text"] = "Inhaltsverzeichnis";
        }
      });

      return [d856, clonedBibData];
    }

    return ["", clonedBibData];
  }

  private containsTocText(value: string): boolean {
    const tocList = [
      "Inhaltsverzeichnis",
      "Table of contents",
      "Indice",
      "Table des matières",
      "Indice dei contenuti",
    ];
    const normalizedValue = value.toLowerCase();
    return tocList.some((toc) => normalizedValue.includes(toc.toLowerCase()));
  }

  private toArray<T>(item: unknown): T[] {
    if (Array.isArray(item)) {
      return item;
    }
    return [item as T];
  }
}
