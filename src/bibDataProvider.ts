import { BibData, MarcData, SRUResponse } from "./types.ts";
import { parse } from "https://deno.land/x/xml@6.0.4/mod.ts";

export class BibDataProvider {
  private readonly apiUrl =
    "https://api-eu.hosted.exlibrisgroup.com/almaws/v1/";
  private readonly sruUrl =
    "https://slsp-hsg.alma.exlibrisgroup.com/view/sru/41SLSP_NETWORK?version=1.2&operation=searchRetrieve&query=mms_id=";

  public constructor(private readonly apikey: string) {}

  public async getBibData(identifier: string): Promise<BibData> {
    const response: Response | null = identifier.startsWith("99")
      ? await this.callApi(this.byMmsid, identifier)
      : await this.callApi(this.byBarcode, identifier);

    if (!response) {
      return Promise.reject({
        errorsExist: true,
        errorList: {
          error: [{ errorMessage: "Invalid barcode or no response" }],
        },
      });
    }
    const bibData: BibData = await this.convertToBibData(response);
    if (this.checkForErrors(bibData)) {
      return Promise.reject(bibData);
    }
    return Promise.resolve(bibData);
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
    console.info("calling (API):", url);
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
    if (mmsId.endsWith("5506")) {
      return this.byIZMmsidViaApi(mmsId);
    }
    return this.byNZMmsidViaSRU(mmsId);
  }

  private byIZMmsidViaApi(mmsId: string): Promise<Response | null> {
    const path = `bibs/${mmsId}?view=full&expand=None&format=json`;
    const url = this.apiUrl + path;
    console.info("calling (API):", url);
    const response: Promise<Response | null> = fetch(url, {
      headers: this.getHeaders(this.apikey),
    });
    return response;
  }

  private byNZMmsidViaSRU(mmsId: string): Promise<Response | null> {
    const url = this.sruUrl + mmsId;
    console.info("calling (SRU):", url);
    const response: Promise<Response | null> = fetch(url);
    return response;
  }

  private checkForErrors(bibData: BibData): boolean {
    return bibData?.errorsExist ?? false;
  }

  private getHeaders(apikey: string): Headers {
    return new Headers({
      "Authorization": `apikey ${apikey}`,
    });
  }

  private async convertToBibData(response: Response): Promise<BibData> {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("json")) {
      const json = await response.json();
      if (json?.errorsExist) {
        return {
          errorsExist: json?.errorsExist,
          errorList: json?.errorList,
        };
      }
      return {
        mms_id: json?.mms_id,
        marcData: this.extractMarc(json?.anies?.[0] ?? ""),
        errorsExist: json?.errorsExist,
      };
    } else if (contentType && contentType.includes("xml")) {
      const xml = await response.text();
      const sruResponse: SRUResponse = parse(xml) as unknown as SRUResponse;
      if (sruResponse?.searchRetrieveResponse?.diagnostics) {
        return {
          errorsExist: true,
          errorList: {
            error: [
              {
                errorMessage: "SRU query error",
              },
            ],
          },
        };
      }
      if (sruResponse?.searchRetrieveResponse?.numberOfRecords === "1") {
        const record = sruResponse?.searchRetrieveResponse?.records?.record
          ?.recordData;
        return {
          mms_id: sruResponse?.searchRetrieveResponse?.records?.record
            ?.recordIdentifier,
          marcData: record,
          errorsExist: false,
        };
      }
      return {
        mms_id: "",
        errorsExist: true,
      };
    } else {
      throw new Error("Unsupported content type: " + contentType);
    }
  }

  private extractMarc(xmlString: string): MarcData {
    return parse(xmlString) as unknown as MarcData;
  }
}
