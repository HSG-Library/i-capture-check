import { BibResponse } from "./types.ts";

export class BibDataProvider {
  private readonly apiUrl =
    "https://api-eu.hosted.exlibrisgroup.com/almaws/v1/";

  public constructor(private readonly apikey: string) {}

  public async getBibData(identifier: string): Promise<BibResponse> {
    const response: Response | null = identifier.startsWith("99")
      ? await this.callApi(this.byMmsid, identifier)
      : await this.callApi(this.byBarcode, identifier);
    if (!response) {
      return Promise.reject("No response");
    }
    const bibResponse: BibResponse = await response.json();
    if (this.checkForErrors(bibResponse)) {
      return Promise.reject(bibResponse);
    }
    return Promise.resolve(bibResponse);
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

  private checkForErrors(bibResponse: BibResponse): boolean {
    return bibResponse?.errorsExist ?? false;
  }

  private getHeaders(apikey: string): Headers {
    return new Headers({
      "Authorization": `apikey ${apikey}`,
    });
  }
}
