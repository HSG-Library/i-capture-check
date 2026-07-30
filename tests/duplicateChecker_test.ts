import { assert, assertEquals, assertNotStrictEquals } from "@std/assert";
import { parse } from "xml";
import { BibDataProvider } from "../src/bibDataProvider.ts";
import { DuplicateChecker } from "../src/duplicateChecker.ts";
import { BibData } from "../src/types.ts";

function createProvider(result: BibData | Promise<BibData>): BibDataProvider {
  return {
    getBibData: () => Promise.resolve(result),
  } as unknown as BibDataProvider;
}

Deno.test("check returns empty tocInfo when no 856 TOC text exists", async () => {
  const bibData: BibData = {
    mms_id: "9911111111115506",
    errorsExist: false,
    marcData: {
      record: {
        leader: "01462nam a2200445 c 4500",
        controlfield: [],
        datafield: [
          {
            "@ind1": " ",
            "@ind2": " ",
            "@tag": "856",
            subfield: [
              { "@code": "3", "#text": "Online resource" },
              { "@code": "z", "#text": "Open access" },
            ],
          },
        ],
      },
    },
  };

  const checker = new DuplicateChecker(createProvider(bibData));
  const [tocInfo, modifiedBibData] = await checker.check("HM00673469");

  assertEquals(tocInfo, "");
  assertEquals(modifiedBibData, bibData);
  assertNotStrictEquals(modifiedBibData, bibData);
});

Deno.test("check normalizes matching 856$3 TOC text", async () => {
  const bibData: BibData = {
    mms_id: "9911111111115506",
    errorsExist: false,
    marcData: {
      record: {
        leader: "01462nam a2200445 c 4500",
        controlfield: [],
        datafield: [
          {
            "@ind1": " ",
            "@ind2": " ",
            "@tag": "856",
            subfield: [
              { "@code": "3", "#text": "Table of contents" },
              { "@code": "z", "#text": "View link" },
            ],
          },
          {
            "@ind1": " ",
            "@ind2": " ",
            "@tag": "856",
            subfield: [
              { "@code": "3", "#text": "Some other note" },
              { "@code": "z", "#text": "Indice" },
            ],
          },
        ],
      },
    },
  };

  const checker = new DuplicateChecker(createProvider(bibData));
  const [tocInfo, modifiedBibData] = await checker.check("HM00673469");

  assert(
    tocInfo.includes("Table of contents") && tocInfo.includes("Indice"),
  );

  const first856Subfields = modifiedBibData.marcData?.record.datafield[0]
    .subfield as Array<{ "@code": string; "#text": string }>;
  const second856Subfields = modifiedBibData.marcData?.record.datafield[1]
    .subfield as Array<{ "@code": string; "#text": string }>;

  assertEquals(first856Subfields[0]["#text"], "Inhaltsverzeichnis");
  assertEquals(second856Subfields[0]["#text"], "Some other note");
});

Deno.test("check supports parsed XML shape with single datafield/subfield objects", async () => {
  const parsedRecord = parse(`
    <record>
      <leader>01462nam a2200445 c 4500</leader>
      <controlfield tag="001">9911105709505506</controlfield>
      <datafield ind1=" " ind2=" " tag="856">
        <subfield code="3">Table des matières</subfield>
      </datafield>
    </record>
  `) as unknown as BibData["marcData"];

  const checker = new DuplicateChecker(createProvider({
    mms_id: "9911105709505506",
    marcData: parsedRecord,
    errorsExist: false,
  }));

  const [tocInfo, modifiedBibData] = await checker.check("9911105709505506");

  assert(tocInfo.includes("Table des matières"));

  const datafield = modifiedBibData.marcData?.record.datafield as unknown as {
    subfield: { "@code": string; "#text": string };
  };
  assertEquals(datafield.subfield["#text"], "Inhaltsverzeichnis");
});

Deno.test("check returns an empty result when provider result has no marcData", async () => {
  const checker = new DuplicateChecker(createProvider({ errorsExist: false }));

  const result = await checker.check("HM00673469");

  assertEquals(result[0], "");
  assertEquals(result[1], { errorsExist: false });

});

Deno.test("createSruXml wraps marcData in expected SRU response structure", () => {
  const checker = new DuplicateChecker(createProvider({ errorsExist: false }));
  const bibData: BibData = {
    mms_id: "9911105709505506",
    errorsExist: false,
    marcData: {
      record: {
        leader: "01462nam a2200445 c 4500",
        controlfield: [],
        datafield: [],
      },
    },
  };

  const xml = checker.createSruXml(bibData);
  const parsed = parse(xml) as unknown as {
    searchRetrieveResponse: {
      numberOfRecords: string;
      records: {
        record: {
          recordData: {
            record: {
              leader: string;
            };
          };
        };
      };
    };
  };

  assertEquals(parsed.searchRetrieveResponse.numberOfRecords, "1");
  assertEquals(
    parsed.searchRetrieveResponse.records.record.recordData.record.leader,
    "01462nam a2200445 c 4500",
  );
});

Deno.test("createSruXml returns numberOfRecords 0 when no marcData is present", () => {
  const checker = new DuplicateChecker(createProvider({ errorsExist: false }));

  const xml = checker.createSruXml({ errorsExist: false });
  const parsed = parse(xml) as unknown as {
    searchRetrieveResponse: {
      numberOfRecords: string;
      records?: unknown;
    };
  };

  assertEquals(parsed.searchRetrieveResponse.numberOfRecords, "0");
  assertEquals(parsed.searchRetrieveResponse.records, undefined);
});
