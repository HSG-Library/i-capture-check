import { BibData, MarcData, SRUResponse } from "./types.ts";
import { parse } from "https://deno.land/x/xml@6.0.4/mod.ts";

export class BibDataProvider {
  private readonly apiUrl =
    "https://api-eu.hosted.exlibrisgroup.com/almaws/v1/";
  private readonly sruUrl =
    "https://slsp-hsg.alma.exlibrisgroup.com/view/sru/41SLSP_NETWORK?version=1.2&operation=searchRetrieve&query=mms_id=";

  public constructor(private readonly apikey: string) {}

  public async getBibData(identifier: string): Promise<BibData> {
    const response: Response = this.isMmsId(identifier)
      ? await this.call(this.byMmsid, identifier)
      : await this.call(this.byBarcode, identifier);

    if (!response) {
      return Promise.reject(this.createError("Invalid barcode or no response"));
    }

    const bibData: BibData = await this.convertToBibData(response);

    if (this.checkForErrors(bibData)) {
      return Promise.reject(bibData);
    }
    return Promise.resolve(bibData);
  }

  private call(
    by: (value: string) => Promise<Response>,
    value: string,
  ): Promise<Response> {
    return by.bind(this)(value);
  }

  private async byBarcode(barcode: string): Promise<Response> {
    const path = `items?item_barcode=${barcode}&format=json`;
    const url = this.apiUrl + path;
    const response: Response = await this.callApi(url);
    const responseJson = await response.json();
    const mmsid = responseJson?.bib_data?.mms_id;
    if (!mmsid) {
      return Promise.reject();
    }
    return this.byMmsid(mmsid);
  }

  private byMmsid(mmsId: string): Promise<Response> {
    if (this.isIzMmsId(mmsId)) {
      return this.byIZMmsidViaApi(mmsId);
    }
    return this.byNZMmsidViaSRU(mmsId);
  }

  private byIZMmsidViaApi(mmsId: string): Promise<Response> {
    const path = `bibs/${mmsId}?view=full&expand=None&format=json`;
    const url = this.apiUrl + path;
    const response: Promise<Response> = this.callApi(url);
    return response;
  }

  private byNZMmsidViaSRU(mmsId: string): Promise<Response> {
    const url = this.sruUrl + mmsId;
    console.info("calling (SRU):", url);
    const response: Promise<Response> = fetch(url);
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
    if (this.isApiResponse(contentType)) {
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
    } else if (this.isSruResponse(contentType)) {
      const xml = await response.text();
      const sruResponse: SRUResponse = parse(xml) as unknown as SRUResponse;
      if (sruResponse?.searchRetrieveResponse?.diagnostics) {
        return this.createError("SRU query error");
      }
      const sru = sruResponse?.searchRetrieveResponse;
      if (sru?.numberOfRecords === "1") {
        const record = sru?.records?.record
          ?.recordData;
        return {
          mms_id: sru?.records?.record?.recordIdentifier,
          marcData: record,
          errorsExist: false,
        };
      }
      return this.createError("Invalid SRU response");
    } else {
      throw new Error("Unsupported content type: " + contentType);
    }
  }

  private async callApi(apiUrl: string): Promise<Response> {
    console.info("calling (API):", apiUrl);
    return await fetch(apiUrl, {
      headers: this.getHeaders(this.apikey),
    });
  }

  private isMmsId(identifier: string) {
    return identifier.startsWith("99");
  }

  private isIzMmsId(mmsId: string) {
    return mmsId.endsWith("5506");
  }

  private isApiResponse(contentType: string | null) {
    return contentType && contentType.includes("json");
  }

  private isSruResponse(contentType: string | null) {
    return contentType && contentType.includes("xml");
  }

  private extractMarc(xmlString: string): MarcData {
    return parse(xmlString) as unknown as MarcData;
  }

  private createError(errorMsg: string): BibData {
    return {
      errorsExist: true,
      errorList: {
        error: [{ errorMessage: errorMsg }],
      },
    };
  }
}
