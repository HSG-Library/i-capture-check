import { assertEquals } from "https://deno.land/std@0.203.0/assert/assert_equals.ts";
import { DuplicateChecker } from "../src/duplicateChecker.ts";
import { BibDataProvider } from "../src/bibDataProvider.ts";
import { BibResponse, ItemData } from "../src/types.ts";
import { stub } from "jsr:@std/testing/mock";

Deno.test("One author, one isbn", async () => {
  const bibDataProviderStub = new BibDataProvider("mock_apikey");

  // Create a mock for BibDataProvider
  stub(
    bibDataProviderStub,
    "getBibData",
    (identifier: string) => (Promise.resolve<BibResponse>({
      mms_id: identifier,
      isbn: "mock_isbn",
      author: "mock_author",
      title: "mock_title",
      anies: [
        `
				<record>
					<leader>01462nam a2200445 c 4500</leader>
					<controlfield tag="001">9911105709505506</controlfield>
					<controlfield tag="005">20240308044659.0</controlfield>
					<controlfield tag="008">201011s2020    gw       |||| 000 0 ger|d</controlfield>
					<datafield ind1=" " ind2=" " tag="020">
						<subfield code="a">9783110603538</subfield>
					</datafield>
					<datafield ind1="1" ind2=" " tag="100">
						<subfield code="a">Nida-Rümelin, Julian</subfield>
						<subfield code="d">1954-</subfield>
						<subfield code="0">(DE-588)115454926</subfield>
						<subfield code="4">aut</subfield>
					</datafield>
				</record>	
				`,
      ],
      errorsExist: false,
    })),
  );

  const duplicateChecker = new DuplicateChecker(bibDataProviderStub);

  const result: ItemData = await duplicateChecker.check("mock_identifier");

  assertEquals(result.success, true);
  assertEquals(result.sys_nr, "mock_identifier");
  assertEquals(result.title, "mock_title");
  assertEquals(result.author, [
    "Nida-Rümelin, Julian",
  ]);
  assertEquals(result.isbn, [
    "9783110603538",
  ]);
  assertEquals(result.language, "ger");
});

Deno.test("Two authors, two isbns", async () => {
  const bibDataProviderStub = new BibDataProvider("mock_apikey");

  // Create a mock for BibDataProvider
  stub(
    bibDataProviderStub,
    "getBibData",
    (identifier: string) => (Promise.resolve<BibResponse>({
      mms_id: identifier,
      isbn: "mock_isbn",
      author: "mock_author",
      title: "mock_title",
      anies: [
        `
				<record>
					<leader>01462nam a2200445 c 4500</leader>
					<controlfield tag="001">9911105709505506</controlfield>
					<controlfield tag="005">20240308044659.0</controlfield>
					<controlfield tag="008">201011s2020    gw       |||| 000 0 ger|d</controlfield>
					<datafield ind1=" " ind2=" " tag="020">
						<subfield code="a">3100024524</subfield>
					</datafield>
					<datafield ind1=" " ind2=" " tag="020">
						<subfield code="a">9783100024527</subfield>
					</datafield>
					<datafield ind1="1" ind2=" " tag="100">
						<subfield code="a">Nida-Rümelin, Julian</subfield>
						<subfield code="d">1954-</subfield>
						<subfield code="0">(DE-588)115454926</subfield>
						<subfield code="4">aut</subfield>
					</datafield>
					<datafield ind1="1" ind2=" " tag="700">
						<subfield code="6">880-02</subfield>
						<subfield code="a">Hack, Michael</subfield>
						<subfield code="d">1980-</subfield>
						<subfield code="0">(DE-588)1038483662</subfield>
						<subfield code="e">Übersetzer</subfield>
						<subfield code="4">trl</subfield>
					</datafield>
				</record>	
				`,
      ],
      errorsExist: false,
    })),
  );

  const duplicateChecker = new DuplicateChecker(bibDataProviderStub);

  const result: ItemData = await duplicateChecker.check("mock_identifier");

  assertEquals(result.success, true);
  assertEquals(result.sys_nr, "mock_identifier");
  assertEquals(result.title, "mock_title");
  assertEquals(result.author, [
    "Nida-Rümelin, Julian",
    "Hack, Michael",
  ]);
  assertEquals(result.isbn, [
    "9783100024527",
    "3100024524",
  ]);
  assertEquals(result.language, "ger");
});

Deno.test("No authors, no isbns", async () => {
  const bibDataProviderStub = new BibDataProvider("mock_apikey");

  // Create a mock for BibDataProvider
  stub(
    bibDataProviderStub,
    "getBibData",
    (identifier: string) => (Promise.resolve<BibResponse>({
      mms_id: identifier,
      isbn: "mock_isbn",
      author: "mock_author",
      title: "mock_title",
      anies: [
        `
				<record>
					<leader>01462nam a2200445 c 4500</leader>
					<controlfield tag="001">9911105709505506</controlfield>
					<controlfield tag="005">20240308044659.0</controlfield>
					<controlfield tag="008">201011s2020    gw       |||| 000 0 ger|d</controlfield>
					<datafield ind1=" " ind2=" " tag="900">
						<subfield code="a">nothing</subfield>
					</datafield>
				</record>	
				`,
      ],
      errorsExist: false,
    })),
  );

  const duplicateChecker = new DuplicateChecker(bibDataProviderStub);

  const result: ItemData = await duplicateChecker.check("mock_identifier");

  assertEquals(result.success, true);
  assertEquals(result.sys_nr, "mock_identifier");
  assertEquals(result.title, "mock_title");
  assertEquals(result.author, []);
  assertEquals(result.isbn, []);
  assertEquals(result.language, "ger");
});
