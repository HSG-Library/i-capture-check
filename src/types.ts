export interface BibData {
  mms_id?: string;
  marcData?: MarcData;
  errorsExist?: boolean;
  errorList?: {
    error?: [
      {
        errorCode?: string;
        errorMessage?: string;
      },
    ];
  };
}

export interface MarcData {
  record: {
    leader: string;
    controlfield: Controlfield[];
    datafield: Datafield[];
  };
}

export interface Controlfield {
  "#text": string;
  "@tag": string;
}

export interface Datafield {
  "@ind1": string;
  "@ind2": string;
  "@tag": string;
  subfield: Subfield | Subfield[];
}

export interface Subfield {
  "#text": string;
  "@code": string;
}

export interface SRUResponse {
  searchRetrieveResponse: {
    numberOfRecords: string;
    diagnostics?: unknown;
    records?: {
      record?: {
        recordIdentifier?: string;
        recordData?: MarcData;
      };
    };
  };
}
