import { expect, it } from "vitest";
import {
  DRAFT_KEY,
  DRAFT_TTL,
  newReportForm,
  parseReportDraft,
  saveReportDraft,
  type ReportFormState,
} from "../apps/data-portal/lib/report-draft.js";
import { safeReportReturn } from "../apps/data-portal/lib/auth/return-to.js";
import {
  stationExits,
  wagonContextKey,
  type ExitReference,
} from "../apps/data-portal/lib/station-exits.js";
const complete: ReportFormState = {
  ...newReportForm("mashhad", "mashhad:station:basij", "wagon"),
  step: 3,
  directionId: "mashhad:route:line-1-main|mashhad:station:airport",
  car: 2,
  exitId: "up-escalator",
  details: "نزدیک خروجی شمالی",
  photo: "/9j/2Q==",
  photoName: "board.jpg",
  source: "https://example.test/board",
  contactMode: "contact",
  name: "نام خصوصی",
  contact: "private@example.test",
  amenities: [
    { id: 0, amenity: "wc", value: "true" },
    { id: 1, amenity: "elevator", value: "false" },
  ],
};
it("retains review, photo, travel context, several amenity edits and private contact through a sign-in round trip", () => {
  let value = "";
  expect(
    saveReportDraft(
      {
        setItem(key, text) {
          expect(key).toBe(DRAFT_KEY);
          value = text;
        },
      },
      complete,
      {
        fingerprint: "a".repeat(64),
        id: "12345678-1234-4123-8123-123456789abc",
      },
    ),
  ).toBe(true);
  const saved = parseReportDraft(value);
  expect(saved?.form).toEqual(complete);
  expect(saved?.retry?.id).toBe("12345678-1234-4123-8123-123456789abc");
});
it("ignores expired, future, oversized and malformed browser drafts", () => {
  const saved = { version: 1, savedAt: 100000000, form: complete };
  expect(
    parseReportDraft(JSON.stringify(saved), saved.savedAt + DRAFT_TTL + 1),
  ).toBeNull();
  expect(
    parseReportDraft(JSON.stringify(saved), saved.savedAt - 60001),
  ).toBeNull();
  expect(
    parseReportDraft(
      JSON.stringify({
        ...saved,
        form: { ...complete, amenities: Array(11).fill(complete.amenities[0]) },
      }),
      saved.savedAt,
    ),
  ).toBeNull();
  expect(
    parseReportDraft(
      JSON.stringify({ ...saved, form: { ...complete, photo: "<script>" } }),
      saved.savedAt,
    ),
  ).toBeNull();
  expect(parseReportDraft("{broken")).toBeNull();
});
it("fails gracefully when browser draft storage is blocked or full", () => {
  expect(
    saveReportDraft(
      {
        setItem() {
          throw Error("blocked");
        },
      },
      complete,
    ),
  ).toBe(false);
});
it("only resumes same-site contribution pages and strips unrelated callback parameters", () => {
  expect(
    safeReportReturn("/contribute?lang=fa&resume=1&city=mashhad&token=secret"),
  ).toBe("/contribute?city=mashhad&lang=fa&resume=1");
  for (const value of [
    "https://evil.example/",
    "//evil.example/contribute",
    "/account?next=/contribute",
    "/\\evil.example/contribute",
    "/contribute\nLocation: other",
    "/%63ontribute",
  ])
    expect(safeReportReturn(value)).toBeNull();
});
it("has one upward-escalator target by default and supports distinct exits per station/direction without inventing public exits", () => {
  expect(stationExits("mashhad:station:basij").map((e) => e.id)).toEqual([
    "up-escalator",
  ]);
  const reference: ExitReference = {
    defaults: stationExits(""),
    stations: {
      station: {
        directions: {
          outbound: [
            { id: "north", names: { fa: "شمالی", en: "North" }, icon: "exit" },
            {
              id: "transfer",
              names: { fa: "تعویض خط", en: "Transfer" },
              icon: "transfer",
            },
          ],
          inbound: [
            { id: "south", names: { fa: "جنوبی", en: "South" }, icon: "exit" },
          ],
        },
      },
    },
  };
  expect(
    stationExits("station", "outbound", reference).map((e) => e.id),
  ).toEqual(["north", "transfer"]);
  expect(
    stationExits("station", "inbound", reference).map((e) => e.id),
  ).toEqual(["south"]);
  expect(wagonContextKey("station", "outbound", "north", "train")).not.toBe(
    wagonContextKey("station", "outbound", "transfer", "train"),
  );
  expect(wagonContextKey("station", "outbound", "north", "train")).not.toBe(
    wagonContextKey("station", "inbound", "north", "train"),
  );
});
