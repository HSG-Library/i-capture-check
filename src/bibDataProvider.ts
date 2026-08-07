import { BibData, SRUResponse } from "./types.ts";
import { parse } from "xml";

export const NO_RECORDS_ERROR_MESSAGE =
  "No records found. Please check if Barcode or MMS ID is correct.";

export class BibDataProvider {
  private readonly barcodeUrl =
    "https://slsp-hsg.alma.exlibrisgroup.com/view/sru/41SLSP_HSG?version=1.2&operation=searchRetrieve&query=alma.barcode=";
  private readonly IZMmsidUrl =
    "https://slsp-hsg.alma.exlibrisgroup.com/view/sru/41SLSP_HSG?version=1.2&operation=searchRetrieve&query=mms_id=";
  private readonly NZMmsidUrl =
    "https://slsp-network.alma.exlibrisgroup.com/view/sru/41SLSP_NETWORK?version=1.2&operation=searchRetrieve&query=mms_id=";

  public async getBibData(identifier: string): Promise<BibData> {
    const response = await this.fetchResponse(identifier);

    if (!response) {
      return Promise.reject(this.createError("No response"));
    }

    const bibData: BibData = await this.convertToBibData(response);

    if (this.checkForErrors(bibData)) {
      return Promise.reject(bibData);
    }
    return Promise.resolve(bibData);
  }

  private fetchResponse(identifier: string): Promise<Response> {
    return this.isMmsId(identifier)
      ? this.call(this.byMmsid, identifier)
      : this.call(this.byBarcode, identifier);
  }

  private call(
    by: (value: string) => Promise<Response>,
    value: string,
  ): Promise<Response> {
    return by.bind(this)(value);
  }

  private byBarcode(barcode: string): Promise<Response> {
    const url = this.barcodeUrl + barcode;
    console.info("calling (Barcode-SRU):", url);
    const response: Promise<Response> = fetch(url);
    return response;
  }

  private byMmsid(mmsId: string): Promise<Response> {
    if (this.isIzMmsId(mmsId)) {
      return this.byIZMmsid(mmsId);
    }
    return this.byNZMmsid(mmsId);
  }

  private byIZMmsid(mmsId: string): Promise<Response> {
    const url = this.IZMmsidUrl + mmsId;
    console.info("calling (IZMmsid-SRU):", url);
    const response: Promise<Response> = fetch(url);
    return response;
  }

  private byNZMmsid(mmsId: string): Promise<Response> {
    const url = this.NZMmsidUrl + mmsId;
    console.info("calling (NZMmsid-SRU):", url);
    const response: Promise<Response> = fetch(url);
    return response;
  }

  private async convertToBibData(response: Response): Promise<BibData> {
    const xml = await response.text();
    const sruResponse: SRUResponse = parse(xml) as unknown as SRUResponse;
    const sru = sruResponse?.searchRetrieveResponse;
    if (sru?.numberOfRecords === "0") {
      return this.createError(NO_RECORDS_ERROR_MESSAGE);
    }
    if (sru?.numberOfRecords === "1") {
      const record = sru?.records?.record
        ?.recordData;
      if (!record) {
        return this.createError("SRU query error");
      }
      return {
        mms_id: sru?.records?.record?.recordIdentifier,
        marcData: record,
        extraResponseData: sru?.extraResponseData,
        errorsExist: false,
      };
    }
    return this.createError("Invalid SRU response");
  }

  private isMmsId(identifier: string) {
    return identifier.startsWith("99");
  }

  private isIzMmsId(mmsId: string) {
    return mmsId.endsWith("5506");
  }

  private checkForErrors(bibData: BibData): boolean {
    return bibData?.errorsExist ?? false;
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
