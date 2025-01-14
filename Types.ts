export interface BibResponse {
  mms_id?: string;
  isbn?: string;
  author?: string;
  title?: string;
  anies?: string[];
  errorsExist?: boolean;
}

export interface MarcData {
  record: {
    leader: string;
    controlfield: {
      "#text": string;
      "@tag": string;
    }[];
    datafield: {
      "@ind1": string;
      "@ind2": string;
      "@tag": string;
      subfield: Subfield | Subfield[];
    }[];
  };
}

export interface Subfield {
  "#text": string;
  "@code": string;
}

export interface ItemData {
  success: boolean;
  shelf_mark: string | null;
  sys_nr?: string;
  isbn?: string[];
  author?: string[];
  title?: string;
  language?: string;
  duplicateInformation?: string;
}
