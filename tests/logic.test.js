"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const logicFiles = ["state.js", "calculations.js"];

function createStorage() {
  const entries = new Map();
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    }
  };
}

function createLogicContext() {
  const context = {
    console,
    localStorage: createStorage()
  };

  vm.createContext(context);
  logicFiles.forEach((fileName) => {
    vm.runInContext(
      fs.readFileSync(path.join(repoRoot, fileName), "utf8"),
      context,
      { filename: fileName }
    );
  });
  vm.runInContext(
    `
      globalThis.setStateForTest = (input) => {
        state = normalizeState(input);
        return state;
      };
      globalThis.getStateForTest = () => state;
    `,
    context
  );

  return context;
}

function baseInput(overrides = {}) {
  const pos = overrides.pos || [
    {
      id: "po-a",
      name: "PO A",
      annualHours: 1200,
      startDate: "2026-01-01",
      endDate: "2026-12-31"
    }
  ];

  return {
    settings: {
      year: 2026,
      throughMonth: 0,
      dailyHours: 8,
      tolerancePct: 10,
      capacityBasis: "net",
      defaultAnnualHours: 1200,
      defaultPtoDays: 0,
      defaultSickDays: 0,
      defaultHolidayDays: 0,
      ...(overrides.settings || {})
    },
    invoicedMonths: overrides.invoicedMonths || Array(12).fill(false),
    pos,
    monthlyHours:
      overrides.monthlyHours ||
      Object.fromEntries(pos.map((po) => [po.id, Array(12).fill(0)])),
    people: overrides.people || [],
    ui: overrides.ui || {}
  };
}

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, got ${actual}`
  );
}

test("normalizes imported state and clamps unsafe values", () => {
  const logic = createLogicContext();
  const state = logic.setStateForTest({
    settings: {
      year: 2026.9,
      throughMonth: 20,
      dailyHours: -4,
      tolerancePct: -2,
      capacityBasis: "unexpected",
      defaultAnnualHours: -100,
      defaultPtoDays: -1,
      defaultSickDays: -1,
      defaultHolidayDays: -1
    },
    invoicedMonths: [false, true, false],
    pos: [
      {
        id: "po-a",
        name: "",
        annualHours: -10,
        startDate: "2026-12-31",
        endDate: "2026-01-01",
        color: "#136f63"
      }
    ],
    monthlyHours: {
      "po-a": [-5, "12.5", "bad"]
    },
    people: [
      {
        id: "person-a",
        name: "",
        team: "Legacy Team",
        poId: "missing-po",
        annualHours: -1,
        ptoDays: -1,
        sickDays: -1,
        holidayDays: -1
      }
    ],
    ui: {
      visibleChartPoIds: ["po-a", "missing-po"],
      chartType: "not-a-chart",
      collapsedPeople: ["person-a", "missing-person"]
    }
  });

  assert.equal(state.settings.year, 2026);
  assert.equal(state.settings.throughMonth, 1);
  assert.equal(state.settings.dailyHours, 1);
  assert.equal(state.settings.tolerancePct, 0);
  assert.equal(state.settings.capacityBasis, "net");
  assert.equal(state.settings.defaultAnnualHours, 0);

  assert.equal(state.pos[0].name, "PO-1");
  assert.equal(state.pos[0].annualHours, 0);
  assert.equal(state.pos[0].startDate, "2026-01-01");
  assert.equal(state.pos[0].endDate, "2026-12-31");
  assert.equal(state.monthlyHours["po-a"][0], 0);
  assert.equal(state.monthlyHours["po-a"][1], 12.5);
  assert.equal(state.monthlyHours["po-a"][2], 0);

  assert.equal(state.people[0].name, "New person");
  assert.equal(state.people[0].engagements[0].team, "Legacy Team");
  assert.equal(state.people[0].engagements[0].poId, "po-a");
  assert.deepEqual(Array.from(state.ui.visibleChartPoIds), ["po-a"]);
  assert.equal(state.ui.chartType, "monthly");
  assert.deepEqual(Array.from(state.ui.collapsedPeople), ["person-a"]);
});

test("weights partial active months and spreads monthly budget pace", () => {
  const logic = createLogicContext();
  const state = logic.setStateForTest(
    baseInput({
      pos: [
        {
          id: "po-a",
          name: "PO A",
          annualHours: 1200,
          startDate: "2026-01-16",
          endDate: "2026-03-15"
        }
      ]
    })
  );
  const po = state.pos[0];

  assertClose(logic.activeMonthWeight(po, 0), 16 / 31, "January active weight");
  assertClose(logic.activeMonthWeight(po, 1), 1, "February active weight");
  assertClose(logic.activeMonthWeight(po, 2), 15 / 31, "March active weight");
  assertClose(logic.activePeriodWeight(po), 2, "active period weight");
  assertClose(logic.monthlyBudgetPace(po, 0), 1200 * (16 / 31) / 2, "January pace");
  assertClose(logic.monthlyBudgetPace(po, 1), 600, "February pace");
  assertClose(logic.monthlyBudgetPace(po, 2), 1200 * (15 / 31) / 2, "March pace");
  assert.equal(logic.isPoActiveInMonth(po, 3), false);
});

test("forecast and pace use checked invoiced months and ignore draft months", () => {
  const logic = createLogicContext();
  const state = logic.setStateForTest(
    baseInput({
      invoicedMonths: [true, true, false, false, false, false, false, false, false, false, false, false],
      monthlyHours: {
        "po-a": [100, 100, 999, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
    })
  );
  const po = state.pos[0];

  assert.equal(logic.poInvoicedHours(po), 200);
  assert.equal(logic.poEnteredActiveHours(po), 1199);
  assert.equal(logic.poPaceTarget(po), 200);
  assert.equal(logic.forecastForPo("po-a"), 1200);
  assert.equal(logic.statusFor(po, logic.forecastForPo("po-a")).key, "balanced");
});

test("status uses tolerance bands and reports no invoices separately", () => {
  const logic = createLogicContext();

  let state = logic.setStateForTest(baseInput());
  assert.equal(logic.forecastForPo("po-a"), 0);
  assert.equal(logic.statusFor(state.pos[0], 0).key, "info");

  state = logic.setStateForTest(
    baseInput({
      invoicedMonths: [true, false, false, false, false, false, false, false, false, false, false, false],
      monthlyHours: { "po-a": [121, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
    })
  );
  assert.equal(logic.statusFor(state.pos[0], logic.forecastForPo("po-a")).key, "over");

  state = logic.setStateForTest(
    baseInput({
      invoicedMonths: [true, false, false, false, false, false, false, false, false, false, false, false],
      monthlyHours: { "po-a": [79, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
    })
  );
  assert.equal(logic.statusFor(state.pos[0], logic.forecastForPo("po-a")).key, "under");

  state = logic.setStateForTest(
    baseInput({
      invoicedMonths: [true, false, false, false, false, false, false, false, false, false, false, false],
      monthlyHours: { "po-a": [105, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
    })
  );
  assert.equal(logic.statusFor(state.pos[0], logic.forecastForPo("po-a")).key, "balanced");
});

test("capacity clips engagements to PO period and can subtract prorated absence", () => {
  const logic = createLogicContext();
  const state = logic.setStateForTest(
    baseInput({
      settings: {
        capacityBasis: "subtractAbsence",
        dailyHours: 8
      },
      pos: [
        {
          id: "po-a",
          name: "PO A",
          annualHours: 500,
          startDate: "2026-03-01",
          endDate: "2026-08-31"
        }
      ],
      monthlyHours: {
        "po-a": Array(12).fill(0)
      },
      people: [
        {
          id: "person-a",
          name: "Person A",
          annualHours: 1200,
          ptoDays: 10,
          sickDays: 0,
          holidayDays: 0,
          extraLeaveDays: 0,
          engagements: [
            {
              id: "engagement-a",
              team: "Team A",
              poId: "po-a",
              startDate: "2026-01-01",
              endDate: "2026-12-31",
              fte: 0.5
            }
          ]
        }
      ]
    })
  );
  const person = state.people[0];
  const item = person.engagements[0];

  assertClose(logic.engagementCountedMonths(item), 6, "engagement months clipped to PO");
  assertClose(logic.engagementGrossCapacity(person, item), 300, "gross capacity");
  assertClose(logic.engagementAbsenceHours(person, item), 20, "prorated absence");
  assertClose(logic.engagementCapacityForPo(person, item), 280, "net engagement capacity");
  assertClose(logic.personCapacity(person), 280, "person capacity");
  assertClose(logic.poCapacity("po-a"), 280, "PO capacity");
  assertClose(logic.totalCapacity(), 280, "portfolio capacity");
});

test("net capacity basis does not subtract absence", () => {
  const logic = createLogicContext();
  const state = logic.setStateForTest(
    baseInput({
      settings: {
        capacityBasis: "net",
        dailyHours: 8
      },
      pos: [
        {
          id: "po-a",
          name: "PO A",
          annualHours: 500,
          startDate: "2026-03-01",
          endDate: "2026-08-31"
        }
      ],
      people: [
        {
          id: "person-a",
          name: "Person A",
          annualHours: 1200,
          ptoDays: 10,
          sickDays: 0,
          holidayDays: 0,
          extraLeaveDays: 0,
          engagements: [
            {
              id: "engagement-a",
              team: "Team A",
              poId: "po-a",
              startDate: "2026-01-01",
              endDate: "2026-12-31",
              fte: 0.5
            }
          ]
        }
      ]
    })
  );
  const person = state.people[0];
  const item = person.engagements[0];

  assertClose(logic.engagementGrossCapacity(person, item), 300, "gross capacity");
  assertClose(logic.engagementAbsenceHours(person, item), 20, "absence still calculated");
  assertClose(logic.engagementCapacityForPo(person, item), 300, "net-basis capacity");
});
