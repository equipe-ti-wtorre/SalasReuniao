import { strict as assert } from "node:assert";
import test from "node:test";

type PagedResponse<T> = {
  value: T[];
  "@odata.nextLink"?: string;
};

/** Espelha a lógica de paginação usada em MicrosoftGraphRoomsGateway.fetchCalendarViewEvents. */
function collectPagedEvents<T>(
  fetchPage: (url: string) => Promise<PagedResponse<T>>,
  initialUrl: string,
  maxEvents: number,
): Promise<T[]> {
  const collected: T[] = [];
  let nextUrl: string | null = initialUrl;

  return (async () => {
    while (nextUrl && collected.length < maxEvents) {
      const response = await fetchPage(nextUrl);
      const page = response.value ?? [];
      const remaining = maxEvents - collected.length;
      collected.push(...page.slice(0, remaining));

      if (collected.length >= maxEvents || !response["@odata.nextLink"]) {
        break;
      }
      nextUrl = response["@odata.nextLink"];
    }
    return collected;
  })();
}

test("collectPagedEvents: segue @odata.nextLink até o fim", async () => {
  const calls: string[] = [];
  const events = await collectPagedEvents(
    async (url) => {
      calls.push(url);
      if (url === "page-1") {
        return {
          value: [{ id: "1" }, { id: "2" }],
          "@odata.nextLink": "page-2",
        };
      }
      return { value: [{ id: "3" }] };
    },
    "page-1",
    500,
  );

  assert.equal(events.length, 3);
  assert.deepEqual(calls, ["page-1", "page-2"]);
});

test("collectPagedEvents: respeita teto maxEvents", async () => {
  const events = await collectPagedEvents(
    async (url) => {
      if (url === "page-1") {
        return {
          value: [{ id: "1" }, { id: "2" }, { id: "3" }],
          "@odata.nextLink": "page-2",
        };
      }
      return { value: [{ id: "4" }] };
    },
    "page-1",
    3,
  );

  assert.equal(events.length, 3);
});
