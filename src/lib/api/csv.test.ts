import { describe, expect, it } from "vitest";
import { parseCSV, rowsToProducts } from "./csv";

describe("parseCSV", () => {
  it("keeps commas inside quoted fields", () => {
    expect(parseCSV('a,"one, two",c')).toEqual([["a", "one, two", "c"]]);
  });

  it('reads "" inside quotes as a single quote', () => {
    expect(parseCSV('a,"say ""hi""",c')).toEqual([["a", 'say "hi"', "c"]]);
  });

  it("keeps a newline inside a quoted field", () => {
    expect(parseCSV('a,"line one\nline two"')).toEqual([["a", "line one\nline two"]]);
  });

  it("treats CRLF as one row break", () => {
    expect(parseCSV("a,b\r\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("drops rows that are entirely blank", () => {
    expect(parseCSV("a,b\n\n,\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

const header = "id,name,price,image,description,available,stock,max,new";

describe("rowsToProducts", () => {
  const parse = (csv: string) => rowsToProducts(parseCSV(csv));

  it("throws when a required column is missing", () => {
    expect(() => parse("id,name\nbunny,Bunny")).toThrow(/"id", "name", and "price"/);
  });

  it("tolerates ₱ and thousands separators in price", () => {
    const [a, b] = parse(`${header}\na,A,₱250,,,,,,\nb,B,"1,250",,,,,,`);
    expect(a.price).toBe(250);
    expect(b.price).toBe(1250);
  });

  it("drops duplicate ids, keeping the first", () => {
    const rows = parse(`${header}\nx,First,100,,,,,,\nx,Second,200,,,,,,`);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("First");
  });

  it("drops rows with no id or an unusable price", () => {
    expect(parse(`${header}\n,No id,100,,,,,,\ny,Bad price,abc,,,,,,`)).toHaveLength(0);
  });

  it("reads a blank `available` as yes but a blank `new` as no", () => {
    const [p] = parse(`${header}\na,A,100,,,,,,`);
    expect(p.available).toBe(true);
    expect(p.isNew).toBe(false);
  });

  it("honours an explicit no in `available`", () => {
    const [p] = parse(`${header}\na,A,100,,,No,,,`);
    expect(p.available).toBe(false);
  });

  it("marks stock 0 as sold out even when available says yes", () => {
    const [p] = parse(`${header}\na,A,100,,,yes,0,,`);
    expect(p.available).toBe(false);
    expect(p.stock).toBe(0);
  });

  it("earns the New badge only on a clear yes", () => {
    const [yes, no] = parse(`${header}\na,A,100,,,,,,yes\nb,B,100,,,,,,maybe`);
    expect(yes.isNew).toBe(true);
    expect(no.isNew).toBe(false);
  });

  it("leaves blank stock and max undefined", () => {
    const [p] = parse(`${header}\na,A,100,,,,,,`);
    expect(p.stock).toBeUndefined();
    expect(p.max).toBeUndefined();
  });

  it("falls back to the id when the name cell is empty", () => {
    const [p] = parse(`${header}\nbunny,,100,,,,,,`);
    expect(p.name).toBe("bunny");
  });

  it("works when the optional columns are absent entirely", () => {
    const [p] = rowsToProducts(parseCSV("id,name,price\na,A,150"));
    expect(p).toMatchObject({ id: "a", name: "A", price: 150, available: true, isNew: false });
  });
});
