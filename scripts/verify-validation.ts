// Proves the SERVER rejects bad input, independent of any browser attribute.
// HTML required/pattern is a convenience; a Server Action is a public
// endpoint and anything can post to it.
//
//   npm run verify:validation
import "dotenv/config";
import { partySchema } from "../src/lib/validation/party";
import { karigarSchema } from "../src/lib/validation/karigar";
import { jobWorkSchema } from "../src/lib/validation/job-work";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${detail ? "  (" + detail + ")" : ""}`);
}

const goodParty = {
  name: "Mayra Creation",
  ownerName1: "Mayra bhai",
  ownerName2: "",
  contact1: "9876500001",
  contact2: "",
  gender: "male",
  address: "Surat",
  email: "",
};

function party(over: Record<string, unknown>) {
  return partySchema.safeParse({ ...goodParty, ...over });
}

console.log("--- PARTY: required fields ---");
check("valid party accepted", party({}).success);
check("missing party name rejected", !party({ name: "" }).success);
check("missing owner name rejected", !party({ ownerName1: "" }).success);
check("missing contact1 REJECTED", !party({ contact1: "" }).success);
check("missing gender REJECTED", !party({ gender: "" }).success);
check('gender "unspecified" REJECTED', !party({ gender: "unspecified" }).success);

console.log("\n--- PARTY: name must not be numbers ---");
check("party name '12345' rejected", !party({ name: "12345" }).success);
check("party name '3 Star Creation' accepted", party({ name: "3 Star Creation" }).success);
check("owner name '999' rejected", !party({ ownerName1: "999" }).success);
check("owner name 'Amba bhai 2' rejected (digits in a person name)", !party({ ownerName1: "Amba bhai 2" }).success);
check("owner name \"O'Brien-Shah\" accepted", party({ ownerName1: "O'Brien-Shah" }).success);

console.log("\n--- PARTY: contact must not be letters ---");
check("contact 'abcdefghij' rejected", !party({ contact1: "abcdefghij" }).success);
check("contact '98765abc01' rejected", !party({ contact1: "98765abc01" }).success);
check("contact '12345' rejected (too short)", !party({ contact1: "12345" }).success);
check("contact '+91 98765 00001' accepted", party({ contact1: "+91 98765 00001" }).success);
check("contact2 letters rejected", !party({ contact2: "hello" }).success);
check("contact2 empty accepted", party({ contact2: "" }).success);
check("bad email rejected", !party({ email: "not-an-email" }).success);

console.log("\n--- KARIGAR ---");
const goodKarigar = { name: "Zuber", contact1: "", contact2: "", address: "" };
const karigar = (o: Record<string, unknown>) => karigarSchema.safeParse({ ...goodKarigar, ...o });
check("valid karigar accepted", karigar({}).success);
check("karigar name '123' rejected", !karigar({ name: "123" }).success);
check("karigar name 'Zuber 2' rejected (digits in a person name)", !karigar({ name: "Zuber 2" }).success);
check("karigar contact letters rejected", !karigar({ contact1: "abcdefghij" }).success);
check("karigar contact valid accepted", karigar({ contact1: "9876511111" }).success);
check("karigar contact left blank accepted", karigar({ contact1: "" }).success);

console.log("\n--- JOB WORK ---");
const goodJob = {
  date: "2026-09-03",
  partyId: "p1",
  karigarId: "k1",
  pieces: "126",
  rate: "162",
  chalanNo: "767",
  partyDesignNo: "",
  computerDesignNo: "",
  comment: "",
  status: "PENDING",
  lines: [{ descriptionTypeId: "d1", price: "162" }],
};
const job = (o: Record<string, unknown>) => jobWorkSchema.safeParse({ ...goodJob, ...o });
check("valid job work accepted", job({}).success);
check("missing karigar rejected", !job({ karigarId: "" }).success);
check("zero pieces rejected", !job({ pieces: "0" }).success);
check("negative pieces rejected", !job({ pieces: "-5" }).success);
check("fractional pieces rejected", !job({ pieces: "1.5" }).success);
check("zero rate rejected", !job({ rate: "0" }).success);
check("letters in chalan no. rejected", !job({ chalanNo: "J-767" }).success);
check("no description lines rejected", !job({ lines: [] }).success);
check("line with no type rejected", !job({ lines: [{ descriptionTypeId: "", price: "10" }] }).success);
check("line with zero price rejected", !job({ lines: [{ descriptionTypeId: "d1", price: "0" }] }).success);
check("bad status rejected", !job({ status: "DONE" }).success);


// --- ASTERISK / ERROR PARITY ---
// The red asterisks in the forms are hand-placed. If a schema rule is
// relaxed or tightened without moving the asterisk, the form starts lying
// about what is required. These checks pin the two together: submitting a
// completely empty form must produce an error for exactly the starred
// fields, and none of the unstarred ones.
console.log("\n--- REQUIRED-FIELD PARITY (asterisks vs schema) ---");

function blankErrors(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[] }[] } } }, keys: string[]) {
  const empty = Object.fromEntries(keys.map((k) => [k, ""]));
  const r = schema.safeParse(empty);
  if (r.success) return new Set<string>();
  return new Set((r.error?.issues ?? []).map((i) => String(i.path[0])));
}

const partyKeys = ["name", "ownerName1", "ownerName2", "contact1", "contact2", "gender", "address", "email"];
const partyStarred = ["name", "ownerName1", "gender", "contact1"];
const partyBlank = blankErrors(partySchema, partyKeys);
for (const k of partyStarred)
  check(`party: starred "${k}" errors when blank`, partyBlank.has(k), [...partyBlank].join(","));
for (const k of partyKeys.filter((k) => !partyStarred.includes(k)))
  check(`party: unstarred "${k}" accepts blank`, !partyBlank.has(k));

const karigarKeys = ["name", "contact1", "contact2", "address"];
const karigarStarred = ["name"];
const karigarBlank = blankErrors(karigarSchema, karigarKeys);
for (const k of karigarStarred)
  check(`karigar: starred "${k}" errors when blank`, karigarBlank.has(k));
for (const k of karigarKeys.filter((k) => !karigarStarred.includes(k)))
  check(`karigar: unstarred "${k}" accepts blank`, !karigarBlank.has(k));

// Job work's starred fields, checked one at a time against an otherwise
// valid record (a blank date/party/karigar is not representable as "").
for (const k of ["date", "partyId", "karigarId", "pieces", "rate"])
  check(`job work: starred "${k}" errors when blank`, !job({ [k]: "" }).success);
for (const k of ["chalanNo", "partyDesignNo", "computerDesignNo", "comment"])
  check(`job work: unstarred "${k}" accepts blank`, job({ [k]: "" }).success);

console.log(failures === 0 ? "\nverify:validation finished with 0 failures." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
