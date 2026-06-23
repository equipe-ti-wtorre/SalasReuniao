import { strict as assert } from "node:assert";
import test from "node:test";
import {
  belongsToApiLocalidade,
  normalizeUiConfig,
  resolveApiLocalidade,
  resolveRoomTab,
  sortRoomsByTabOrder,
} from "./uiConfigResolver";

test("normalizeUiConfig: usa defaults quando input vazio", () => {
  const config = normalizeUiConfig(undefined);
  assert.equal(config.tabs.length, 3);
  assert.equal(config.tabs[0]?.id, "nubankparque");
  assert.equal(config.domainToApiLocalidade["nubankparque.com.br"], "Allianz");
});

test("resolveRoomTab: override tem prioridade sobre domínio", () => {
  const config = normalizeUiConfig({
    tabs: [
      { id: "nubankparque", label: "Nubank", domains: ["nubankparque.com.br"], logoKey: "nubankparque" },
      { id: "wtorre", label: "Wtorre", domains: ["wtorre.com.br"], logoKey: "wtorre" },
    ],
    domainToApiLocalidade: {
      "nubankparque.com.br": "Allianz",
      "wtorre.com.br": "WTorre",
    },
    roomTabOverrides: {
      "sala@wtorre.com.br": "nubankparque",
    },
  });

  const resolved = resolveRoomTab("sala@wtorre.com.br", config);
  assert.equal(resolved.tabId, "nubankparque");
  assert.equal(resolved.source, "override");
});

test("resolveRoomTab: usa domínio quando não há override", () => {
  const config = normalizeUiConfig(undefined);
  const resolved = resolveRoomTab("sala.fa@nubankparque.com.br", config);
  assert.equal(resolved.tabId, "nubankparque");
  assert.equal(resolved.source, "domain");
});

test("resolveApiLocalidade: retorna tenant Microsoft pelo domínio", () => {
  const config = normalizeUiConfig(undefined);
  assert.equal(resolveApiLocalidade("user@wtorre.com.br", config), "WTorre");
  assert.equal(resolveApiLocalidade("user@nubankparque.com.br", config), "Allianz");
});

test("belongsToApiLocalidade: valida domínio por localidade API", () => {
  const config = normalizeUiConfig(undefined);
  assert.equal(belongsToApiLocalidade("sala@wtorre.com.br", "WTorre", config), true);
  assert.equal(belongsToApiLocalidade("sala@wtorre.com.br", "Allianz", config), false);
});

test("normalizeUiConfig: normaliza logoFile e roomOrderByTab", () => {
  const config = normalizeUiConfig({
    tabs: [
      {
        id: "nubankparque",
        label: "Nubank",
        domains: ["nubankparque.com.br"],
        logoKey: "nubankparque",
        logoFile: "  nubankparque.svg  ",
      },
    ],
    domainToApiLocalidade: { "nubankparque.com.br": "Allianz" },
    roomTabOverrides: {},
    roomOrderByTab: {
      nubankparque: [" 03azul@nubankparque.com ", "04verde@nubankparque.com"],
      inexistente: ["sala@test.com"],
    },
  });

  assert.equal(config.tabs[0]?.logoFile, "nubankparque.svg");
  assert.deepEqual(config.roomOrderByTab.nubankparque, [
    "03azul@nubankparque.com",
    "04verde@nubankparque.com",
  ]);
  assert.equal(config.roomOrderByTab.inexistente, undefined);
});

test("sortRoomsByTabOrder: aplica ordem salva e mantém novas salas no final", () => {
  const config = normalizeUiConfig({
    tabs: [
      { id: "nubankparque", label: "Nubank", domains: ["nubankparque.com.br"], logoKey: "nubankparque" },
    ],
    domainToApiLocalidade: { "nubankparque.com.br": "Allianz" },
    roomTabOverrides: {},
    roomOrderByTab: {
      nubankparque: ["04verde@nubankparque.com", "02amarela@nubankparque.com"],
    },
  });

  const rooms = [
    { email: "02amarela@nubankparque.com", name: "Sala 02" },
    { email: "03azul@nubankparque.com", name: "Sala 03" },
    { email: "04verde@nubankparque.com", name: "Sala 04" },
  ];

  const sorted = sortRoomsByTabOrder(rooms, "nubankparque", config);
  assert.deepEqual(
    sorted.map((room) => room.email),
    ["04verde@nubankparque.com", "02amarela@nubankparque.com", "03azul@nubankparque.com"],
  );
});
